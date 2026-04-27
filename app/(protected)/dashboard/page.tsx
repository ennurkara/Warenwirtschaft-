import { createClient } from '@/lib/supabase/server'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { RecentSales } from '@/components/dashboard/recent-sales'
import { TopModels } from '@/components/dashboard/top-models'
import { IncompleteDevices } from '@/components/dashboard/incomplete-devices'
import { TseExpiryCard } from '@/components/dashboard/tse-expiry-card'
import { AbStatsCard } from '@/components/dashboard/ab-stats-card'
import { RecentReportsCard, type RecentReportRow } from '@/components/dashboard/recent-reports-card'
import { TechnicianQuickActions } from '@/components/dashboard/technician-quick-actions'
import { fetchTseExpiringSoon } from '@/lib/tse/queries'
import { fetchReportStats } from '@/lib/work-reports/stats'

function formatGermanDate(d: Date): string {
  return d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

interface RawReportRow {
  id: string
  report_number: string | null
  status: 'entwurf' | 'abgeschlossen'
  start_time: string | null
  completed_at: string | null
  customer: { name: string | null } | null
  technician: { full_name: string | null } | null
}

async function fetchRecentReports(
  supabase: Awaited<ReturnType<typeof createClient>>,
  technicianId: string | null,
  limit = 5,
): Promise<RecentReportRow[]> {
  let q = supabase
    .from('work_reports')
    .select(`
      id, report_number, status, start_time, completed_at,
      customer:customers(name),
      technician:profiles!work_reports_technician_id_fkey(full_name)
    `)
    .eq('status', 'abgeschlossen')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (technicianId) q = q.eq('technician_id', technicianId)

  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as unknown as RawReportRow[]
  return rows.map(r => ({
    id: r.id,
    report_number: r.report_number,
    status: r.status,
    start_time: r.start_time,
    completed_at: r.completed_at,
    customer_name: r.customer?.name ?? null,
    technician_name: r.technician?.full_name ?? null,
  }))
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user!.id).single()
  const role = profile?.role as 'admin' | 'mitarbeiter' | 'techniker' | 'viewer' | undefined

  // Header (für alle Rollen gleich)
  const header = (
    <div className="flex flex-col gap-3 pb-4 mb-2 border-b border-[var(--rule-soft)]">
      <div>
        <div className="kb-label mb-1.5">Dashboard</div>
        <h1 className="kb-h1">{formatGermanDate(new Date())}</h1>
        {profile?.full_name && (
          <div className="text-[13px] text-[var(--ink-3)] mt-1">
            {profile.full_name}
          </div>
        )}
      </div>
    </div>
  )

  // ---- Techniker ---------------------------------------------------------
  if (role === 'techniker') {
    const [stats, recent, tse] = await Promise.all([
      fetchReportStats(supabase, user!.id),
      fetchRecentReports(supabase, user!.id, 5),
      fetchTseExpiringSoon(supabase, 5),
    ])
    return (
      <div className="max-w-[1280px] mx-auto space-y-[18px]">
        {header}
        <TechnicianQuickActions />
        <AbStatsCard stats={stats} scope="mine" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
          <RecentReportsCard rows={recent} scope="mine" />
          <TseExpiryCard rows={tse} />
        </div>
      </div>
    )
  }

  // ---- Mitarbeiter -------------------------------------------------------
  if (role === 'mitarbeiter') {
    const [stats, recent, tse, incomplete] = await Promise.all([
      fetchReportStats(supabase, null),
      fetchRecentReports(supabase, null, 5),
      fetchTseExpiringSoon(supabase, 5),
      supabase.from('v_incomplete_devices').select('*'),
    ])

    return (
      <div className="max-w-[1280px] mx-auto space-y-[18px]">
        {header}
        <AbStatsCard stats={stats} scope="all" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
          <RecentReportsCard rows={recent} scope="all" />
          <TseExpiryCard rows={tse} />
        </div>
        <IncompleteDevices rows={incomplete.data ?? []} isAdmin={false} />
      </div>
    )
  }

  // ---- Admin + Viewer (bestehend, plus TSE-Card) -------------------------
  const isAdmin = role === 'admin'
  const [kpi, recent, top, incomplete, tse] = await Promise.all([
    supabase.from('v_dashboard_kpis').select('*').single(),
    supabase.from('v_recent_sales').select('*'),
    supabase.from('v_top_models_revenue').select('*'),
    supabase.from('v_incomplete_devices').select('*'),
    fetchTseExpiringSoon(supabase, 5),
  ])

  const kpiData = kpi.data ?? { geraete_im_lager: 0, bestandswert_ek: 0, umsatz_mtd: 0, marge_mtd: 0 }
  const incompleteRows = incomplete.data ?? []

  return (
    <div className="max-w-[1280px] mx-auto space-y-[18px]">
      {header}
      <IncompleteDevices rows={incompleteRows} isAdmin={isAdmin} />
      <KpiCards data={kpiData} />
      <TseExpiryCard rows={tse} />
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-[18px]">
        <RecentSales rows={recent.data ?? []} />
        <TopModels rows={top.data ?? []} />
      </div>
    </div>
  )
}
