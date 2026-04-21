import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchDevices } from '@/lib/inventory/queries'
import { CategoryGrid } from '@/components/inventory/category-grid'
import { CategoryDeviceList } from '@/components/inventory/category-device-list'
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
    const [{ data: categories }, { data: devices }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('devices').select('model_id'),
    ])

    // Count devices per category via models
    const modelIds = (devices ?? []).map(d => d.model_id).filter(Boolean)
    let countMap: Record<string, number> = {}
    if (modelIds.length > 0) {
      const { data: models } = await supabase.from('models').select('id, category_id').in('id', modelIds)
      for (const m of models ?? []) {
        if (m.category_id) {
          countMap[m.category_id] = (countMap[m.category_id] ?? 0) + 1
        }
      }
    }

    const categoriesWithCount: CategoryWithCount[] = (categories ?? []).map(c => ({
      ...c,
      device_count: countMap[c.id] ?? 0,
    }))

    return (
      <CategoryGrid
        categories={categoriesWithCount}
        totalDevices={devices?.length ?? 0}
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

  const [{ data: category }, devices, { data: categories }] = await Promise.all([
    supabase.from('categories').select('*').eq('id', categoryId).single(),
    fetchDevices(supabase, { categoryId }),
    supabase.from('categories').select('*').order('name'),
  ])

  if (!category) {
    redirect('/inventory')
  }

  return (
    <CategoryDeviceList
      devices={devices}
      categories={(categories ?? []) as Category[]}
      canAdd={canAdd}
      categoryName={category.name}
      activeCategoryName={category.name}
      hideCategoryFilter
      emptyMessage="Keine Geräte in dieser Kategorie."
    />
  )
}
