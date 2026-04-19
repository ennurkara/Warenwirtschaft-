'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Profile, UserRole } from '@/lib/types'

export function UserRoleSelect({ profile, currentUserId }: { profile: Profile; currentUserId: string }) {
  const [role, setRole] = useState<UserRole>(profile.role)
  const router = useRouter()
  const supabase = createClient()

  async function handleChange(newRole: UserRole) {
    setRole(newRole)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profile.id)
    if (error) {
      toast.error('Fehler', { description: error.message })
      setRole(profile.role)
      return
    }
    toast.success('Rolle aktualisiert')
    router.refresh()
  }

  return (
    <Select value={role} onValueChange={v => handleChange(v as UserRole)} disabled={profile.id === currentUserId}>
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="mitarbeiter">Mitarbeiter</SelectItem>
        <SelectItem value="viewer">Viewer</SelectItem>
      </SelectContent>
    </Select>
  )
}