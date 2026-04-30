'use client'

import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { revealMasterPassword } from '@/lib/inventory/master-password-action'

export function MasterPasswordRow({ deviceId }: { deviceId: string }) {
  const [password, setPassword] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reveal() {
    setLoading(true)
    setError(null)
    const r = await revealMasterPassword(deviceId)
    setLoading(false)
    if (r.error) {
      setError(r.error)
      return
    }
    setPassword(r.password)
  }

  function hide() {
    setPassword(null)
    setError(null)
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="kb-label">Master-Passwort</span>
      <div className="flex items-center gap-2">
        <span className="text-[13.5px] text-[var(--ink)] font-mono tabular-nums">
          {password ?? '••••••••'}
        </span>
        <button
          type="button"
          onClick={password ? hide : reveal}
          disabled={loading}
          aria-label={password ? 'Passwort verbergen' : 'Passwort aufdecken'}
          className="text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : password ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {error && (
        <span className="text-[12px] text-[var(--ink-3)]">
          {error === 'forbidden' ? 'Nur Admin' : error === 'unauthorized' ? 'Nicht eingeloggt' : 'Fehler — bitte erneut'}
        </span>
      )}
    </div>
  )
}
