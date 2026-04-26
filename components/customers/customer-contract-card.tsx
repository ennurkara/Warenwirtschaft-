import { FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DetailField } from './detail-field'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Contract, ContractKind, CustomerKind } from '@/lib/types'

const KIND_LABEL: Record<ContractKind, string> = {
  myvectron:    'MyVectron — Digitalpaket',
  smart4pay:    'Vectron Smart 4 Pay',
  apro_updates: 'Apro — Update-Service',
}

export function CustomerContractCard({
  customerKind,
  contracts,
}: {
  customerKind: CustomerKind
  contracts: Contract[]
}) {
  // Vertrags-Karte ist Vectron-only (MyVectron / Smart 4 Pay).
  // Apro-Kunden zahlen Update-Gebühren pro Lizenz, kein Rahmenvertrag.
  if (customerKind !== 'vectron') return null

  const active = contracts.find(c => c.status === 'aktiv') ?? null
  const history = contracts.filter(c => c.status !== 'aktiv')

  return (
    <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="kb-sec-head"><h3>Vertrag</h3></div>

      {active ? (
        <div className="p-[18px] space-y-4">
          <div className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-[var(--blue)]" />
            <span className="text-[13.5px] font-medium text-[var(--ink)]">
              {KIND_LABEL[active.kind]}
            </span>
            <Badge variant="lager" withDot>aktiv</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
            <DetailField label="Beginn" value={formatDate(active.start_date)} />
            <DetailField
              label="Ende"
              value={active.end_date ? formatDate(active.end_date) : 'unbefristet'}
            />
            <DetailField
              label="Monatlich"
              value={active.monthly_fee !== null ? formatCurrency(Number(active.monthly_fee)) : '—'}
              mono
            />
            {active.kind === 'smart4pay' && (
              <DetailField
                label="EC-Gerät"
                value={
                  active.ec_device
                    ? `${active.ec_device.model?.modellname ?? '—'} · ${active.ec_device.serial_number ?? '—'}`
                    : 'nicht zugeordnet'
                }
              />
            )}
          </div>
          {active.notes && (
            <div className="text-[13px] text-[var(--ink-2)] whitespace-pre-wrap pt-2 border-t border-[var(--rule-soft)]">
              {active.notes}
            </div>
          )}
        </div>
      ) : (
        <div className="px-[18px] py-4 text-[13px] text-[var(--ink-3)]">
          Kein aktiver Vertrag.
        </div>
      )}

      {history.length > 0 && (
        <div className="border-t border-[var(--rule-soft)] px-[18px] py-3">
          <div className="kb-label mb-2">Historie</div>
          <ul className="space-y-1.5">
            {history.map(c => (
              <li key={c.id} className="text-[12.5px] text-[var(--ink-3)] flex items-center gap-2">
                <span className="font-medium text-[var(--ink-2)]">{KIND_LABEL[c.kind]}</span>
                <span>·</span>
                <span>{formatDate(c.start_date)} – {c.end_date ? formatDate(c.end_date) : '—'}</span>
                <span>·</span>
                <span>{c.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
