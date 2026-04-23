import { createClient } from '@/lib/supabase/server'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { StockByCategory } from '@/components/dashboard/stock-by-category'
import { RecentSales } from '@/components/dashboard/recent-sales'
import { TopModels } from '@/components/dashboard/top-models'
import { IncompleteDevices } from '@/components/dashboard/incomplete-devices'

function formatGermanDate(d: Date): string {
  return d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isAdmin = profile?.role === 'admin'

  const [kpi, stock, recent, top, incomplete] = await Promise.all([
    supabase.from('v_dashboard_kpis').select('*').single(),
    supabase.from('v_stock_by_category').select('*'),
    supabase.from('v_recent_sales').select('*'),
    supabase.from('v_top_models_revenue').select('*'),
    supabase.from('v_incomplete_devices').select('*'),
  ])

  const kpiData = kpi.data ?? { geraete_im_lager: 0, bestandswert_ek: 0, umsatz_mtd: 0, marge_mtd: 0 }
  const incompleteRows = incomplete.data ?? []
  const openCount = incompleteRows.length

  return (
    <div className="max-w-[1280px] mx-auto space-y-[18px]">
      <div className="kb-h-row flex-col md:flex-row items-start md:items-end gap-4 pb-4 mb-2 border-b border-[var(--rule-soft)]">
        <div>
          <div className="kb-label mb-1.5">Kontobuch · Tageseintrag</div>
          <h1 className="kb-h1">{formatGermanDate(new Date())}</h1>
          <div className="text-[13px] text-[var(--ink-3)] mt-1">
            {openCount > 0 ? `${openCount} offene Aufgabe${openCount === 1 ? '' : 'n'}` : 'Keine offenen Aufgaben'} ·{' '}
            {kpiData.geraete_im_lager} Geräte im Lager
          </div>
        </div>
      </div>

      <IncompleteDevices rows={incompleteRows} isAdmin={isAdmin} />

      <KpiCards data={kpiData} />

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-[18px]">
        <RecentSales rows={recent.data ?? []} />
        <TopModels rows={top.data ?? []} />
      </div>

      <StockByCategory rows={stock.data ?? []} />
    </div>
  )
}
