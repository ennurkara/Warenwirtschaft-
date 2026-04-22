import { formatCurrency } from '@/lib/utils'

interface Row { model_id: string; model_label: string; stueckzahl_verkauft: number; umsatz_ytd: number }

export function TopModels({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map(r => Number(r.umsatz_ytd)))

  return (
    <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="kb-sec-head">
        <h3>Top-Modelle · Umsatz YTD</h3>
        <div className="spacer" />
        <span className="count">YTD</span>
      </div>
      <div className="px-4 py-2">
        {rows.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-[var(--ink-3)]">
            Keine Verkäufe dieses Jahr.
          </div>
        ) : (
          rows.map((r, i) => (
            <div
              key={r.model_id}
              className="grid grid-cols-[24px_1fr_auto_auto] gap-2.5 items-center py-2"
              style={{ borderBottom: i < rows.length - 1 ? '1px dashed var(--rule-soft)' : 'none' }}
            >
              <span className="kb-mono text-[11px] text-[var(--ink-4)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <div className="text-[13px] font-medium mb-1">{r.model_label}</div>
                <div className="kb-bar" style={{ height: 3 }}>
                  <span style={{ width: `${(Number(r.umsatz_ytd) / max) * 100}%` }} />
                </div>
              </div>
              <span className="kb-num text-[12px] text-[var(--ink-3)]">{r.stueckzahl_verkauft}×</span>
              <span className="kb-num min-w-[80px] text-right font-medium">
                {formatCurrency(Number(r.umsatz_ytd))}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
