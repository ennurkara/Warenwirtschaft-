import type { SupabaseClient } from '@supabase/supabase-js'

export interface TseExpiryRow {
  device_id: string
  kind: 'usb' | 'sd'
  expires_at: string | null   // ISO date
  bsi_k_tr_number: string | null
  tse_serial: string | null
  customer_name: string | null
  kasse_serial: string | null
  kasse_modell: string | null
}

const TSE_EXPIRY_SELECT = `
  device_id, kind, expires_at, bsi_k_tr_number,
  device:devices!tse_details_device_id_fkey(
    serial_number,
    customer:customers!current_customer_id(name)
  ),
  kasse:devices!tse_details_installed_in_device_fkey(
    serial_number,
    model:models(modellname)
  )
`

interface RawRow {
  device_id: string
  kind: 'usb' | 'sd'
  expires_at: string | null
  bsi_k_tr_number: string | null
  device: {
    serial_number: string | null
    customer: { name: string | null } | null
  } | null
  kasse: {
    serial_number: string | null
    model: { modellname: string | null } | null
  } | null
}

function flatten(rows: RawRow[]): TseExpiryRow[] {
  return rows.map(r => ({
    device_id: r.device_id,
    kind: r.kind,
    expires_at: r.expires_at,
    bsi_k_tr_number: r.bsi_k_tr_number,
    tse_serial: r.device?.serial_number ?? null,
    customer_name: r.device?.customer?.name ?? null,
    kasse_serial: r.kasse?.serial_number ?? null,
    kasse_modell: r.kasse?.model?.modellname ?? null,
  }))
}

/** Top-N TSEs nach Ablaufdatum (frühestes zuerst). expires_at IS NULL fließt nicht ein. */
export async function fetchTseExpiringSoon(
  supabase: SupabaseClient,
  limit = 5,
): Promise<TseExpiryRow[]> {
  const { data, error } = await supabase
    .from('tse_details')
    .select(TSE_EXPIRY_SELECT)
    .not('expires_at', 'is', null)
    .order('expires_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return flatten((data ?? []) as unknown as RawRow[])
}

/** Komplette TSE-Liste, sortiert nach Ablauf ASC, mit Datums-NULLs am Ende. */
export async function fetchAllTseSortedByExpiry(
  supabase: SupabaseClient,
): Promise<TseExpiryRow[]> {
  const { data, error } = await supabase
    .from('tse_details')
    .select(TSE_EXPIRY_SELECT)
    .order('expires_at', { ascending: true, nullsFirst: false })
  if (error) throw error
  return flatten((data ?? []) as unknown as RawRow[])
}
