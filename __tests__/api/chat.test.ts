/**
 * @jest-environment node
 */
import { POST } from '@/app/api/chat/route'
import { NextRequest } from 'next/server'

// Set env vars before module loads
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.OPENAI_API_KEY = 'test-openai-key'

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({ reply: 'Ihr habt 3 Drucker im Lager.' }),
              },
            },
          ],
        }),
      },
    },
  }))
})

// Mock Supabase client
const mockDevices = [
  { name: 'Drucker', quantity: 3, status: 'lager', condition: 'neu', location: 'Lager', serial_number: 'SN1', categories: { name: 'Drucker' } },
]

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'devices') {
        return {
          select: () => ({
            neq: () => ({
              order: () => Promise.resolve({ data: mockDevices }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [] }),
          }),
        }),
      }
    },
  }),
}))

describe('POST /api/chat', () => {
  it('returns 400 if no message provided', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('queries Supabase and OpenAI, returns reply', async () => {
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