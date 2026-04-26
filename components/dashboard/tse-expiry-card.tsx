import Link from 'next/link'
import { ShieldCheck, ArrowRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { getTseAmpel, daysUntil, type TseAmpel } from '@/lib/tse/expiry'
import type { TseExpiryRow } from '@/lib/tse/queries'

const AMPEL_CLASS: Record<TseAmpel, string> = {
  rot:   'bg-[var(--red-tint)] text-[var(--red)]',
  gelb:  'bg-[var(--amber-tint)] text-[var(--amber)]',
  gruen: 'bg-[var(--green-tint)] text-[var(--green)]',
  grau:  'bg-[var(--paper-3)] text-[var(--ink-3)]',
}

function expiryLabel(days: number | null, ampel: TseAmpel): string {
  if (ampel === 'grau' || days === null) return '—'
  if (days < 0) return `vor ${Math.abs(days)} T. abgelaufen`
  if (days === 0) return 'läuft heute ab'
  return `in ${days} T.`
}

export function TseExpiryCard({ rows }: { rows: TseExpiryRow[] }) {
  return (
    <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="kb-sec-head flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[var(--ink-3)]" />
          <h3>TSE-Module — nächste Abläufe</h3>
        </div>
        <Link
          href="/tse-expiry"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--blue)] hover:text-[var(--blue-ink)]"
        >
          Alle anzeigen
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="px-[18px] py-4 text-[13px] text-[var(--ink-3)]">
          Keine TSE mit gepflegtem Ablaufdatum.
        </div>
      ) : (
        <div className="divide-y divide-[var(--rule-soft)]">
          {rows.map(r => {
            const ampel = getTseAmpel(r.expires_at)
            const days = daysUntil(r.expires_at)
            const kind = r.kind === 'usb' ? 'USB' : 'microSD'
            return (
              <Link
                key={r.device_id}
                href={`/inventory/${r.device_id}`}
                className="px-[18px] py-3 grid grid-cols-[1fr_auto_auto] gap-3 items-center hover:bg-[var(--paper-2)] transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium text-[var(--ink)] truncate">
                    TSE · {kind}
                    <span className="ml-2 font-mono text-[12.5px] text-[var(--ink-3)]">
                      {r.tse_serial ?? '—'}
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--ink-3)] truncate">
                    {r.customer_name
                      ? `Kunde: ${r.customer_name}`
                      : 'Kein Kunde zugeordnet'}
                    {r.kasse_modell && ` · in ${r.kasse_modell}${r.kasse_serial ? ' (' + r.kasse_serial + ')' : ''}`}
                  </div>
                </div>
                <div className="text-[12px] text-[var(--ink-3)] tabular-nums">
                  {r.expires_at ? formatDate(r.expires_at) : '—'}
                </div>
                <div
                  className={`inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-medium ${AMPEL_CLASS[ampel]}`}
                >
                  {expiryLabel(days, ampel)}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
