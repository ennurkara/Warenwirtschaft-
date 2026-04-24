import { SupabaseClient } from '@supabase/supabase-js'
import type { StockItem } from '@/lib/types'

const STOCK_SELECT = `
  *,
  model:models(
    *,
    manufacturer:manufacturers(*),
    category:categories(*)
  )
`

export async function fetchStockItems(
  supabase: SupabaseClient,
  filter?: { categoryId?: string }
): Promise<StockItem[]> {
  let q = supabase.from('stock_items').select(STOCK_SELECT).order('created_at', { ascending: false })

  if (filter?.categoryId) {
    const { data: models } = await supabase.from('models').select('id').eq('category_id', filter.categoryId)
    const modelIds = (models ?? []).map(m => m.id)
    if (modelIds.length === 0) return []
    q = q.in('model_id', modelIds)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as StockItem[]
}

export async function fetchStockItem(supabase: SupabaseClient, id: string): Promise<StockItem | null> {
  const { data, error } = await supabase.from('stock_items').select(STOCK_SELECT).eq('id', id).single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as unknown as StockItem
}
