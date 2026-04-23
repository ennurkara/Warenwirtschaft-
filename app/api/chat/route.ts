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

  const deviceLines = (devices ?? []).map((d: Record<string, unknown>) => {
    const model = d.model as ModelShape
    const modelName = model?.modellname ?? 'Unbekanntes Modell'
    const manufacturer = model?.manufacturer?.name ?? '—'
    const category = model?.category?.name ?? '—'
    const location = (d.location as string) ? ` @ ${d.location}` : ''
    return `- [${d.serial_number ?? '?'}] ${manufacturer} ${modelName} (${category}) — ${d.status}${location}`
  })

  const deviceCount = deviceLines.length
  const inventoryText = deviceCount > 0 ? deviceLines.join('\n') : '(keine Geräte im Bestand)'

  const systemPrompt = `Du bist der Lager-Assistent einer Warenwirtschaft für Kassen-/POS-Hardware.

Regeln:
- Antworte knapp, sachlich, auf Deutsch. Keine Floskeln, keine Wiederholung der Frage.
- Nutze ausschließlich die unten gelisteten Geräte. Erfinde keine Seriennummern, Hersteller oder Modelle.
- Bei Zählfragen: nenne die Zahl zuerst, danach 1–3 Beispiele.
- Wenn nichts passt: "Keine passenden Geräte im aktuellen Bestand."
- Kategorien sind fest vorgegeben (Kassen, Drucker, Kartenterminals, Handscanner, Kundendisplays, usw.). Bei Fragen nach einer Kategorie exakt filtern.

Ausgabe: ausschließlich JSON { "reply": "..." }.

Geräte (Status ≠ ausgemustert, ${deviceCount} insgesamt, Format: [Seriennummer] Hersteller Modell (Kategorie) — Status @ Ort):
${inventoryText}`

  const openai = new OpenAI({ apiKey: openaiKey })
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: body.message },
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
