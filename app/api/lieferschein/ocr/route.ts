import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { renderPdfPages } from '@/lib/pdf/render-pages'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf'])

const LIEFERSCHEIN_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'Lieferschein',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        supplier:    { type: ['string', 'null'] },
        rechnungsnr: { type: ['string', 'null'] },
        datum:       { type: ['string', 'null'] },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              manufacturer:  { type: ['string', 'null'] },
              name:          { type: ['string', 'null'] },
              serial_number: { type: ['string', 'null'] },
              sw_serial:     { type: ['string', 'null'] },
              quantity:      { type: 'integer', minimum: 1 },
              ek_preis:      { type: ['number', 'null'] },
            },
            required: ['manufacturer', 'name', 'serial_number', 'sw_serial', 'quantity', 'ek_preis'],
            additionalProperties: false,
          },
        },
      },
      required: ['supplier', 'rechnungsnr', 'datum', 'items'],
      additionalProperties: false,
    },
  },
} as const

const SYSTEM_PROMPT = `Du extrahierst aus einem Lieferschein (Foto oder PDF) strukturierte Felder für eine Warenwirtschaft für Kassen-/POS-Hardware.

Felder:
- supplier: Lieferant / Absender-Firma auf dem Lieferschein. Kanonischer Name ohne Rechtsform (z.B. "Quad" statt "Quad GmbH").
- rechnungsnr: Lieferschein- oder Rechnungsnummer (z.B. "LS-2026-0042"). Nicht Bestellnummer, nicht Auftragsnummer.
- datum: Rechnungs- oder Lieferdatum im ISO-Format YYYY-MM-DD. Bevorzuge Rechnungsdatum wenn beide vorhanden.
- items: Liste der Positionen auf dem Lieferschein.
  - manufacturer: Hersteller ohne Rechtsform (z.B. "Epson").
  - name: Modellbezeichnung ohne Hersteller-Präfix (z.B. "TM-T88VI").
  - serial_number: Hardware-Seriennummer der Einzelgeräte. NICHT: Artikel-Nr., EAN, Bestell-Nr., Trackingnummer. Bei Vectron-Kassen das Gerät selbst (HW-SN), NICHT die Software-Seriennummer.
  - sw_serial: Software-/Lizenz-Seriennummer. NUR bei Vectron-Geräten relevant. Auf Vectron-Lieferscheinen meist als "SW-SN", "Lizenz-Nr.", "POSitive-SN" oder direkt unter der HW-SN gelistet. Bei Nicht-Vectron-Geräten: null.
  - quantity: Anzahl gleicher Geräte in der Zeile (Default 1).
  - ek_preis: Netto-Stückpreis in Euro. Wenn nur Gesamtpreis gelistet, teile durch quantity. Wenn kein Preis erkennbar: null.

Regeln:
- Nur aus dem Dokument ableiten, niemals raten.
- Nicht eindeutig erkennbare Felder: null.
- Keine zusätzlichen Felder, keine Erklärungen.`

type VisionPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // --- Auth ---
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // --- Parse multipart ---
  const form = await req.formData()
  const file = form.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'file too large (max 10MB)' }, { status: 413 })
  }
  const mime = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: `unsupported type: ${mime}` }, { status: 415 })
  }

  // --- Upload to Storage ---
  const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg'
  const iso = new Date().toISOString().slice(0, 10)
  const keyInBucket = `${iso}-${randomUUID()}.${ext}`
  const source_path = `lieferscheine/${keyInBucket}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await supabase.storage
    .from('lieferscheine')
    .upload(keyInBucket, buffer, { contentType: mime, upsert: false })
  if (upErr) {
    console.error('Storage upload failed', { user: user.id, err: upErr.message })
    return NextResponse.json({ error: 'storage upload failed' }, { status: 500 })
  }

  const failAndCleanup = async (status: number, body: Record<string, unknown>) => {
    const { error: rmErr } = await supabase.storage.from('lieferscheine').remove([keyInBucket])
    if (rmErr) {
      console.error('Cleanup after error failed', { user: user.id, key: keyInBucket, err: rmErr.message })
    }
    return NextResponse.json(body, { status })
  }

  // --- Build Vision content ---
  const userContent: VisionPart[] = [
    { type: 'text', text: 'Extrahiere die strukturierten Felder aus dem folgenden Lieferschein.' },
  ]
  if (mime === 'application/pdf') {
    let pages: Buffer[]
    try {
      pages = await renderPdfPages(buffer)
    } catch (e) {
      console.error('PDF render failed', { user: user.id, err: String(e) })
      return await failAndCleanup(502, { error: 'pdf render failed' })
    }
    for (const png of pages) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${png.toString('base64')}` },
      })
    }
  } else {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${mime};base64,${buffer.toString('base64')}` },
    })
  }

  // --- Vision call ---
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  const model = process.env.LIEFERSCHEIN_OCR_MODEL || 'gpt-4o-mini'
  let completion
  try {
    completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { role: 'user', content: userContent as any },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response_format: LIEFERSCHEIN_SCHEMA as any,
      max_tokens: 2000,
    })
  } catch (e) {
    console.error('OpenAI vision failed', { user: user.id, source_path, err: String(e) })
    return await failAndCleanup(502, { error: 'ocr service error' })
  }

  const raw = completion.choices[0]?.message?.content ?? '{}'
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return await failAndCleanup(502, { error: 'ocr returned non-json', raw })
  }

  return NextResponse.json({ ...parsed, source_path })
}
