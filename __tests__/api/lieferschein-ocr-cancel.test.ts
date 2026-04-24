/**
 * @jest-environment node
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

import { NextRequest } from 'next/server'

const removeMock = jest.fn().mockResolvedValue({ data: null, error: null })
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'admin' } }) }) }) }),
    storage: { from: () => ({ remove: removeMock }) },
  }),
}))

import { POST } from '@/app/api/lieferschein/ocr/cancel/route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/lieferschein/ocr/cancel', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/lieferschein/ocr/cancel', () => {
  beforeEach(() => removeMock.mockClear())

  it('returns 400 when source_path is missing', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when source_path is outside lieferscheine/', async () => {
    const res = await POST(req({ source_path: 'other-bucket/evil.pdf' }))
    expect(res.status).toBe(400)
  })

  it('deletes the file and returns 200', async () => {
    const res = await POST(req({ source_path: 'lieferscheine/2026-04-23-abc.pdf' }))
    expect(res.status).toBe(200)
    expect(removeMock).toHaveBeenCalledWith(['2026-04-23-abc.pdf'])
  })
})
