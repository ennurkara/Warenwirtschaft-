import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchDevice } from '@/lib/inventory/queries'
import { SellDialog } from '@/components/inventory/sell-dialog'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency, getStatusLabel } from '@/lib/utils'
import { deriveDisplayStatus } from '@/lib/inventory/derive-status'
import type { DeviceStatus } from '@/lib/types'

const STATUS_COLORS: Record<DeviceStatus, string> = {
  lager:        'bg-green-100 text-green-800',
  reserviert:   'bg-yellow-100 text-yellow-800',
  verkauft:     'bg-blue-100 text-blue-800',
  defekt:       'bg-red-100 text-red-800',
  ausgemustert: 'bg-slate-100 text-slate-800',
}

export default async function DeviceDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const device = await fetchDevice(supabase, params.id)
  if (!device) notFound()

  const displayStatus = deriveDisplayStatus(device)

  const modelName = device.model?.modellname ?? '—'
  const categoryName = device.model?.category?.name ?? '—'
  const manufacturerName = device.model?.manufacturer?.name ?? '—'
  const serialDisplay = device.serial_number ?? '—'
  const ek = device.purchase_item ? formatCurrency(Number(device.purchase_item.ek_preis)) : null
  const vk = device.sale_item ? formatCurrency(Number(device.sale_item.vk_preis)) : null
  const v = device.vectron_details

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{modelName}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {categoryName} · {manufacturerName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!device.sale_item && (device.status === 'lager' || device.status === 'reserviert') && (
            <SellDialog deviceId={device.id} />
          )}
          <Badge className={STATUS_COLORS[displayStatus]}>
            {getStatusLabel(displayStatus)}
          </Badge>
        </div>
      </div>

      {device.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={device.photo_url} alt={modelName} className="rounded-lg max-h-48 object-contain border" />
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 rounded-md border bg-white p-4 text-sm">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Hardware-SN</p>
          <p className="font-mono">{serialDisplay}</p>
        </div>
        {v?.sw_serial && (
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Software-SN</p>
            <p className="font-mono">{v.sw_serial}</p>
          </div>
        )}
        {v && (
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Lizenz</p>
            <p>{v.license_type === 'full' ? 'Full' : 'Light'}</p>
          </div>
        )}
        {v && (
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Fiskal 2020</p>
            <p>{v.fiskal_2020 ? 'Ja' : 'Nein'}</p>
          </div>
        )}
        {v && (
          <div>
            <p className="text-xs text-slate-500 mb-0.5">ZVT</p>
            <p>{v.zvt ? 'Ja' : 'Nein'}</p>
          </div>
        )}
        {ek && (
          <div>
            <p className="text-xs text-slate-500 mb-0.5">EK</p>
            <p>{ek}</p>
          </div>
        )}
        {vk && (
          <div>
            <p className="text-xs text-slate-500 mb-0.5">VK</p>
            <p>{vk}</p>
          </div>
        )}
        {device.location && (
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Standort</p>
            <p>{device.location}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Hinzugefügt</p>
          <p>{formatDate(device.created_at)}</p>
        </div>
      </div>

      {device.notes && (
        <div className="rounded-md border bg-white p-4 text-sm">
          <p className="text-xs text-slate-500 mb-1">Notizen</p>
          <p className="whitespace-pre-wrap">{device.notes}</p>
        </div>
      )}
    </div>
  )
}
