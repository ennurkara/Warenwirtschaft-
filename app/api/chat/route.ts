import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { APP_KNOWLEDGE } from '@/lib/chat/knowledge'
import { TOOL_SCHEMAS, runTool } from '@/lib/chat/tools'

export const runtime = 'nodejs'

interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

const MAX_TOOL_LOOPS = 4

export async function POST(req: NextRequest) {
  let body: { message?: string; history?: ChatHistoryMessage[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 500 })
  }

  // RLS-aware: User-Client (cookies → eigene Session). Mitarbeiter sehen
  // nur was sie auch in der UI sehen würden, Techniker nur eigene Berichte.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const systemPrompt = `Du bist der Hilfe-Assistent für die Apps "Warenwirtschaft" und "Arbeitsbericht" (Kassen Buch).
Antworte knapp, sachlich, auf Deutsch. Keine Floskeln, keine Wiederholung der Frage. Bei Daten-Fragen nutze die Tools, um aktuelle Werte zu holen — erfinde nichts. Bei Anleitungs-Fragen nutze das Wissen unten und nenne konkrete UI-Pfade als \`/path\`.

Aktuelle Session:
- Benutzer: ${profile?.full_name ?? user.email ?? '—'}
- Rolle: ${profile?.role ?? 'unbekannt'}

${APP_KNOWLEDGE}`

  const openai = new OpenAI({ apiKey: openaiKey })

  // History → OpenAI-Format
  const history = (body.history ?? []).slice(-10) // letzte 10 Nachrichten als Kontext
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
    { role: 'user', content: body.message },
  ]

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = TOOL_SCHEMAS.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))

  // Tool-Calling-Loop: max MAX_TOOL_LOOPS Runden, danach zwingen wir eine
  // finale Text-Antwort.
  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 1000,
    })
    const msg = completion.choices[0]?.message
    if (!msg) {
      return NextResponse.json({ reply: 'Keine Antwort erhalten.' })
    }

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push(msg)
      for (const call of msg.tool_calls) {
        if (call.type !== 'function') continue
        const result = await runTool(supabase, call.function.name, call.function.arguments)
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 12000), // hard cap pro tool result
        })
      }
      continue
    }

    return NextResponse.json({ reply: msg.content ?? 'Keine Antwort erhalten.' })
  }

  // Fallback: zu viele tool-Runden → letzte Anfrage ohne Tools
  const final = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 1000,
  })
  return NextResponse.json({
    reply: final.choices[0]?.message?.content ?? 'Konnte keine abschließende Antwort erstellen.',
  })
}
