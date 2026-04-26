import { SupabaseClient } from '@supabase/supabase-js'
import type { Contract, Customer, Device, License, WorkReport } from '@/lib/types'
import { DEVICE_SELECT } from '@/lib/inventory/queries'

export interface CustomerDetail extends Customer {
  devices: Device[]
  contracts: Contract[]
  licenses: License[]
  work_reports: WorkReport[]
}

export const CUSTOMER_DETAIL_SELECT = `
  *,
  devices:devices!current_customer_id(${DEVICE_SELECT}),
  contracts(*, ec_device:devices!ec_device_id(${DEVICE_SELECT})),
  licenses(*),
  work_reports(id, report_number, customer_id, technician_id, start_time, end_time, status, completed_at, created_at, updated_at, description, work_hours, travel_from, travel_to, technician_signature, customer_signature, pdf_path, pdf_uploaded_at)
`

export async function fetchCustomerDetail(
  supabase: SupabaseClient,
  id: string
): Promise<CustomerDetail | null> {
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_DETAIL_SELECT)
    .eq('id', id)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as unknown as CustomerDetail
}
