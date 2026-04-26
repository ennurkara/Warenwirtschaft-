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

function tseExpiryLabel(days: number | null, ampel: TseAmpel): string {
  if (ampel === 'grau') return 'Keine TSE'
  if (days === null) return '—'
  if (days < 0) return `abgelaufen vor ${Math.abs(days)} Tagen`
  if (days === 0) return 'läuft heute ab'
  return `läuft in ${days} Tagen ab`
}

function tseKindLabel(kind: string | null | undefined): string {
  if (kind === 'usb') return 'USB'
  if (kind === 'sd')  return 'microSD'
  return ''
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
      <div className="border-b border-[var(--rule-soft)] px-[18px] py-2.5 text-[12px] text-[var(--ink-3)] bg-[var(--paper-2)]/40">
        Pro Kasse wird die installierte TSE mit Art, Seriennummer und Ablaufdatum angezeigt.
        Ampel: <span className="text-[var(--green)] font-medium">grün</span> ≥ 180 Tage,
        {' '}<span className="text-[var(--amber)] font-medium">gelb</span> &lt; 180 Tage,
        {' '}<span className="text-[var(--red)] font-medium">rot</span> &lt; 60 Tage oder bereits abgelaufen.
      </div>
      <div className="divide-y divide-[var(--rule-soft)]">
        {kassen.map(kasse => {
          const tse = tseByKasse.get(kasse.id)
          const expires = tse?.tse_details?.expires_at ?? null
          const ampel = getTseAmpel(expires)
          const days = daysUntil(expires)
          const tseKind = tseKindLabel(tse?.tse_details?.kind)
          return (
            <div key={kasse.id} className="px-[18px] py-3 space-y-2">
              {/* Kasse-Zeile */}
              <div className="flex items-center justify-between gap-4">
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
                <StatusBadge status={kasse.status} />
              </div>

              {/* TSE-Zeile, eingerückt unter der Kasse */}
              <div className="ml-7 flex items-center justify-between gap-3 rounded-md border border-[var(--rule-soft)] bg-[var(--paper-2)]/50 px-3 py-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--ink-3)] shrink-0" />
                  {tse ? (
                    <Link
                      href={`/inventory/${tse.id}`}
                      className="min-w-0 hover:text-[var(--blue)] transition-colors"
                    >
                      <div className="text-[12.5px] font-medium text-[var(--ink-2)] truncate">
                        TSE{tseKind ? ` · ${tseKind}` : ''}
                      </div>
                      <div className="text-[11.5px] text-[var(--ink-3)] font-mono truncate">
                        {tse.serial_number ?? '—'}
                        {tse.tse_details?.bsi_k_tr_number && (
                          <span className="ml-2 text-[var(--ink-4)]">
                            · {tse.tse_details.bsi_k_tr_number}
                          </span>
                        )}
                      </div>
                    </Link>
                  ) : (
                    <div className="text-[12px] text-[var(--ink-3)] italic">Keine TSE installiert</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {expires && (
                    <div className="text-[11.5px] text-[var(--ink-3)] tabular-nums">
                      Ablauf <span className="font-medium text-[var(--ink-2)]">{formatDate(expires)}</span>
                    </div>
                  )}
                  <div
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-medium ${AMPEL_CLASS[ampel]}`}
                  >
                    {tseExpiryLabel(days, ampel)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* TSEs beim Kunden ohne Kassen-Zuordnung (z.B. neu geliefert, noch nicht installiert) */}
        {tses
          .filter(t => !t.tse_details?.installed_in_device)
          .map(tse => {
            const expires = tse.tse_details?.expires_at ?? null
            const ampel = getTseAmpel(expires)
            const days = daysUntil(expires)
            const tseKind = tseKindLabel(tse.tse_details?.kind)
            return (
              <div key={tse.id} className="px-[18px] py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <ShieldCheck className="h-4 w-4 text-[var(--ink-3)] shrink-0" />
                  <div className="min-w-0">
                    <Link
                      href={`/inventory/${tse.id}`}
                      className="text-[13.5px] font-medium text-[var(--ink)] hover:text-[var(--blue)] transition-colors truncate block"
                    >
                      TSE{tseKind ? ` · ${tseKind}` : ''}
                    </Link>
                    <div className="text-[12px] text-[var(--ink-3)] font-mono truncate">
                      {tse.serial_number ?? '—'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline">Nicht installiert</Badge>
                  {expires && (
                    <div className="text-[11.5px] text-[var(--ink-3)] tabular-nums">
                      Ablauf <span className="font-medium text-[var(--ink-2)]">{formatDate(expires)}</span>
                    </div>
                  )}
                  <div className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-medium ${AMPEL_CLASS[ampel]}`}>
                    {tseExpiryLabel(days, ampel)}
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
