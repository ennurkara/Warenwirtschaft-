import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CategoryGrid } from '@/components/inventory/category-grid'
import { CategoryDeviceList } from '@/components/inventory/category-device-list'
import type { Device, Category, CategoryWithCount, Profile } from '@/lib/types'

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
      supabase.from('devices').select('category_id'),
    ])

    const countMap: Record<string, number> = {}
    for (const d of devices ?? []) {
      if (d.category_id) {
        countMap[d.category_id] = (countMap[d.category_id] ?? 0) + 1
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
    const [{ data: devices }, { data: categories }] = await Promise.all([
      supabase.from('devices').select('*, category:categories(*)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
    ])

    return (
      <CategoryDeviceList
        devices={(devices ?? []) as Device[]}
        categories={(categories ?? []) as Category[]}
        canAdd={canAdd}
        categoryName="Alle Geräte"
        hideCategoryFilter={false}
      />
    )
  }

  const [{ data: category }, { data: devices }, { data: categories }] = await Promise.all([
    supabase.from('categories').select('*').eq('id', categoryId).single(),
    supabase.from('devices').select('*, category:categories(*)').eq('category_id', categoryId).order('created_at', { ascending: false }),
    supabase.from('categories').select('*').order('name'),
  ])

  if (!category) {
    redirect('/inventory')
  }

  return (
    <CategoryDeviceList
      devices={(devices ?? []) as Device[]}
      categories={(categories ?? []) as Category[]}
      canAdd={canAdd}
      categoryName={category.name}
      hideCategoryFilter
      emptyMessage="Keine Geräte in dieser Kategorie."
    />
  )
}