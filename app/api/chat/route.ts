import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const n8nUrl = process.env.N8N_CHAT_WEBHOOK_URL
  const secret = process.env.N8N_CHAT_WEBHOOK_SECRET

  const response = await fetch(n8nUrl!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': secret ?? '',
    },
    body: JSON.stringify({ message: body.message }),
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Chat service error' }, { status: 502 })
  }

  const data = await response.json()
  return NextResponse.json(data)
}