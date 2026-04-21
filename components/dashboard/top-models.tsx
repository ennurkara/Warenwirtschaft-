import { formatCurrency } from '@/lib/utils'

interface Row { model_id: string; model_label: string; stueckzahl_verkauft: number; umsatz_ytd: number }

export function TopModels({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="font-medium mb-3">Top-Modelle (Umsatz YTD)</h3>
      {rows.length === 0 ? <p className="text-slate-500 text-sm">Keine Verkäufe dieses Jahr.</p> : (
        <ul className="divide-y text-sm">
          {rows.map(r => (
            <li key={r.model_id} className="py-2 grid grid-cols-[1fr_auto_auto] gap-3">
              <span>{r.model_label}</span>
              <span className="text-slate-500">{r.stueckzahl_verkauft}×</span>
              <span className="tabular-nums text-right">{formatCurrency(Number(r.umsatz_ytd))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
