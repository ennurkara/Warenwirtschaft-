import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.image) {
    return NextResponse.json({ error: 'image required' }, { status: 400 })
  }

  const n8nUrl = process.env.N8N_OCR_WEBHOOK_URL
  const secret = process.env.N8N_OCR_WEBHOOK_SECRET

  const response = await fetch(n8nUrl!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': secret ?? '',
    },
    body: JSON.stringify({ image: body.image }),
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'OCR service error' }, { status: 502 })
  }

  const data = await response.json()
  return NextResponse.json(data)
}