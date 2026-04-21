import { formatCurrency } from '@/lib/utils'

interface Row { category_name: string; anzahl_im_lager: number; bestandswert_ek: number }

export function StockByCategory({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map(r => r.anzahl_im_lager))
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="font-medium mb-3">Bestand nach Kategorie</h3>
      <ul className="space-y-2">
        {rows.map(r => (
          <li key={r.category_name} className="grid grid-cols-[1fr_4fr_auto] gap-3 items-center text-sm">
            <span>{r.category_name}</span>
            <div className="h-4 bg-slate-100 rounded overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${(r.anzahl_im_lager / max) * 100}%` }} />
            </div>
            <span className="text-right tabular-nums">{r.anzahl_im_lager} · {formatCurrency(Number(r.bestandswert_ek))}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
