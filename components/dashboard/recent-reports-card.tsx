import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export interface RecentReportRow {
  id: string
  report_number: string | null
  status: 'entwurf' | 'abgeschlossen'
  start_time: string | null
  completed_at: string | null
  customer_name: string | null
  technician_name: string | null
}

export function RecentReportsCard({
  rows,
  scope,
}: {
  rows: RecentReportRow[]
  scope: 'all' | 'mine'
}) {
  const title = scope === 'mine' ? 'Meine letzten Berichte' : 'Letzte Berichte'

  if (rows.length === 0) {
    return (
      <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
        <div className="kb-sec-head flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[var(--ink-3)]" />
          <h3>{title}</h3>
        </div>
        <div className="px-[18px] py-4 text-[13px] text-[var(--ink-3)]">
          {scope === 'mine'
            ? 'Du hast noch keine Berichte geschrieben.'
            : 'Noch keine Berichte erfasst.'}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="kb-sec-head flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-[var(--ink-3)]" />
        <h3>{title}</h3>
      </div>
      <div className="divide-y divide-[var(--rule-soft)]">
        {rows.map(r => (
          <Link
            key={r.id}
            href={`/arbeitsberichte/${r.id}`}
            className="px-[18px] py-3 grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center hover:bg-[var(--paper-2)] transition-colors"
          >
            <div className="text-[12.5px] font-mono text-[var(--ink-2)]">
              {r.report_number ?? '—'}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[var(--ink)] truncate">
                {r.customer_name ?? '—'}
              </div>
              {scope === 'all' && r.technician_name && (
                <div className="text-[11.5px] text-[var(--ink-3)] truncate">
                  {r.technician_name}
                </div>
              )}
            </div>
            <div className="text-[12px] text-[var(--ink-3)] tabular-nums">
              {r.completed_at ? formatDate(r.completed_at) : (r.start_time ? formatDate(r.start_time) : '—')}
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
