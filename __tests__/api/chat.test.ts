/**
 * @jest-environment node
 */
import { POST } from '@/app/api/chat/route'
import { NextRequest } from 'next/server'

global.fetch = jest.fn()

describe('POST /api/chat', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 if no message provided', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('forwards message to n8n and returns reply', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'Ihr habt 3 Drucker im Lager.' }),
    })
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Wie viele Drucker?' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.reply).toBe('Ihr habt 3 Drucker im Lager.')
  })
})