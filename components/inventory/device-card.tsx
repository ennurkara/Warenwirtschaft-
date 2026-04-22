import Link from 'next/link'
import { StatusBadge } from '@/components/ui/status-badge'
import { CategoryIcon } from '@/components/inventory/category-icon'
import { formatCurrency } from '@/lib/utils'
import { deriveDisplayStatus } from '@/lib/inventory/derive-status'
import type { Device } from '@/lib/types'

interface DeviceCardProps {
  device: Device
}

export function DeviceCard({ device }: DeviceCardProps) {
  const displayStatus = deriveDisplayStatus(device)
  const categoryIcon = device.model?.category?.icon ?? null
  const ek = device.purchase_item ? formatCurrency(Number(device.purchase_item.ek_preis)) : null
  const vk = device.sale_item ? formatCurrency(Number(device.sale_item.vk_preis)) : null

  return (
    <Link href={`/inventory/${device.id}`} className="block">
      <div className="flex items-center gap-3 p-3 bg-white rounded-kb border border-[var(--rule)] shadow-xs hover:border-[var(--blue-line)] hover:shadow-sm transition-all">
        <div className="flex-shrink-0 h-10 w-10 rounded-kb-sm bg-[var(--paper-2)] flex items-center justify-center">
          <CategoryIcon name={categoryIcon} className="h-[18px] w-[18px] text-[var(--ink-2)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-[13.5px] text-[var(--ink)]">
            {device.model?.modellname ?? '—'}
          </p>
          <p className="text-[11.5px] text-[var(--ink-3)] truncate">
            {device.model?.category?.name ?? '—'}
            {device.serial_number && (
              <>
                {' · '}
                <span className="font-mono">{device.serial_number}</span>
              </>
            )}
          </p>
          {(ek || vk) && (
            <p className="text-[11px] text-[var(--ink-4)] truncate tabular-nums">
              {ek && <>EK: {ek}</>}
              {ek && vk && ' · '}
              {vk && <>VK: {vk}</>}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <StatusBadge status={displayStatus} />
          {device.location && (
            <span className="text-[11px] text-[var(--ink-3)] truncate max-w-[90px]">
              {device.location}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
