/**
 * @jest-environment node
 */
import { POST } from '@/app/api/ocr/route'
import { NextRequest } from 'next/server'

// Set env vars before importing the module
process.env.MISTRAL_API_KEY = 'test-mistral-key'
process.env.OPENAI_API_KEY = 'test-openai-key'

// Mock fetch for Mistral OCR
global.fetch = jest.fn()

// Mock OpenAI constructor
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({ name: 'Epson Printer', serial_number: 'SN123', manufacturer: 'Epson' }),
              },
            },
          ],
        }),
      },
    },
  }))
})

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

  it('calls Mistral OCR and OpenAI, returns structured result', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pages: [{ markdown: 'Epson TM-T88VI SN123 Serial: SN123' }] }),
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