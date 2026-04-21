import { createClient } from '@/lib/supabase/server'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { StockByCategory } from '@/components/dashboard/stock-by-category'
import { RecentSales } from '@/components/dashboard/recent-sales'
import { TopModels } from '@/components/dashboard/top-models'
import { IncompleteDevices } from '@/components/dashboard/incomplete-devices'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [kpi, stock, recent, top, incomplete] = await Promise.all([
    supabase.from('v_dashboard_kpis').select('*').single(),
    supabase.from('v_stock_by_category').select('*'),
    supabase.from('v_recent_sales').select('*'),
    supabase.from('v_top_models_revenue').select('*'),
    supabase.from('v_incomplete_devices').select('*'),
  ])

  const kpiData = kpi.data ?? { geraete_im_lager: 0, bestandswert_ek: 0, umsatz_mtd: 0, marge_mtd: 0 }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <KpiCards data={kpiData} />
      <IncompleteDevices rows={incomplete.data ?? []} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StockByCategory rows={stock.data ?? []} />
        <TopModels rows={top.data ?? []} />
      </div>
      <RecentSales rows={recent.data ?? []} />
    </div>
  )
}
