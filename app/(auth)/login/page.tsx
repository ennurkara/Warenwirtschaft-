'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/layout/logo'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error('Anmeldung fehlgeschlagen', { description: 'E-Mail oder Passwort falsch.' })
      setIsLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--paper-2)] px-4">
      <div className="w-full max-w-[440px]">
        <div className="bg-white rounded-kb-lg border border-[var(--rule)] shadow-md p-10">
          <div className="flex items-center mb-7">
            <Logo height={28} />
          </div>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-[var(--ink)] leading-tight">
            Willkommen zurück
          </h1>
          <p className="mt-1.5 text-[13.5px] text-[var(--ink-3)] tracking-[-0.003em]">
            Melde dich mit deiner Firmen-E-Mail an.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="kb-label block">E-Mail</label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="name@firma.de"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="kb-label block">Passwort</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? 'Anmelden…' : 'Anmelden'}
            </Button>
          </form>
        </div>

        <div className="mt-5 text-center font-mono text-[11px] text-[var(--ink-4)] tracking-wider">
          KASSEN BUCH · WARENWIRTSCHAFT · v2.4
        </div>
      </div>
    </div>
  )
}
