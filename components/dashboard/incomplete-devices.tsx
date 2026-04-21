import Link from 'next/link'

interface Row {
  device_id: string
  serial_number: string | null
  created_at: string
  modellname: string | null
  manufacturer_name: string | null
  category_name: string | null
}

export function IncompleteDevices({ rows, isAdmin }: { rows: Row[]; isAdmin: boolean }) {
  if (rows.length === 0) return null
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 className="font-medium mb-3 text-amber-900">
        ⚠ Unvollständige Geräte ({rows.length}) — ohne Einkaufsbeleg
        {!isAdmin && <span className="ml-2 text-xs font-normal text-amber-700">(Admin ergänzt)</span>}
      </h3>
      <ul className="divide-y divide-amber-200 text-sm">
        {rows.map(r => {
          const label = (
            <>
              <span className="text-slate-500 text-xs mr-2">{r.category_name ?? '—'}</span>
              {r.manufacturer_name ?? '—'} {r.modellname ?? '—'}
              {r.serial_number && <span className="font-mono text-xs text-slate-500 ml-2">({r.serial_number})</span>}
            </>
          )
          return (
            <li key={r.device_id} className="py-2 grid grid-cols-[1fr_auto] gap-3">
              {isAdmin ? (
                <Link href={`/inventory/${r.device_id}`} className="hover:underline">{label}</Link>
              ) : (
                <span>{label}</span>
              )}
              <span className="text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString('de-DE')}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
