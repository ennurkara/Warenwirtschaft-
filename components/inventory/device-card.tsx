import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { CategoryIcon } from '@/components/inventory/category-icon'
import { getStatusLabel, formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { deriveDisplayStatus } from '@/lib/inventory/derive-status'
import type { Device, DeviceStatus } from '@/lib/types'

const STATUS_COLORS: Record<DeviceStatus, string> = {
  lager:        'bg-green-100 text-green-800',
  reserviert:   'bg-yellow-100 text-yellow-800',
  verkauft:     'bg-blue-100 text-blue-800',
  defekt:       'bg-red-100 text-red-800',
  ausgemustert: 'bg-slate-100 text-slate-800',
}

interface DeviceCardProps {
  device: Device
}

export function DeviceCard({ device }: DeviceCardProps) {
  const displayStatus = deriveDisplayStatus(device)
  const categoryIcon = device.model?.category?.icon ?? null
  const ek = device.purchase_item ? formatCurrency(Number(device.purchase_item.ek_preis)) : null
  const vk = device.sale_item ? formatCurrency(Number(device.sale_item.vk_preis)) : null

  return (
    <Link href={`/inventory/${device.id}`}>
      <div className="flex items-center gap-3 p-3 bg-card rounded-lg border hover:bg-slate-50 transition-colors">
        <div className="flex-shrink-0 h-9 w-9 rounded-md bg-slate-100 flex items-center justify-center">
          <CategoryIcon name={categoryIcon} className="h-5 w-5 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-sm">{device.model?.modellname ?? '—'}</p>
          <p className="text-xs text-muted-foreground truncate">
            {device.model?.category?.name ?? '—'} · {device.serial_number ?? '—'}
          </p>
          {(ek || vk) && (
            <p className="text-xs text-slate-400 truncate">
              {ek && <>EK: {ek}</>}{ek && vk && ' · '}{vk && <>VK: {vk}</>}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge className={cn('text-xs', STATUS_COLORS[displayStatus])}>
            {getStatusLabel(displayStatus)}
          </Badge>
          {device.location && (
            <span className="text-xs text-slate-500 truncate max-w-[80px]">{device.location}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
