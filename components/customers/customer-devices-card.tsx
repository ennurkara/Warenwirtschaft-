import Link from 'next/link'
import { ShieldCheck, Cpu } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { Badge } from '@/components/ui/badge'
import { getTseAmpel, daysUntil, type TseAmpel } from '@/lib/tse/expiry'
import { formatDate } from '@/lib/utils'
import type { Device } from '@/lib/types'

const AMPEL_CLASS: Record<TseAmpel, string> = {
  rot:   'bg-[var(--red-tint)] text-[var(--red)]',
  gelb:  'bg-[var(--amber-tint)] text-[var(--amber)]',
  gruen: 'bg-[var(--green-tint)] text-[var(--green)]',
  grau:  'bg-[var(--paper-3)] text-[var(--ink-3)]',
}

function tseLabel(days: number | null, ampel: TseAmpel): string {
  if (ampel === 'grau') return 'Keine TSE'
  if (days === null) return '—'
  if (days < 0) return `Abgelaufen (vor ${Math.abs(days)} T.)`
  if (days === 0) return 'Läuft heute ab'
  return `Läuft in ${days} T. ab`
}

export function CustomerDevicesCard({ devices }: { devices: Device[] }) {
  // Kassen = devices in Kategorie "Kassenhardware"
  // TSE-Devices als Lookup, um die installierte TSE pro Kasse zu finden
  const kassen = devices.filter(d => d.model?.category?.name === 'Kassenhardware')
  const tses = devices.filter(d => d.model?.category?.name === 'TSE Swissbit')

  // Mapping kasse.id → TSE installiert in dieser Kasse (sucht in allen tse_details)
  const tseByKasse = new Map<string, Device>()
  for (const tse of tses) {
    if (tse.tse_details?.installed_in_device) {
      tseByKasse.set(tse.tse_details.installed_in_device, tse)
    }
  }

  if (kassen.length === 0 && tses.length === 0) {
    return (
      <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
        <div className="kb-sec-head"><h3>Kassen + TSE</h3></div>
        <div className="px-[18px] py-4 text-[13px] text-[var(--ink-3)]">
          Keine Geräte beim Kunden.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="kb-sec-head"><h3>Kassen + TSE</h3></div>
      <div className="divide-y divide-[var(--rule-soft)]">
        {kassen.map(kasse => {
          const tse = tseByKasse.get(kasse.id)
          const expires = tse?.tse_details?.expires_at ?? null
          const ampel = getTseAmpel(expires)
          const days = daysUntil(expires)
          return (
            <div key={kasse.id} className="px-[18px] py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Cpu className="h-4 w-4 text-[var(--ink-3)] shrink-0" />
                <div className="min-w-0">
                  <Link
                    href={`/inventory/${kasse.id}`}
                    className="text-[13.5px] font-medium text-[var(--ink)] hover:text-[var(--blue)] transition-colors truncate block"
                  >
                    {kasse.model?.modellname ?? '—'}
                  </Link>
                  <div className="text-[12px] text-[var(--ink-3)] font-mono truncate">
                    {kasse.serial_number ?? '—'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={kasse.status} />
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-medium ${AMPEL_CLASS[ampel]}`}
                  title={tse ? `TSE ${tse.serial_number ?? ''} · ${expires ? formatDate(expires) : ''}` : 'Keine TSE installiert'}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {tseLabel(days, ampel)}
                </div>
              </div>
            </div>
          )
        })}

        {/* TSEs, die beim Kunden sind aber in keine Kasse installiert (Lager beim Kunden / Bereitstellung) */}
        {tses
          .filter(t => !t.tse_details?.installed_in_device)
          .map(tse => {
            const expires = tse.tse_details?.expires_at ?? null
            const ampel = getTseAmpel(expires)
            const days = daysUntil(expires)
            return (
              <div key={tse.id} className="px-[18px] py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <ShieldCheck className="h-4 w-4 text-[var(--ink-3)] shrink-0" />
                  <div className="min-w-0">
                    <Link
                      href={`/inventory/${tse.id}`}
                      className="text-[13.5px] font-medium text-[var(--ink)] hover:text-[var(--blue)] transition-colors truncate block"
                    >
                      TSE — {tse.tse_details?.kind === 'usb' ? 'USB' : tse.tse_details?.kind === 'sd' ? 'SD' : '—'}
                    </Link>
                    <div className="text-[12px] text-[var(--ink-3)] font-mono truncate">
                      {tse.serial_number ?? '—'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline">Nicht installiert</Badge>
                  <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-medium ${AMPEL_CLASS[ampel]}`}>
                    {tseLabel(days, ampel)}
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
