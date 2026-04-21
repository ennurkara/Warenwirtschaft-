import { formatCurrency } from '@/lib/utils'

interface KpiRow {
  geraete_im_lager: number
  bestandswert_ek: number
  umsatz_mtd: number
  marge_mtd: number
}

export function KpiCards({ data }: { data: KpiRow }) {
  const cards = [
    { label: 'Geräte im Lager', value: String(data.geraete_im_lager) },
    { label: 'Bestandswert (EK)', value: formatCurrency(Number(data.bestandswert_ek)) },
    { label: 'Umsatz MTD',       value: formatCurrency(Number(data.umsatz_mtd)) },
    { label: 'Marge MTD',        value: formatCurrency(Number(data.marge_mtd)) },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="rounded-lg border bg-white p-4">
          <div className="text-sm text-slate-500">{c.label}</div>
          <div className="text-2xl font-semibold mt-1">{c.value}</div>
        </div>
      ))}
    </div>
  )
}
