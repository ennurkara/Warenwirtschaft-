'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Mail, Loader2 } from 'lucide-react'

interface Props {
  reportId: string
  /** Bereits gesendet? Steuert nur den Button-Text ("senden" vs "erneut senden"). */
  alreadySent: boolean
}

export function SendEmailButton({ reportId, alreadySent }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isSending, setIsSending] = useState(false)

  async function handleSend() {
    setIsSending(true)
    try {
      const res = await fetch('/api/send-report-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`PDF an ${json.sentTo ?? 'Kunde'} gesendet`)
        startTransition(() => router.refresh())
      } else {
        toast.error('PDF-Versand fehlgeschlagen', {
          description: json.error ?? `HTTP ${res.status}`,
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('PDF-Versand fehlgeschlagen', { description: msg })
    } finally {
      setIsSending(false)
    }
  }

  const busy = isSending || isPending

  return (
    <button
      onClick={handleSend}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rule)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink-2)] hover:bg-[var(--paper-2)] disabled:opacity-60"
    >
      {busy
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <Mail className="h-3.5 w-3.5" />}
      {alreadySent ? 'PDF erneut senden' : 'PDF an Kunde senden'}
    </button>
  )
}
