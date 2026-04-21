import { formatCurrency, formatDate } from '@/lib/utils'

interface Row { sale_id: string; datum: string; kunde: string; model_label: string; vk_preis: number }

export function RecentSales({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="font-medium mb-3">Letzte Verkäufe</h3>
      {rows.length === 0 ? <p className="text-slate-500 text-sm">Noch keine Verkäufe.</p> : (
        <ul className="divide-y text-sm">
          {rows.map(r => (
            <li key={r.sale_id} className="py-2 grid grid-cols-[auto_1fr_1fr_auto] gap-3">
              <span className="text-slate-500">{formatDate(r.datum)}</span>
              <span>{r.model_label}</span>
              <span className="text-slate-600">{r.kunde}</span>
              <span className="tabular-nums text-right">{formatCurrency(Number(r.vk_preis))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
