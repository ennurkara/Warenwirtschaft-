import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface Row {
  device_id: string
  serial_number: string | null
  created_at: string
  modellname: string | null
  manufacturer_name: string | null
  category_name: string | null
}

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const d = Math.max(0, Math.floor(ms / 86_400_000))
  if (d === 0) return 'heute'
  if (d < 7) return `${d}d`
  if (d < 30) return `${Math.floor(d / 7)}w`
  return `${Math.floor(d / 30)}mo`
}

function formatDe(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function IncompleteDevices({ rows, isAdmin }: { rows: Row[]; isAdmin: boolean }) {
  if (rows.length === 0) return null

  return (
    <div className="rounded-kb border bg-white shadow-xs overflow-hidden border-[var(--amber)] border-l-[3px]">
      <div
        className="flex items-center gap-3 px-[18px] py-[12px] border-b"
        style={{
          background: 'color-mix(in oklab, var(--amber-tint) 70%, transparent)',
          borderBottomColor: 'color-mix(in oklab, var(--amber) 30%, transparent)',
        }}
      >
        <AlertTriangle className="h-3.5 w-3.5 text-[var(--amber)]" />
        <h3 className="text-[14px] font-semibold text-[#8a5a17] tracking-[-0.01em] m-0">
          Unvollständige Geräte · Einkaufsdaten fehlen
        </h3>
        <span className="text-[12.5px] text-[#8a5a17] tabular-nums">{rows.length} offen</span>
        <div className="flex-1" />
        {!isAdmin && (
          <span className="text-[11.5px] font-medium text-[#8a5a17]">
            Admin ergänzt
          </span>
        )}
      </div>

      {/* Mobile: gestapelte Karten — Pflegen-Button bleibt im Viewport */}
      <div className="md:hidden divide-y divide-[var(--rule-soft)]">
        {rows.map(r => (
          <div key={r.device_id} className="px-4 py-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium text-[var(--ink)] truncate">
                  {r.manufacturer_name ?? '—'} {r.modellname ?? '—'}
                </div>
                <div className="text-[12px] text-[var(--ink-3)] truncate">
                  {r.category_name ?? '—'}
                  {r.serial_number && (
                    <>
                      {' · '}
                      <span className="kb-mono text-[11.5px]">SN {r.serial_number}</span>
                    </>
                  )}
                </div>
                <div className="text-[11.5px] text-[var(--ink-4)] mt-0.5">
                  Angelegt {formatDe(r.created_at)}
                </div>
              </div>
              <Badge variant="reserv" withDot className="shrink-0">{ageLabel(r.created_at)}</Badge>
            </div>
            {isAdmin && (
              <Button asChild size="sm" variant="primary" className="self-end">
                <Link href={`/inventory/${r.device_id}`}>Pflegen</Link>
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: volle Tabelle */}
      <table className="kb-table hidden md:table">
        <thead>
          <tr>
            <th style={{ width: 28 }}>#</th>
            <th>Gerät</th>
            <th>Kategorie</th>
            <th>Seriennr.</th>
            <th>Angelegt</th>
            <th>Alter</th>
            {isAdmin && <th style={{ width: 100 }}></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.device_id}>
              <td className="row-n">{String(i + 1).padStart(2, '0')}</td>
              <td className="font-medium">
                {r.manufacturer_name ?? '—'} {r.modellname ?? '—'}
              </td>
              <td className="text-[var(--ink-2)]">{r.category_name ?? '—'}</td>
              <td className="kb-mono text-[12px] text-[var(--ink-3)]">
                {r.serial_number ?? '—'}
              </td>
              <td className="text-[var(--ink-2)]">{formatDe(r.created_at)}</td>
              <td>
                <Badge variant="reserv" withDot>{ageLabel(r.created_at)}</Badge>
              </td>
              {isAdmin && (
                <td className="text-right">
                  <Button asChild size="sm" variant="primary">
                    <Link href={`/inventory/${r.device_id}`}>Pflegen</Link>
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
