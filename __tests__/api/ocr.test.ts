/**
 * @jest-environment node
 */
import { POST } from '@/app/api/ocr/route'
import { NextRequest } from 'next/server'

global.fetch = jest.fn()

describe('POST /api/ocr', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 if no image provided', async () => {
    const req = new NextRequest('http://localhost/api/ocr', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('forwards image to n8n and returns result', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Epson Printer', serial_number: 'SN123', manufacturer: 'Epson' }),
    })
    const req = new NextRequest('http://localhost/api/ocr', {
      method: 'POST',
      body: JSON.stringify({ image: 'base64data' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('Epson Printer')
  })
})