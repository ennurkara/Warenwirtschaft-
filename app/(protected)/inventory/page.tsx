import { createClient } from '@/lib/supabase/server'
import { DeviceList } from '@/components/inventory/device-list'
import type { Device, Category, Profile } from '@/lib/types'

export default async function InventoryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  const [{ data: devices }, { data: categories }] = await Promise.all([
    supabase.from('devices').select('*, category:categories(*)').order('created_at', { ascending: false }),
    supabase.from('categories').select('*').order('name'),
  ])

  const canAdd = (profile as Profile)?.role !== 'viewer'

  return (
    <DeviceList
      devices={(devices ?? []) as Device[]}
      categories={(categories ?? []) as Category[]}
      canAdd={canAdd}
    />
  )
}