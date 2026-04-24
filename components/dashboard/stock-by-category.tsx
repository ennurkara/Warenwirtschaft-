import { formatCurrency } from '@/lib/utils'

interface Row { category_name: string; anzahl_im_lager: number; bestandswert_ek: number }

export function StockByCategory({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map(r => r.anzahl_im_lager))
  const total = rows.reduce((a, b) => a + b.anzahl_im_lager, 0)

  return (
    <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="kb-sec-head">
        <h3>Bestand nach Kategorie</h3>
        <span className="count">
          {total} Geräte · {rows.length} Kat.
        </span>
      </div>
      <div className="px-4 py-3">
        {rows.length === 0 ? (
          <div className="py-4 text-center text-[13px] text-[var(--ink-3)]">
            Noch keine Daten.
          </div>
        ) : (
          rows.map((r, i) => (
            <div
              key={r.category_name}
              className="grid grid-cols-[140px_1fr_auto] gap-3 items-center py-[7px]"
              style={{
                borderBottom: i < rows.length - 1 ? '1px dashed var(--rule-soft)' : 'none',
              }}
            >
              <span className="text-[13px] text-[var(--ink-2)] truncate">{r.category_name}</span>
              <div className="kb-bar">
                <span style={{ width: `${(r.anzahl_im_lager / max) * 100}%` }} />
              </div>
              <span className="kb-num text-[12px] text-[var(--ink-2)] text-right min-w-[120px]">
                <b className="text-[var(--ink)] font-semibold">{r.anzahl_im_lager}</b>
                <span className="text-[var(--ink-4)] mx-1">·</span>
                {formatCurrency(Number(r.bestandswert_ek))}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
