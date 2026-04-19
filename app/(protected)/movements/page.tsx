import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { DeviceMovement } from '@/lib/types'

export default async function MovementsPage() {
  const supabase = await createClient()

  const { data: movements } = await supabase
    .from('device_movements')
    .select('*, device:devices(name), profile:profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Bewegungshistorie</h1>
      <div className="rounded-md border bg-white divide-y">
        {(movements ?? []).length === 0 && (
          <p className="text-slate-500 text-sm p-6">Keine Bewegungen vorhanden.</p>
        )}
        {(movements as DeviceMovement[]).map(m => (
          <div key={m.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
            <Badge variant={m.action === 'entnahme' ? 'destructive' : 'default'} className="self-start sm:self-auto">
              {m.action === 'entnahme' ? 'Entnahme' : m.action === 'einlagerung' ? 'Einlagerung' : 'Defekt'}
            </Badge>
            <span className="font-medium">{m.device?.name}</span>
            <span className="text-slate-500">{m.quantity}x</span>
            <span className="text-slate-500">von {m.profile?.full_name}</span>
            {m.note && <span className="text-slate-400 italic">&ldquo;{m.note}&rdquo;</span>}
            <span className="sm:ml-auto text-slate-400">{formatDate(m.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}