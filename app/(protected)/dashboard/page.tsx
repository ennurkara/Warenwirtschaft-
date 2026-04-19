import { createClient } from '@/lib/supabase/server'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { DeviceMovement } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: totalDevices },
    { count: inStock },
    { count: defective },
    { data: recentMovements },
    { data: categories },
  ] = await Promise.all([
    supabase.from('devices').select('*', { count: 'exact', head: true }),
    supabase.from('devices').select('*', { count: 'exact', head: true }).eq('status', 'lager'),
    supabase.from('devices').select('*', { count: 'exact', head: true }).eq('status', 'defekt'),
    supabase.from('device_movements')
      .select('*, device:devices(name), profile:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('categories').select('id, name'),
  ])

  const stats = [
    { title: 'Geräte gesamt', value: totalDevices ?? 0, description: 'alle Einträge' },
    { title: 'Im Lager', value: inStock ?? 0, description: 'verfügbar' },
    { title: 'Defekt', value: defective ?? 0, description: 'benötigen Wartung' },
    { title: 'Kategorien', value: categories?.length ?? 0, description: 'Gerätetypen' },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <StatsCards stats={stats} />
      <div>
        <h2 className="text-lg font-medium mb-3">Letzte Bewegungen</h2>
        <div className="rounded-md border bg-white divide-y">
          {(recentMovements ?? []).length === 0 && (
            <p className="text-slate-500 text-sm p-6">Noch keine Bewegungen.</p>
          )}
          {(recentMovements as DeviceMovement[]).map(m => (
            <div key={m.id} className="flex items-center gap-4 px-4 py-3 text-sm">
              <Badge variant={m.action === 'entnahme' ? 'destructive' : 'default'}>
                {m.action === 'entnahme' ? 'Entnahme' : m.action === 'einlagerung' ? 'Einlagerung' : 'Defekt'}
              </Badge>
              <span>{m.device?.name}</span>
              <span className="text-slate-500">von {m.profile?.full_name}</span>
              <span className="ml-auto text-slate-400">{formatDate(m.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}