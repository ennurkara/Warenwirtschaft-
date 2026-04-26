import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchCustomerDetail } from '@/lib/customers/queries'
import { CustomerDetail } from '@/components/customers/customer-detail'

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const customer = await fetchCustomerDetail(supabase, params.id)
  if (!customer) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isAdmin = profile?.role === 'admin'

  return <CustomerDetail customer={customer} isAdmin={isAdmin} />
}
