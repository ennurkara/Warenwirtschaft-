import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchDevice } from '@/lib/inventory/queries'
import { DeviceForm } from '@/components/inventory/device-form'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency, getStatusLabel } from '@/lib/utils'
import { deriveDisplayStatus } from '@/lib/inventory/derive-status'
import type { Category, Profile, DeviceStatus } from '@/lib/types'

const STATUS_COLORS: Record<DeviceStatus, string> = {
  lager:        'bg-green-100 text-green-800',
  reserviert:   'bg-yellow-100 text-yellow-800',
  verkauft:     'bg-blue-100 text-blue-800',
  defekt:       'bg-red-100 text-red-800',
  ausgemustert: 'bg-slate-100 text-slate-800',
}

export default async function DeviceDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  const [device, { data: categories }] = await Promise.all([
    fetchDevice(supabase, params.id),
    supabase.from('categories').select('*').order('name'),
  ])

  if (!device) notFound()

  const isAdmin = (profile as Profile)?.role === 'admin'
  const displayStatus = deriveDisplayStatus(device)

  const modelName = device.model?.modellname ?? '—'
  const categoryName = device.model?.category?.name ?? '—'
  const manufacturerName = device.model?.manufacturer?.name ?? '—'
  const serialDisplay = device.kassen_details?.hw_serial ?? device.serial_number ?? '—'
  const ek = device.purchase_item ? formatCurrency(Number(device.purchase_item.ek_preis)) : null
  const vk = device.sale_item ? formatCurrency(Number(device.sale_item.vk_preis)) : null

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{modelName}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {categoryName} · {manufacturerName}
          </p>
        </div>
        <Badge className={STATUS_COLORS[displayStatus]}>
          {getStatusLabel(displayStatus)}
        </Badge>
      </div>

      {device.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={device.photo_url} alt={modelName} className="rounded-lg max-h-48 object-contain border" />
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 rounded-md border bg-white p-4 text-sm">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Seriennummer</p>
          <p className="font-mono">{serialDisplay}</p>
        </div>
        {device.kassen_details?.sw_serial && (
          <div>
            <p className="text-xs text-slate-500 mb-0.5">SW-SN</p>
            <p className="font-mono">{device.kassen_details.sw_serial}</p>
          </div>
        )}
        {device.kassen_details?.tse_serial && (
          <div>
            <p className="text-xs text-slate-500 mb-0.5">TSE-SN</p>
            <p className="font-mono">{device.kassen_details.tse_serial}</p>
          </div>
        )}
        {device.kassen_details?.tse_valid_until && (
          <div>
            <p className="text-xs text-slate-500 mb-0.5">TSE gültig bis</p>
            <p>{formatDate(device.kassen_details.tse_valid_until)}</p>
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

      {isAdmin && (
        <div>
          <h2 className="text-lg font-medium mb-4">Gerät bearbeiten</h2>
          <DeviceForm
            categories={(categories ?? []) as Category[]}
            device={device}
            isAdmin={isAdmin}
          />
        </div>
      )}
    </div>
  )
}
