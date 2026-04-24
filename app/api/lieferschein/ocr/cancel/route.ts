import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { source_path?: string }
  try { body = await req.json() } catch { body = {} }

  const sp = body.source_path
  if (!sp || typeof sp !== 'string') {
    return NextResponse.json({ error: 'source_path required' }, { status: 400 })
  }
  if (!sp.startsWith('lieferscheine/')) {
    return NextResponse.json({ error: 'invalid source_path' }, { status: 400 })
  }

  const keyInBucket = sp.replace(/^lieferscheine\//, '')
  const { error } = await supabase.storage.from('lieferscheine').remove([keyInBucket])
  if (error) {
    console.error('Storage cancel remove failed', { user: user.id, sp, err: error.message })
    return NextResponse.json({ error: 'remove failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
