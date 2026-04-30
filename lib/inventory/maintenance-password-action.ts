'use server'

import { createClient } from '@/lib/supabase/server'

// Reveal-on-demand fuer das Vectron-Maintenance-Passwort. Doppelt gegated:
//   - Server-Action prueft profile.role === 'admin'
//   - Tabelle vectron_cash_register_secrets hat RLS admin-only
// Ohne beide Layer waere das Passwort fuer Mitarbeiter/Techniker abrufbar.

export async function revealMaintenancePassword(
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
    .from('vectron_cash_register_secrets')
    .select('maintenance_password')
    .eq('device_id', deviceId)
    .maybeSingle()
  if (error) return { password: null, error: error.message }
  return { password: data?.maintenance_password ?? null }
}
