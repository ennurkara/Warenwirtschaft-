'use client'

import { usePathname } from 'next/navigation'
import { Fragment } from 'react'
import { Bell, Search } from 'lucide-react'

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  inventory: 'Inventar',
  admin: 'Admin',
  models: 'Modelle',
  categories: 'Kategorien',
  manufacturers: 'Hersteller',
  customers: 'Kunden',
  suppliers: 'Lieferanten',
  purchases: 'Einkäufe',
  sales: 'Verkäufe',
  users: 'Benutzer',
  chat: 'Assistent',
  new: 'Neu',
}

function deriveCrumbs(pathname: string): string[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return ['Start']
  const crumbs: string[] = ['Start']
  for (const seg of segments) {
    const looksLikeId = /^[0-9a-f-]{8,}$/i.test(seg)
    if (looksLikeId) {
      crumbs.push('Detail')
      continue
    }
    crumbs.push(SEGMENT_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1))
  }
  return crumbs
}

export function TopBar() {
  const pathname = usePathname()
  const crumbs = deriveCrumbs(pathname)

  return (
    <div className="kb-top hidden md:flex">
      <div className="kb-crumbs">
        {crumbs.map((c, i) => (
          <Fragment key={`${i}-${c}`}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? 'now' : ''}>{c}</span>
          </Fragment>
        ))}
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2 px-3 h-8 w-[280px] rounded-md border border-[var(--rule)] bg-[var(--paper-2)] text-[var(--ink-3)] text-[12.5px]">
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 truncate">Gerät, Kunde, Rechnungsnr…</span>
        <span className="font-mono text-[11px] px-1.5 py-[1px] border border-[var(--rule)] bg-white rounded text-[var(--ink-3)]">⌘K</span>
      </div>
      <button
        aria-label="Benachrichtigungen"
        className="p-2 rounded-md text-[var(--ink-3)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)] transition-colors"
      >
        <Bell className="h-4 w-4" />
      </button>
    </div>
  )
}
