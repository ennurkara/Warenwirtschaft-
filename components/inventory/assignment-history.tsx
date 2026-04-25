import { formatDate } from '@/lib/utils'
import { ArrowRight, ArrowDownLeft, Repeat, ShoppingBag } from 'lucide-react'

interface AssignmentRow {
  id: string
  kind: 'leihe' | 'verkauf' | 'austausch_raus' | 'austausch_rein'
  started_at: string
  ended_at: string | null
  notes: string | null
  customer: { name: string | null } | null
  work_report: { report_number: string | null } | null
}

const KIND_DEF: Record<AssignmentRow['kind'], { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  leihe:           { label: 'Verliehen',       icon: ArrowRight,    tone: 'text-[var(--blue)]' },
  verkauf:         { label: 'Verkauft',        icon: ShoppingBag,   tone: 'text-[var(--ink-3)]' },
  austausch_raus:  { label: 'Austausch (Raus)', icon: Repeat,        tone: 'text-[var(--blue)]' },
  austausch_rein:  { label: 'Austausch (Rein)', icon: ArrowDownLeft, tone: 'text-[var(--amber)]' },
}

export function AssignmentHistory({ rows }: { rows: AssignmentRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
        <div className="kb-sec-head">
          <h3>Historie</h3>
        </div>
        <div className="px-[18px] py-4 text-[13px] text-[var(--ink-3)]">
          Noch keine Zuordnungen.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="kb-sec-head">
        <h3>Historie</h3>
        <span className="count">{rows.length}</span>
      </div>
      <ul className="divide-y divide-[var(--rule-soft)]">
        {rows.map(r => {
          const def = KIND_DEF[r.kind]
          const Icon = def.icon
          const isActive = r.ended_at == null && r.kind !== 'austausch_rein'
          return (
            <li key={r.id} className="px-[18px] py-3 flex items-start gap-3">
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${def.tone}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-[var(--ink)]">{def.label}</span>
                  {r.customer?.name && (
                    <span className="text-[13px] text-[var(--ink-2)]">· {r.customer.name}</span>
                  )}
                  {isActive && (
                    <span className="inline-flex items-center text-[10.5px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--green-tint)] text-[var(--green)]">
                      aktiv
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-[var(--ink-3)] mt-0.5">
                  {formatDate(r.started_at)}
                  {r.ended_at && r.ended_at !== r.started_at && ` — ${formatDate(r.ended_at)}`}
                  {r.work_report?.report_number && ` · ${r.work_report.report_number}`}
                </div>
                {r.notes && (
                  <div className="text-[12px] text-[var(--ink-3)] mt-1 whitespace-pre-wrap">{r.notes}</div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
