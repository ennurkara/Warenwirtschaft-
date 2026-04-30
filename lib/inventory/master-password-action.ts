'use server'

import { createClient } from '@/lib/supabase/server'

// Reveal-on-demand fuer das Vectron-Master-Passwort der Kasse
// (8-stellig numerisch, das was an der Kasse selbst eingegeben wird).
// Doppelt gegated:
//   - Server-Action prueft profile.role === 'admin'
//   - Tabelle vectron_master_passwords hat RLS admin-only
// Ohne beide Layer waere das Passwort fuer Mitarbeiter/Techniker abrufbar.

export async function revealMasterPassword(
  deviceId: string,
): Promise<{ password: string | null; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { password: null, error: 'unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return { password: null, error: 'forbidden' }

  const { data, error } = await supabase
    .from('vectron_master_passwords')
    .select('master_password')
    .eq('device_id', deviceId)
    .maybeSingle()
  if (error) return { password: null, error: error.message }
  return { password: data?.master_password ?? null }
}
