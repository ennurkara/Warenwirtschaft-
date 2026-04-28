import { Badge } from '@/components/ui/badge'
import { DetailField } from './detail-field'
import { formatDate } from '@/lib/utils'
import type { Customer, CustomerKind } from '@/lib/types'

const KIND_LABEL: Record<CustomerKind, string> = {
  vectron: 'Vectron',
  apro: 'Apro',
  sonstige: 'Sonstige',
}

const KIND_VARIANT: Record<CustomerKind, 'verkauft' | 'reserv' | 'default'> = {
  vectron: 'verkauft',
  apro: 'reserv',
  sonstige: 'default',
}

const ACTIVE_THRESHOLD_DAYS = 30

function contractActivity(lastHeartbeat: string | null): { label: string; tone: 'green' | 'amber' | 'grey' } {
  if (!lastHeartbeat) return { label: 'Nie online', tone: 'grey' }
  const days = Math.round((Date.now() - Date.parse(lastHeartbeat)) / (24 * 3600 * 1000))
  if (days <= ACTIVE_THRESHOLD_DAYS) return { label: `Aktiv (zuletzt vor ${days} Tagen)`, tone: 'green' }
  return { label: `Offline seit ${days} Tagen`, tone: 'amber' }
}

const TONE_CLASS = {
  green: 'bg-[var(--green-tint)] text-[var(--green)]',
  amber: 'bg-[var(--amber-tint)] text-[var(--amber)]',
  grey:  'bg-[var(--paper-3)] text-[var(--ink-3)]',
}

export function CustomerStammdatenCard({ customer }: { customer: Customer }) {
  const isVectron = customer.customer_kind === 'vectron'
  const activity = isVectron ? contractActivity(customer.last_heartbeat_at) : null

  return (
    <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="kb-sec-head flex items-center justify-between">
        <h3>Stammdaten</h3>
        <div className="flex items-center gap-2">
          {activity && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-medium ${TONE_CLASS[activity.tone]}`}>
              {activity.label}
            </span>
          )}
          <Badge variant={KIND_VARIANT[customer.customer_kind]} withDot>
            {KIND_LABEL[customer.customer_kind]}
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4 p-[18px]">
        <DetailField label="Name" value={customer.name || '—'} />
        <DetailField label="E-Mail" value={customer.email || '—'} />
        <DetailField label="Telefon" value={customer.phone || '—'} />
        <DetailField label="Straße + Nr." value={customer.address || '—'} />
        <DetailField label="PLZ" value={customer.postal_code || '—'} />
        <DetailField label="Ort" value={customer.city || '—'} />
        {(isVectron || customer.country) && (
          <DetailField label="Land" value={customer.country || 'DE'} />
        )}
        {(isVectron || customer.customer_number) && (
          <DetailField label="Kundennummer" value={customer.customer_number || '—'} mono />
        )}
        {(isVectron || customer.vat_id) && (
          <DetailField label="USt-IdNr." value={customer.vat_id || '—'} mono />
        )}
        {(isVectron || customer.tax_number) && (
          <DetailField label="Steuernummer" value={customer.tax_number || '—'} mono />
        )}
        {isVectron && customer.last_heartbeat_at && (
          <DetailField label="Letztes Heartbeat" value={formatDate(customer.last_heartbeat_at)} />
        )}
      </div>
      {customer.notes && (
        <div className="border-t border-[var(--rule-soft)] px-[18px] py-3 text-[13px] text-[var(--ink-2)] whitespace-pre-wrap">
          {customer.notes}
        </div>
      )}
    </div>
  )
}
