import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchDevices } from '@/lib/inventory/queries'
import { fetchStockItems } from '@/lib/inventory/stock-queries'
import { CategoryGrid } from '@/components/inventory/category-grid'
import { CategoryDeviceList } from '@/components/inventory/category-device-list'
import { StockItemList } from '@/components/inventory/stock-item-list'
import type { Category, CategoryWithCount, Profile } from '@/lib/types'

interface PageProps {
  searchParams: Promise<{ category?: string }>
}

export default async function InventoryPage({ searchParams }: PageProps) {
  const { category: categoryId } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const canAdd = (profile as Profile)?.role !== 'viewer'

  if (!categoryId) {
    const [{ data: categories }, { data: overview }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('v_inventory_overview').select('category_id, unit_count'),
    ])

    const countMap: Record<string, number> = {}
    let totalUnits = 0
    for (const row of overview ?? []) {
      const n = Number(row.unit_count ?? 0)
      countMap[row.category_id] = n
      totalUnits += n
    }

    const categoriesWithCount: CategoryWithCount[] = (categories ?? []).map(c => ({
      ...c,
      device_count: countMap[c.id] ?? 0,
    }))

    return (
      <CategoryGrid
        categories={categoriesWithCount}
        totalDevices={totalUnits}
        canAdd={canAdd}
      />
    )
  }

  if (categoryId === 'all') {
    const [devices, { data: categories }] = await Promise.all([
      fetchDevices(supabase),
      supabase.from('categories').select('*').order('name'),
    ])

    return (
      <CategoryDeviceList
        devices={devices}
        categories={(categories ?? []) as Category[]}
        canAdd={canAdd}
        categoryName="Alle Geräte"
        activeCategoryName="Alle Geräte"
        hideCategoryFilter={false}
      />
    )
  }

  const { data: category } = await supabase.from('categories').select('*').eq('id', categoryId).single()

  if (!category) {
    redirect('/inventory')
  }

  const cat = category as Category

  if (cat.kind === 'stock') {
    const items = await fetchStockItems(supabase, { categoryId })
    return (
      <StockItemList
        items={items}
        categoryName={cat.name}
        canAdd={canAdd}
      />
    )
  }

  const [devices, { data: categories }] = await Promise.all([
    fetchDevices(supabase, { categoryId }),
    supabase.from('categories').select('*').order('name'),
  ])

  return (
    <CategoryDeviceList
      devices={devices}
      categories={(categories ?? []) as Category[]}
      canAdd={canAdd}
      categoryName={cat.name}
      activeCategoryName={cat.name}
      activeCategoryKind={cat.kind}
      hideCategoryFilter
      emptyMessage="Keine Geräte in dieser Kategorie."
    />
  )
}
