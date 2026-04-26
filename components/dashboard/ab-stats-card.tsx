import Link from 'next/link'
import { ClipboardList, ArrowRight } from 'lucide-react'
import type { ReportStats } from '@/lib/work-reports/stats'

export function AbStatsCard({
  stats,
  scope,
}: {
  stats: ReportStats
  scope: 'all' | 'mine'
}) {
  const title = scope === 'mine' ? 'Meine Arbeitsberichte' : 'Arbeitsberichte'

  const cells = [
    { label: 'Heute',         value: stats.today },
    { label: 'Diese Woche',   value: stats.thisWeek },
    { label: 'Dieser Monat',  value: stats.thisMonth },
    { label: 'Gesamt',        value: stats.total },
  ]

  return (
    <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="kb-sec-head flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[var(--ink-3)]" />
          <h3>{title}</h3>
        </div>
        <Link
          href="/arbeitsberichte"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--blue)] hover:text-[var(--blue-ink)]"
        >
          Alle anzeigen
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--rule-soft)]">
        {cells.map(c => (
          <div key={c.label} className="p-[18px]">
            <div className="kb-label">{c.label}</div>
            <div className="mt-1 text-[26px] font-semibold tabular-nums text-[var(--ink)]">
              {c.value}
            </div>
          </div>
        ))}
      </div>
      {stats.drafts > 0 && (
        <div className="border-t border-[var(--rule-soft)] px-[18px] py-2.5 bg-[var(--amber-tint)]/30 text-[12.5px] text-[var(--amber)]">
          {stats.drafts} offene{stats.drafts === 1 ? 'r' : ''} Entwurf{stats.drafts === 1 ? '' : 'e'}
          {scope === 'mine' ? ' von dir' : ' im System'}
        </div>
      )}
    </div>
  )
}
