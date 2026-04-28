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
          {isAdmin && <AddLicenseDialog customerId={customerId} />}
        </div>
      </div>
      {licenses.length === 0 ? (
        <div className="px-[18px] py-4 text-[13px] text-[var(--ink-3)]">
          {isAdmin
            ? 'Keine Lizenzen erfasst — über „Lizenz hinzufügen" aus dem Apro-Katalog wählen.'
            : 'Keine Lizenzen erfasst.'}
        </div>
      ) : (
        <div className="divide-y divide-[var(--rule-soft)]">
          {licenses.map(l => {
            const q = l.quantity ?? 1
            const a = l.assigned ?? 0
            const remaining = q - a
            return (
              <div key={l.id} className="px-[18px] py-3 grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-3 items-center">
                <div
                  className={`shrink-0 inline-flex items-center justify-center min-w-[34px] h-[26px] rounded-md font-mono tabular-nums text-[13px] font-semibold ${
                    q > 1 ? 'bg-[var(--blue-tint)] text-[var(--blue)]' : 'bg-[var(--paper-3)] text-[var(--ink-2)]'
                  }`}
                  title={`Lizenzmenge: ${q} · vergeben: ${a} · verbleibend: ${remaining}`}
                >
                  {q}×
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium text-[var(--ink)] truncate">{l.name}</div>
                  <div className="text-[11.5px] text-[var(--ink-3)] truncate">
                    {a > 0 || q > 1 ? <>vergeben {a} · verbleibend {remaining}</> : null}
                    {l.license_key && (
                      <span className="ml-2 font-mono">{l.license_key}</span>
                    )}
                  </div>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
