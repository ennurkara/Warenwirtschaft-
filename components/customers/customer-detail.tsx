import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CustomerStammdatenCard } from './customer-stammdaten-card'
import { CustomerDevicesCard } from './customer-devices-card'
import { CustomerContractCard } from './customer-contract-card'
import { CustomerLicensesCard } from './customer-licenses-card'
import { CustomerWorkReportsCard } from './customer-work-reports-card'
import type { CustomerDetail as CustomerDetailModel } from '@/lib/customers/queries'

export function CustomerDetail({ customer }: { customer: CustomerDetailModel }) {
  return (
    <div className="max-w-[1100px] mx-auto space-y-[18px]">
      <div className="flex flex-col gap-3 pb-4 mb-1 border-b border-[var(--rule-soft)]">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zu den Kunden
        </Link>
        <div>
          <div className="kb-label mb-1.5">Kundenkartei</div>
          <h1 className="kb-h1">{customer.name}</h1>
          {(customer.address || customer.city) && (
            <div className="text-[13px] text-[var(--ink-3)] mt-1">
              {[customer.address, [customer.postal_code, customer.city].filter(Boolean).join(' ')]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
        </div>
      </div>

      <CustomerStammdatenCard customer={customer} />

      <CustomerContractCard customerKind={customer.customer_kind} contracts={customer.contracts} />

      <CustomerDevicesCard devices={customer.devices} />

      {customer.customer_kind === 'apro' && (
        <CustomerLicensesCard customerId={customer.id} licenses={customer.licenses} />
      )}

      <CustomerWorkReportsCard reports={customer.work_reports} />
    </div>
  )
}
