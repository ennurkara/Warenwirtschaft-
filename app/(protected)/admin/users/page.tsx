import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UserRoleSelect } from './user-role-select'
import type { Profile } from '@/lib/types'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: profiles } = await supabase.from('profiles').select('*').order('full_name')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Benutzerverwaltung</h1>
      <div className="rounded-md border bg-white divide-y">
        {(profiles as Profile[]).map(p => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{p.full_name}</p>
              <p className="text-sm text-slate-500">{p.id}</p>
            </div>
            <UserRoleSelect profile={p} currentUserId={user!.id} />
          </div>
        ))}
      </div>
    </div>
  )
}