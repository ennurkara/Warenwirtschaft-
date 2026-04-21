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

  const { data: devices } = await supabase
    .from('devices')
    .select('id, serial_number, status, location, model:models(modellname, manufacturer:manufacturers(name), category:categories(name))')
    .neq('status', 'ausgemustert')
    .order('serial_number')

  type ModelShape = { modellname: string; manufacturer: { name: string } | null; category: { name: string } | null } | null

  const inventoryText = (devices ?? [])
    .map((d: Record<string, unknown>) => {
      const model = d.model as ModelShape
      const modelName = model?.modellname ?? 'Unbekannt'
      const manufacturer = model?.manufacturer?.name ?? 'Unbekannt'
      const category = model?.category?.name ?? 'Unbekannt'
      return `- SN: ${d.serial_number ?? 'n/a'} | ${manufacturer} ${modelName} (${category}) | Status: ${d.status} | Ort: ${d.location ?? 'n/a'}`
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
${inventoryText}`,
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
