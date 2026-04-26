import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { WorkReport } from '@/lib/types'

export function CustomerWorkReportsCard({ reports }: { reports: WorkReport[] }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
        <div className="kb-sec-head"><h3>Arbeitsberichte</h3></div>
        <div className="px-[18px] py-4 text-[13px] text-[var(--ink-3)]">
          Keine Arbeitsberichte für diesen Kunden.
        </div>
      </div>
    )
  }

  const sorted = [...reports].sort((a, b) =>
    (b.start_time ?? b.created_at).localeCompare(a.start_time ?? a.created_at)
  )

  return (
    <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="kb-sec-head"><h3>Arbeitsberichte ({reports.length})</h3></div>
      <div className="divide-y divide-[var(--rule-soft)]">
        {sorted.map(r => (
          <Link
            key={r.id}
            href={`/arbeitsberichte/${r.id}`}
            className="px-[18px] py-3 grid grid-cols-[auto_1fr_auto] gap-3 items-center hover:bg-[var(--paper-2)] transition-colors"
          >
            <div className="text-[13px] font-mono text-[var(--ink-2)]">
              {r.report_number ?? '—'}
            </div>
            <div className="text-[12.5px] text-[var(--ink-3)]">
              {r.start_time ? formatDate(r.start_time) : '—'}
            </div>
            <Badge variant={r.status === 'abgeschlossen' ? 'verkauft' : 'reserv'} withDot>
              {r.status}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  )
}
