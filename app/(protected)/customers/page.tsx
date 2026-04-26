import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { CustomerKindTabs } from '@/components/customers/customer-kind-tabs'
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

const VALID_KINDS: ReadonlyArray<CustomerKind> = ['vectron', 'apro', 'sonstige']

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { kind?: string }
}) {
  const supabase = await createClient()
  const kindParam = searchParams.kind
  const kindFilter = VALID_KINDS.includes(kindParam as CustomerKind)
    ? (kindParam as CustomerKind)
    : null

  let query = supabase.from('customers').select('*').order('name', { ascending: true })
  if (kindFilter) query = query.eq('customer_kind', kindFilter)
  const { data, error } = await query
  if (error) throw error
  const customers = (data ?? []) as Customer[]

  return (
    <div className="max-w-[1100px] mx-auto space-y-[18px]">
      <div className="flex items-end justify-between gap-4 flex-wrap pb-4 border-b border-[var(--rule-soft)]">
        <div>
          <div className="kb-label mb-1.5">Kundenkartei</div>
          <h1 className="kb-h1">Kunden</h1>
        </div>
        <CustomerKindTabs />
      </div>

      <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
        {customers.length === 0 ? (
          <div className="px-[18px] py-6 text-[13px] text-[var(--ink-3)]">
            Keine Kunden in dieser Gruppe.
          </div>
        ) : (
          <div className="divide-y divide-[var(--rule-soft)]">
            {customers.map(c => (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="px-[18px] py-3 grid grid-cols-[1fr_auto_auto] gap-4 items-center hover:bg-[var(--paper-2)] transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium text-[var(--ink)] truncate">{c.name}</div>
                  {(c.address || c.city) && (
                    <div className="text-[12px] text-[var(--ink-3)] truncate">
                      {[c.address, [c.postal_code, c.city].filter(Boolean).join(' ')]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}
                </div>
                <div className="text-[12.5px] text-[var(--ink-3)] hidden md:block">
                  {c.email || c.phone || '—'}
                </div>
                <Badge variant={KIND_VARIANT[c.customer_kind]} withDot>
                  {KIND_LABEL[c.customer_kind]}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
