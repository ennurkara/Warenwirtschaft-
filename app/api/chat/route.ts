import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const openaiKey = process.env.OPENAI_API_KEY!

  if (!serviceRoleKey || !openaiKey) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 500 })
  }

  // Fetch inventory context from Supabase (service role bypasses RLS)
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const [{ data: devices }, { data: movements }] = await Promise.all([
    supabase
      .from('devices')
      .select('name, quantity, status, condition, location, serial_number, categories(name)')
      .neq('status', 'ausgemustert')
      .order('name'),
    supabase
      .from('device_movements')
      .select('action, quantity, created_at, devices(name), profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const inventoryText = (devices ?? [])
    .map((d: Record<string, unknown>) => {
      const cat = (d.categories as Record<string, string>)?.name ?? 'Unbekannt'
      return `- ${d.name} (${cat}): ${d.quantity}x, Status: ${d.status}, Zustand: ${d.condition}, Ort: ${d.location ?? 'n/a'}, SN: ${d.serial_number ?? 'n/a'}`
    })
    .join('\n')

  const movementsText = (movements ?? [])
    .map((m: Record<string, unknown>) => {
      const device = (m.devices as Record<string, string>)?.name ?? 'Unbekannt'
      const user = (m.profiles as Record<string, string>)?.full_name ?? 'Unbekannt'
      const action = m.action === 'entnahme' ? 'Entnahme' : m.action === 'einlagerung' ? 'Einlagerung' : 'Defekt'
      return `- ${action}: ${m.quantity}x ${device} von ${user} (${new Date(m.created_at as string).toLocaleDateString('de-DE')})`
    })
    .join('\n')

  // Call OpenAI with inventory context
  const openai = new OpenAI({ apiKey: openaiKey })
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Du bist ein freundlicher Lager-Assistent für ein Warenwirtschaftssystem. Beantworte Fragen zum Inventar auf Deutsch. Antworte immer als JSON: { "reply": "deine antwort" }

Aktueller Inventarstand:
${inventoryText}

Letzte Bewegungen:
${movementsText}`,
      },
      {
        role: 'user',
        content: body.message,
      },
    ],
    max_tokens: 500,
    response_format: { type: 'json_object' },
  })

  const raw = completion.choices[0]?.message?.content ?? '{"reply":"Keine Antwort erhalten."}'
  try {
    const result = JSON.parse(raw)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ reply: raw })
  }
}