import Link from 'next/link'
import { Building2, Cpu, MapPin, Phone, Mail, ShieldCheck } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate } from '@/lib/utils'
import { getTseAmpel, daysUntil, type TseAmpel } from '@/lib/tse/expiry'
import type { CustomerSite, Device } from '@/lib/types'

const ACTIVE_THRESHOLD_DAYS = 30

const HEARTBEAT_TONE = {
  green: 'bg-[var(--green-tint)] text-[var(--green)]',
  amber: 'bg-[var(--amber-tint)] text-[var(--amber)]',
  grey:  'bg-[var(--paper-3)] text-[var(--ink-3)]',
}

const TSE_AMPEL_CLASS: Record<TseAmpel, string> = {
  rot:   'bg-[var(--red-tint)] text-[var(--red)]',
  gelb:  'bg-[var(--amber-tint)] text-[var(--amber)]',
  gruen: 'bg-[var(--green-tint)] text-[var(--green)]',
  grau:  'bg-[var(--paper-3)] text-[var(--ink-3)]',
}

function heartbeatBadge(ts: string | null): { label: string; tone: 'green' | 'amber' | 'grey' } {
  if (!ts) return { label: 'Nie online', tone: 'grey' }
  const days = Math.round((Date.now() - Date.parse(ts)) / (24 * 3600 * 1000))
  if (days <= ACTIVE_THRESHOLD_DAYS) return { label: 'Online', tone: 'green' }
  return { label: `Offline ${days}d`, tone: 'amber' }
}

function siteAddressLine(site: CustomerSite): string {
  return [site.street, [site.postal_code, site.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' · ')
}

export function CustomerSitesCard({ sites, devices }: { sites: CustomerSite[]; devices: Device[] }) {
  if (sites.length === 0) return null

  // Kassen je Site gruppieren; TSE als Lookup
  const tseByKasse = new Map<string, Device>()
  for (const d of devices) {
    if (d.model?.category?.name === 'TSE Swissbit' && d.tse_details?.installed_in_device) {
      tseByKasse.set(d.tse_details.installed_in_device, d)
    }
  }
  const kassenBySite = new Map<string, Device[]>()
  for (const d of devices) {
    if (d.model?.category?.name !== 'Kassenhardware') continue
    if (!d.site_id) continue
    if (!kassenBySite.has(d.site_id)) kassenBySite.set(d.site_id, [])
    kassenBySite.get(d.site_id)!.push(d)
  }

  return (
    <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="kb-sec-head flex items-center justify-between">
        <h3>Filialen</h3>
        <span className="text-[11px] text-[var(--ink-3)]">{sites.length}</span>
      </div>
      <div className="divide-y divide-[var(--rule-soft)]">
        {sites
          .slice()
          .sort((a, b) => (a.site_no ?? a.name).localeCompare(b.site_no ?? b.name, 'de'))
          .map((site) => {
            const kassen = kassenBySite.get(site.id) ?? []
            return (
              <details key={site.id} className="group" open={sites.length <= 3}>
                <summary className="cursor-pointer list-none px-[18px] py-3 flex items-center justify-between gap-4 hover:bg-[var(--paper-2)]/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="h-4 w-4 text-[var(--ink-3)] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium text-[var(--ink)] truncate">{site.name}</div>
                      <div className="text-[12px] text-[var(--ink-3)] truncate flex items-center gap-2">
                        {site.site_no && <span className="font-mono">{site.site_no}</span>}
                        {siteAddressLine(site) && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {siteAddressLine(site)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[12px] text-[var(--ink-3)]">
                      {kassen.length} {kassen.length === 1 ? 'Kasse' : 'Kassen'}
                    </span>
                    <span className="text-[11px] text-[var(--ink-3)] group-open:rotate-180 transition-transform">▾</span>
                  </div>
                </summary>

                <div className="px-[18px] pb-3 pt-1 space-y-2">
                  {(site.email || site.phone) && (
                    <div className="flex items-center gap-4 text-[12px] text-[var(--ink-3)]">
                      {site.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {site.email}
                        </span>
                      )}
                      {site.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {site.phone}
                        </span>
                      )}
                    </div>
                  )}

                  {kassen.length === 0 ? (
                    <div className="text-[12px] text-[var(--ink-3)] italic ml-7">Keine Kassen in dieser Filiale.</div>
                  ) : (
                    <div className="ml-7 space-y-2">
                      {kassen.map((kasse) => {
                        const vd = kasse.vectron_details
                        const tse = tseByKasse.get(kasse.id)
                        const expires = tse?.tse_details?.expires_at ?? null
                        const ampel = getTseAmpel(expires)
                        const days = daysUntil(expires)
                        const hb = heartbeatBadge(vd?.last_heartbeat_at ?? null)
                        return (
                          <div key={kasse.id} className="rounded-md border border-[var(--rule-soft)] bg-[var(--paper-2)]/40">
                            <div className="px-3 py-2 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Cpu className="h-3.5 w-3.5 text-[var(--ink-3)] shrink-0" />
                                <Link
                                  href={`/inventory/${kasse.id}`}
                                  className="min-w-0 hover:text-[var(--blue)] transition-colors"
                                >
                                  <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">
                                    {kasse.model?.modellname ?? '—'}
                                    {vd?.platform && (
                                      <span className="ml-1.5 text-[var(--ink-3)] font-normal">· {vd.platform}</span>
                                    )}
                                  </div>
                                  <div className="text-[11.5px] text-[var(--ink-3)] font-mono truncate">
                                    S/N {kasse.serial_number ?? '—'}
                                    {vd?.sw_version && <span className="ml-2">SW {vd.sw_version}</span>}
                                    {vd?.os_version && <span className="ml-2">OS {vd.os_version}</span>}
                                  </div>
                                </Link>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-medium ${HEARTBEAT_TONE[hb.tone]}`}>
                                  {hb.label}
                                </span>
                                <StatusBadge status={kasse.status} />
                              </div>
                            </div>
                            {tse && (
                              <div className="border-t border-[var(--rule-soft)] px-3 py-1.5 flex items-center justify-between gap-3">
                                <Link
                                  href={`/inventory/${tse.id}`}
                                  className="flex items-center gap-2 min-w-0 hover:text-[var(--blue)] transition-colors"
                                >
                                  <ShieldCheck className="h-3 w-3 text-[var(--ink-3)] shrink-0" />
                                  <span className="text-[11.5px] text-[var(--ink-2)] truncate">
                                    TSE {tse.tse_details?.kind?.toUpperCase()}
                                    <span className="ml-1.5 font-mono text-[var(--ink-3)]">{tse.serial_number}</span>
                                  </span>
                                </Link>
                                <div className="flex items-center gap-2 shrink-0">
                                  {expires && (
                                    <span className="text-[11px] text-[var(--ink-3)] tabular-nums">
                                      {formatDate(expires)}
                                    </span>
                                  )}
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10.5px] font-medium ${TSE_AMPEL_CLASS[ampel]}`}>
                                    {ampel === 'grau' ? 'Keine TSE' :
                                     days === null ? '—' :
                                     days < 0 ? `${Math.abs(days)}d abgelaufen` :
                                     days === 0 ? 'läuft heute ab' :
                                     `${days}d`}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </details>
            )
          })}
      </div>
    </div>
  )
}
