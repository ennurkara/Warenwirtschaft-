import { formatCurrency } from '@/lib/utils'

interface Row {
  sale_id: string
  datum: string
  kunde: string
  model_label: string
  vk_preis: number
  rechnungsnr?: string | null
}

function formatDe(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function RecentSales({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="kb-sec-head">
        <h3>Letzte Verkäufe</h3>
        <span className="count">Heute · {rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-[18px] py-8 text-center text-[13px] text-[var(--ink-3)]">
          Noch keine Verkäufe.
        </div>
      ) : (
        <table className="kb-table">
          <thead>
            <tr>
              <th style={{ width: 74 }}>Datum</th>
              <th>Kunde / Gerät</th>
              {rows.some(r => r.rechnungsnr) && <th style={{ width: 96 }}>Beleg</th>}
              <th className="num" style={{ width: 96 }}>VK</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.sale_id}>
                <td className="kb-mono text-[12px] text-[var(--ink-3)]">{formatDe(r.datum)}</td>
                <td>
                  <div className="font-medium leading-tight">{r.kunde}</div>
                  <div className="text-[12px] text-[var(--ink-3)]">{r.model_label}</div>
                </td>
                {rows.some(row => row.rechnungsnr) && (
                  <td className="kb-mono text-[12px] text-[var(--blue-ink)]">
                    {r.rechnungsnr ?? '—'}
                  </td>
                )}
                <td className="num">{formatCurrency(Number(r.vk_preis))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
