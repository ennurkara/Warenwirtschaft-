import { formatCurrency } from '@/lib/utils'
import { Sparkline } from './sparkline'

interface KpiRow {
  geraete_im_lager: number
  bestandswert_ek: number
  umsatz_mtd: number
  marge_mtd: number
}

// Until a deltas/trend view lands server-side, the sparklines use stubbed trajectories
// derived from the current value so the visual rhythm matches the design.
function trail(target: number, steps = 8): number[] {
  const start = target * 0.88
  const out: number[] = []
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    out.push(start + (target - start) * t + (Math.sin(i * 1.3) * target * 0.01))
  }
  return out
}

export function KpiCards({ data }: { data: KpiRow }) {
  const cells = [
    {
      label: 'Geräte im Lager',
      value: String(data.geraete_im_lager),
      unit: 'Stk.',
      spark: trail(data.geraete_im_lager || 1),
    },
    {
      label: 'Bestandswert EK',
      value: formatCurrency(Number(data.bestandswert_ek)),
      spark: trail(Number(data.bestandswert_ek) || 1),
    },
    {
      label: 'Umsatz MTD',
      value: formatCurrency(Number(data.umsatz_mtd)),
      spark: trail(Number(data.umsatz_mtd) || 1),
    },
    {
      label: 'Marge MTD',
      value: formatCurrency(Number(data.marge_mtd)),
      spark: trail(Number(data.marge_mtd) || 1),
    },
  ]

  return (
    <div className="kb-kpi">
      {cells.map(c => (
        <div className="kb-kpi-cell" key={c.label}>
          <div className="k-label">{c.label}</div>
          <div className="k-val">
            {c.value}
            {c.unit && <span className="unit">{c.unit}</span>}
          </div>
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <div className="text-[12px] text-[var(--ink-3)]" aria-hidden>&nbsp;</div>
            <Sparkline data={c.spark} />
          </div>
        </div>
      ))}
    </div>
  )
}
