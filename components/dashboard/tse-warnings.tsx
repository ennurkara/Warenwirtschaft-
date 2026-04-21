import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface Row { device_id: string; model_label: string; hw_serial: string | null; tse_valid_until: string; tage_verbleibend: number }

export function TseWarnings({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 className="font-medium mb-3 text-amber-900">⚠ TSE-Ablauf in &lt; 90 Tagen ({rows.length})</h3>
      <ul className="divide-y divide-amber-200 text-sm">
        {rows.map(r => (
          <li key={r.device_id} className="py-2 grid grid-cols-[1fr_auto_auto] gap-3">
            <Link href={`/inventory/${r.device_id}`} className="hover:underline">
              {r.model_label} {r.hw_serial && <span className="font-mono text-xs text-slate-500">({r.hw_serial})</span>}
            </Link>
            <span>{formatDate(r.tse_valid_until)}</span>
            <span className="tabular-nums">{r.tage_verbleibend} Tage</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
