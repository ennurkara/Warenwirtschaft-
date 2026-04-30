'use server'

import { createClient } from '@/lib/supabase/server'

// Reveal-on-demand fuer das Vectron-Master-Passwort der Kasse
// (8-stellig numerisch, das was an der Kasse selbst eingegeben wird).
// Doppelt gegated:
//   - Server-Action prueft profile.role IN ('admin', 'techniker')
//   - Tabelle vectron_master_passwords hat SELECT-RLS auf dieselbe Rollen-Liste
// Mitarbeiter und viewer bleiben aussen vor.

const ALLOWED_ROLES = new Set(['admin', 'techniker'])

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
  if (!profile?.role || !ALLOWED_ROLES.has(profile.role)) {
    return { password: null, error: 'forbidden' }
  }

  const { data, error } = await supabase
    .from('vectron_master_passwords')
    .select('master_password')
    .eq('device_id', deviceId)
    .maybeSingle()
  if (error) return { password: null, error: error.message }
  return { password: data?.master_password ?? null }
}
