'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { CustomerKind } from '@/lib/types'

type TabValue = CustomerKind | 'alle'

const TABS: Array<{ value: TabValue; label: string }> = [
  { value: 'alle',     label: 'Alle' },
  { value: 'vectron',  label: 'Vectron' },
  { value: 'apro',     label: 'Apro' },
  { value: 'sonstige', label: 'Sonstige' },
]

export function CustomerKindTabs() {
  const params = useSearchParams()
  const current = (params.get('kind') as TabValue) ?? 'alle'

  return (
    <div className="inline-flex items-center gap-0.5 rounded-kb border border-[var(--rule)] bg-white p-1 shadow-xs">
      {TABS.map(t => {
        const active = current === t.value
        const href = t.value === 'alle' ? '/customers' : `/customers?kind=${t.value}`
        return (
          <Link
            key={t.value}
            href={href}
            className={cn(
              'px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors',
              active
                ? 'bg-[var(--ink)] text-white'
                : 'text-[var(--ink-2)] hover:bg-[var(--paper-2)]'
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
