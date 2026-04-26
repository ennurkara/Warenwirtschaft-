import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchAllTseSortedByExpiry } from '@/lib/tse/queries'
import { getTseAmpel, daysUntil, type TseAmpel } from '@/lib/tse/expiry'
import { formatDate } from '@/lib/utils'

const AMPEL_CLASS: Record<TseAmpel, string> = {
  rot:   'bg-[var(--red-tint)] text-[var(--red)]',
  gelb:  'bg-[var(--amber-tint)] text-[var(--amber)]',
  gruen: 'bg-[var(--green-tint)] text-[var(--green)]',
  grau:  'bg-[var(--paper-3)] text-[var(--ink-3)]',
}

function expiryLabel(days: number | null, ampel: TseAmpel): string {
  if (ampel === 'grau' || days === null) return 'kein Ablaufdatum'
  if (days < 0) return `vor ${Math.abs(days)} Tagen abgelaufen`
  if (days === 0) return 'läuft heute ab'
  return `in ${days} Tagen`
}

export default async function TseExpiryPage() {
  const supabase = await createClient()
  const rows = await fetchAllTseSortedByExpiry(supabase)

  const total = rows.length
  const rot = rows.filter(r => getTseAmpel(r.expires_at) === 'rot').length
  const gelb = rows.filter(r => getTseAmpel(r.expires_at) === 'gelb').length

  return (
    <div className="max-w-[1100px] mx-auto space-y-[18px]">
      <div className="flex flex-col gap-3 pb-4 mb-1 border-b border-[var(--rule-soft)]">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zum Dashboard
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="kb-label mb-1.5 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              TSE-Module
            </div>
            <h1 className="kb-h1">Ablauf-Übersicht</h1>
            <p className="text-[13px] text-[var(--ink-3)] mt-1">
              {total} TSE gesamt · <span className="text-[var(--red)] font-medium">{rot} rot</span> (&lt; 60 T.) ·
              {' '}<span className="text-[var(--amber)] font-medium">{gelb} gelb</span> (&lt; 180 T.)
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-[18px] py-6 text-[13px] text-[var(--ink-3)]">
            Keine TSE-Module im System.
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
                  className="px-[18px] py-3 grid grid-cols-[1.4fr_1fr_auto_auto] gap-4 items-center hover:bg-[var(--paper-2)] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium text-[var(--ink)] truncate">
                      TSE · {kind}
                      <span className="ml-2 font-mono text-[12.5px] text-[var(--ink-3)]">
                        {r.tse_serial ?? '—'}
                      </span>
                    </div>
                    {r.bsi_k_tr_number && (
                      <div className="text-[11.5px] text-[var(--ink-4)] font-mono">
                        {r.bsi_k_tr_number}
                      </div>
                    )}
                  </div>
                  <div className="text-[12.5px] text-[var(--ink-2)] truncate">
                    {r.customer_name ?? <span className="text-[var(--ink-4)]">— kein Kunde —</span>}
                    {r.kasse_modell && (
                      <div className="text-[11.5px] text-[var(--ink-4)]">
                        in {r.kasse_modell}{r.kasse_serial ? ` (${r.kasse_serial})` : ''}
                      </div>
                    )}
                  </div>
                  <div className="text-[12px] text-[var(--ink-3)] tabular-nums">
                    {r.expires_at ? formatDate(r.expires_at) : '—'}
                  </div>
                  <div className={`inline-flex items-center rounded-full px-2.5 py-[2px] text-[11.5px] font-medium ${AMPEL_CLASS[ampel]}`}>
                    {expiryLabel(days, ampel)}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
