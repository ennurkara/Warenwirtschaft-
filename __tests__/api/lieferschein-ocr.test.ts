/**
 * @jest-environment node
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.LIEFERSCHEIN_OCR_MODEL = 'gpt-4o-mini'

import { NextRequest } from 'next/server'

// --- Mock OpenAI ---
const mockCreate = jest.fn()
jest.mock('openai', () => jest.fn().mockImplementation(() => ({
  chat: { completions: { create: mockCreate } },
})))

// --- Mock Supabase server client (async) ---
const uploadMock = jest.fn().mockResolvedValue({ data: { path: 'ignored' }, error: null })
const removeMock = jest.fn().mockResolvedValue({ data: null, error: null })
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'test-user' } } }) },
    from: (_t: string) => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { role: 'admin' }, error: null }) }),
      }),
    }),
    storage: {
      from: () => ({
        upload: uploadMock,
        remove: removeMock,
      }),
    },
  }),
}))

// Mock PDF renderer (so we don't need a real PDF in the test)
jest.mock('@/lib/pdf/render-pages', () => ({
  MAX_PDF_PAGES: 5,
  renderPdfPages: jest.fn().mockResolvedValue([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]), // fake PNG bytes
  ]),
}))

import { POST } from '@/app/api/lieferschein/ocr/route'

function makeRequest(file: Blob | null): NextRequest {
  const form = new FormData()
  if (file) form.append('file', file, file.type === 'application/pdf' ? 'slip.pdf' : 'slip.jpg')
  return new NextRequest('http://localhost/api/lieferschein/ocr', {
    method: 'POST',
    body: form,
  })
}

describe('POST /api/lieferschein/ocr', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    uploadMock.mockClear()
    removeMock.mockClear()
  })

  it('returns 400 when file is missing', async () => {
    const res = await POST(makeRequest(null))
    expect(res.status).toBe(400)
  })

  it('returns 413 when file exceeds 10MB', async () => {
    const big = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: 'image/jpeg' })
    const res = await POST(makeRequest(big))
    expect(res.status).toBe(413)
  })

  it('returns 415 for unsupported mime type', async () => {
    const res = await POST(makeRequest(new Blob(['hi'], { type: 'text/plain' })))
    expect(res.status).toBe(415)
  })

  it('uploads file, calls OpenAI, returns parsed payload for images', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        supplier: 'Quad GmbH',
        rechnungsnr: 'LS-42',
        datum: '2026-04-20',
        items: [{ manufacturer: 'Epson', name: 'TM-T88VI', serial_number: null, quantity: 5, ek_preis: 249.0 }],
      }) } }],
    })
    const res = await POST(makeRequest(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.supplier).toBe('Quad GmbH')
    expect(body.items).toHaveLength(1)
    expect(body.source_path).toMatch(/^lieferscheine\//)
    expect(uploadMock).toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalled()
  })

  it('handles PDF by calling renderPdfPages', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        supplier: null, rechnungsnr: null, datum: null, items: [],
      }) } }],
    })
    const res = await POST(makeRequest(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })

  it('returns 502 when OpenAI throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('timeout'))
    const res = await POST(makeRequest(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })))
    expect(res.status).toBe(502)
  })

  it('removes the uploaded file when OpenAI fails (no orphan)', async () => {
    mockCreate.mockRejectedValueOnce(new Error('timeout'))
    const res = await POST(makeRequest(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })))
    expect(res.status).toBe(502)
    expect(removeMock).toHaveBeenCalledTimes(1)
    const [removedKeys] = removeMock.mock.calls[0]
    expect(Array.isArray(removedKeys) && removedKeys.length).toBe(1)
    expect(String(removedKeys[0])).toMatch(/\.(jpg|png|pdf)$/)
  })

  it('removes the uploaded file when JSON parsing fails', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: '<<not-json>>' } }] })
    const res = await POST(makeRequest(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })))
    expect(res.status).toBe(502)
    expect(removeMock).toHaveBeenCalledTimes(1)
  })
})
