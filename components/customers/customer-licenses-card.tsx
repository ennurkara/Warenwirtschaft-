import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { License, LicenseStatus } from '@/lib/types'
import { AddLicenseDialog } from './add-license-dialog'
import { DeleteLicenseButton } from './delete-license-button'

const STATUS_VARIANT: Record<LicenseStatus, 'lager' | 'reserv' | 'aus'> = {
  aktiv: 'lager',
  gekuendigt: 'reserv',
  abgelaufen: 'aus',
}

export function CustomerLicensesCard({
  customerId,
  licenses,
  isAdmin,
}: {
  customerId: string
  licenses: License[]
  isAdmin: boolean
}) {
  const monthlyTotal = licenses
    .filter(l => l.status === 'aktiv')
    .reduce((sum, l) => sum + (l.monthly_update_fee !== null ? Number(l.monthly_update_fee) : 0), 0)

  const vkTotal = licenses
    .filter(l => l.status === 'aktiv')
    .reduce((sum, l) => sum + (l.vk_preis !== null ? Number(l.vk_preis) : 0), 0)

  return (
    <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="kb-sec-head flex items-center justify-between gap-3">
        <h3>Apro-Lizenzen + Update-Gebühren</h3>
        <div className="flex items-center gap-3">
          {licenses.length > 0 && (
            <span className="text-[12.5px] text-[var(--ink-3)]">
              VK einmalig:{' '}
              <span className="font-mono tabular-nums text-[var(--ink)] font-medium">
                {formatCurrency(vkTotal)}
              </span>
              {' · '}
              Monatlich:{' '}
              <span className="font-mono tabular-nums text-[var(--ink)] font-medium">
                {formatCurrency(monthlyTotal)}
              </span>
            </span>
          )}
          <AddLicenseDialog customerId={customerId} />
        </div>
      </div>
      {licenses.length === 0 ? (
        <div className="px-[18px] py-4 text-[13px] text-[var(--ink-3)]">
          Keine Lizenzen erfasst — über „Lizenz hinzufügen" aus dem Apro-Katalog wählen.
        </div>
      ) : (
        <div className="divide-y divide-[var(--rule-soft)]">
          {licenses.map(l => (
            <div key={l.id} className="px-[18px] py-3 grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center">
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium text-[var(--ink)] truncate">{l.name}</div>
                {l.license_key && (
                  <div className="text-[12px] text-[var(--ink-3)] font-mono truncate">{l.license_key}</div>
                )}
              </div>
              <div className="text-[12.5px] text-[var(--ink-3)]">
                {l.purchased_at ? formatDate(l.purchased_at) : '—'}
              </div>
              <div className="text-[12.5px] text-[var(--ink-2)] font-mono tabular-nums" title="VK einmalig">
                {l.vk_preis !== null ? formatCurrency(Number(l.vk_preis)) : '—'}
              </div>
              <div className="text-[12.5px] text-[var(--ink-2)] font-mono tabular-nums" title="Update-Gebühr / Monat">
                {l.monthly_update_fee !== null ? `${formatCurrency(Number(l.monthly_update_fee))}/M` : '—'}
              </div>
              <Badge variant={STATUS_VARIANT[l.status]} withDot>{l.status}</Badge>
              {isAdmin
                ? <DeleteLicenseButton licenseId={l.id} licenseName={l.name} />
                : <span className="w-[26px]" aria-hidden />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
