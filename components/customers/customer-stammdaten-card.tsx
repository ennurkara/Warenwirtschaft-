import { Badge } from '@/components/ui/badge'
import { DetailField } from './detail-field'
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

export function CustomerStammdatenCard({ customer }: { customer: Customer }) {
  return (
    <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="kb-sec-head flex items-center justify-between">
        <h3>Stammdaten</h3>
        <Badge variant={KIND_VARIANT[customer.customer_kind]} withDot>
          {KIND_LABEL[customer.customer_kind]}
        </Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4 p-[18px]">
        <DetailField label="Name" value={customer.name || '—'} />
        <DetailField label="E-Mail" value={customer.email || '—'} />
        <DetailField label="Telefon" value={customer.phone || '—'} />
        <DetailField label="Straße + Nr." value={customer.address || '—'} />
        <DetailField label="PLZ" value={customer.postal_code || '—'} />
        <DetailField label="Ort" value={customer.city || '—'} />
      </div>
      {customer.notes && (
        <div className="border-t border-[var(--rule-soft)] px-[18px] py-3 text-[13px] text-[var(--ink-2)] whitespace-pre-wrap">
          {customer.notes}
        </div>
      )}
    </div>
  )
}
