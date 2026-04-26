'use client'

import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { ChatWindow } from '@/components/chat/chat-window'
import { cn } from '@/lib/utils'

type Role = 'admin' | 'mitarbeiter' | 'techniker' | 'viewer'

export function ChatFab({ role }: { role: Role }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          className={cn(
            'flex flex-col rounded-kb border border-[var(--rule)] bg-white shadow-2xl overflow-hidden',
            // ~420x640 mit Klemme an die Viewport-Ränder, falls Fenster klein
            'w-[min(420px,calc(100vw-3rem))] h-[min(640px,calc(100vh-7rem))]',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--rule-soft)] px-4 py-3 bg-[var(--paper-2)]/40">
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-[var(--ink)]">
                Kassen Buch Assistent
              </div>
              <div className="text-[11.5px] text-[var(--ink-3)] truncate">
                Frag zu Daten oder Bedienung — Sicht laut Rolle: {role}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Chat schließen"
              className="rounded-md p-1 hover:bg-[var(--paper-2)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ChatWindow role={role} />
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Chat schließen' : 'Chat öffnen'}
        className={cn(
          'h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-colors',
          open
            ? 'bg-[var(--paper-2)] text-[var(--ink)] hover:bg-[var(--paper-3)]'
            : 'bg-[var(--ink)] text-white hover:bg-[var(--blue)]',
        )}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  )
}
