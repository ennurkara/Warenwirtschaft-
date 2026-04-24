import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.image) {
    return NextResponse.json({ error: 'image required' }, { status: 400 })
  }

  const mistralKey = process.env.MISTRAL_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (!mistralKey || !openaiKey) {
    return NextResponse.json({ error: 'API keys not configured' }, { status: 500 })
  }

  // Step 1: Mistral OCR - extract text from image
  const mistralRes = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mistralKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_url',
        image_url: `data:image/jpeg;base64,${body.image}`,
      },
    }),
  })

  if (!mistralRes.ok) {
    const errText = await mistralRes.text()
    console.error('Mistral OCR error:', errText)
    return NextResponse.json({ error: 'Mistral OCR service error' }, { status: 502 })
  }

  const mistralData = await mistralRes.json()
  const ocrText = mistralData.pages?.map((p: { markdown: string }) => p.markdown).join('\n') ?? ''

  // Step 2: OpenAI - structure the OCR text into JSON
  const systemPrompt = `Du extrahierst aus OCR-Text eines Geräte-Typenschilds oder Etiketts strukturierte Felder für eine Warenwirtschaft für Kassen-/POS-Hardware.

Felder:
- manufacturer: Hersteller-Firmenname, kanonisch und ohne Rechtsform (z.B. "Apple" statt "Apple Inc.", "Epson" statt "Seiko Epson Corp.", "Ingenico" statt "Ingenico Group").
- name: Modell-/Produktbezeichnung ohne Hersteller-Präfix (z.B. "iPhone 14 Pro", "TM-T88VI", "Moonlite 3", "Desk/5000").
- serial_number: Seriennummer des Geräts. Markiert typischerweise mit "S/N", "Serial", "Serial No.", "Serien-Nr." oder "SN:". NICHT verwenden: MAC-Adresse, IMEI, Part-Number (P/N), Model-Number (M/N), Artikel-Nr., EAN/Barcode. Bei mehreren Kandidaten bevorzuge den mit "S/N"- oder "Serial"-Label.

Regeln:
- Werte nur aus dem OCR-Text ableiten, nicht raten.
- Nicht eindeutig erkennbare Felder: null (nicht leerer String).
- Keine Erklärungen, keine zusätzlichen Felder.

Ausgabe: ausschließlich JSON { "name": ..., "serial_number": ..., "manufacturer": ... }.`

  const openai = new OpenAI({ apiKey: openaiKey })
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: ocrText },
    ],
    max_tokens: 200,
    response_format: { type: 'json_object' },
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  try {
    const result = JSON.parse(raw)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ name: null, serial_number: null, manufacturer: null })
  }
}