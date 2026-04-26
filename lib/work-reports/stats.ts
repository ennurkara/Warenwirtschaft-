import type { SupabaseClient } from '@supabase/supabase-js'

export interface ReportStats {
  today: number
  thisWeek: number
  thisMonth: number
  total: number
  drafts: number          // status='entwurf'
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function startOfWeek(d: Date): Date {
  // Montag als Wochenanfang (ISO)
  const day = d.getDay() // 0=So, 1=Mo
  const diff = (day + 6) % 7
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff)
  return start
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

async function countWithFilter(
  supabase: SupabaseClient,
  technicianId: string | null,
  fromIso: string | null = null,
  status: 'abgeschlossen' | 'entwurf' | null = 'abgeschlossen',
): Promise<number> {
  let q = supabase.from('work_reports').select('id', { count: 'exact', head: true })
  if (technicianId) q = q.eq('technician_id', technicianId)
  if (status) q = q.eq('status', status)
  if (fromIso) q = q.gte('completed_at', fromIso)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

/** Stats über alle Berichte (für Mitarbeiter/Admin) oder nur eigene (für Techniker). */
export async function fetchReportStats(
  supabase: SupabaseClient,
  technicianId: string | null,
  now: Date = new Date(),
): Promise<ReportStats> {
  const dayIso = startOfDay(now).toISOString()
  const weekIso = startOfWeek(now).toISOString()
  const monthIso = startOfMonth(now).toISOString()

  const [today, thisWeek, thisMonth, total, drafts] = await Promise.all([
    countWithFilter(supabase, technicianId, dayIso, 'abgeschlossen'),
    countWithFilter(supabase, technicianId, weekIso, 'abgeschlossen'),
    countWithFilter(supabase, technicianId, monthIso, 'abgeschlossen'),
    countWithFilter(supabase, technicianId, null, 'abgeschlossen'),
    countWithFilter(supabase, technicianId, null, 'entwurf'),
  ])

  return { today, thisWeek, thisMonth, total, drafts }
}
