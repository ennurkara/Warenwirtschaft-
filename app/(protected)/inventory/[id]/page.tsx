import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DeviceForm } from '@/components/inventory/device-form'
import { MovementDialog } from '@/components/inventory/movement-dialog'
import { Badge } from '@/components/ui/badge'
import { formatDate, getConditionLabel } from '@/lib/utils'
import type { Device, Category, Profile, DeviceMovement } from '@/lib/types'

export default async function DeviceDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  const [{ data: device }, { data: categories }, { data: movements }] = await Promise.all([
    supabase.from('devices').select('*, category:categories(*)').eq('id', params.id).single(),
    supabase.from('categories').select('*').order('name'),
    supabase.from('device_movements')
      .select('*, profile:profiles(full_name)')
      .eq('device_id', params.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!device) notFound()

  const isAdmin = (profile as Profile)?.role === 'admin'
  const canMove = (profile as Profile)?.role !== 'viewer'

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{device.name}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {device.category?.name} · {getConditionLabel(device.condition)} · Menge: {device.quantity}
          </p>
        </div>
        {canMove && (
          <MovementDialog device={device as Device} />
        )}
      </div>

      {device.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={device.photo_url} alt={device.name} className="rounded-lg max-h-48 object-contain border" />
      )}

      {isAdmin && (
        <div>
          <h2 className="text-lg font-medium mb-4">Gerät bearbeiten</h2>
          <DeviceForm
            categories={(categories ?? []) as Category[]}
            device={device as Device}
            isAdmin={isAdmin}
          />
        </div>
      )}

      <div>
        <h2 className="text-lg font-medium mb-3">Bewegungshistorie</h2>
        {(movements ?? []).length === 0 ? (
          <p className="text-slate-500 text-sm">Keine Bewegungen aufgezeichnet.</p>
        ) : (
          <ul className="space-y-2">
            {(movements as DeviceMovement[]).map(m => (
              <li key={m.id} className="flex items-center gap-3 text-sm border rounded-md px-4 py-2 bg-white">
                <Badge variant={m.action === 'entnahme' ? 'destructive' : 'default'}>
                  {m.action === 'entnahme' ? 'Entnahme' : m.action === 'einlagerung' ? 'Einlagerung' : 'Defekt'}
                </Badge>
                <span>{m.quantity}x</span>
                <span className="text-slate-500">von {m.profile?.full_name}</span>
                <span className="ml-auto text-slate-400">{formatDate(m.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}