import { SupabaseClient } from '@supabase/supabase-js'
import type { Device } from '@/lib/types'

const DEVICE_SELECT = `
  *,
  model:models(
    *,
    manufacturer:manufacturers(*),
    category:categories(*)
  ),
  vectron_details(*),
  purchase_item:purchase_items(*, purchase:purchases(*, supplier:suppliers(*))),
  sale_item:sale_items(*, sale:sales(*, customer:customers(*)))
`

export async function fetchDevices(
  supabase: SupabaseClient,
  filter?: { categoryId?: string; search?: string }
): Promise<Device[]> {
  let q = supabase.from('devices').select(DEVICE_SELECT).order('created_at', { ascending: false })

  if (filter?.categoryId) {
    const { data: models } = await supabase.from('models').select('id').eq('category_id', filter.categoryId)
    const modelIds = (models ?? []).map(m => m.id)
    if (modelIds.length === 0) return []
    q = q.in('model_id', modelIds)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as Device[]
}

export async function fetchDevice(supabase: SupabaseClient, id: string): Promise<Device | null> {
  const { data, error } = await supabase.from('devices').select(DEVICE_SELECT).eq('id', id).single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as unknown as Device
}
