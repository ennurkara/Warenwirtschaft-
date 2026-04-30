-- supabase/migrations/057_master_password_techniker_access.sql
--
-- vectron_master_passwords: techniker bekommen SELECT-Zugriff zusaetzlich zu
-- admin. Mitarbeiter und viewer bleiben aussen vor (sie sehen die Tabelle
-- weiterhin gar nicht).
--
-- Schreibend (UPSERT/DELETE) bleibt admin-only — der Sync-Job nutzt sowieso
-- die Service-Role und bypassed RLS. Techniker brauchen nur lesenden Zugriff.

DROP POLICY IF EXISTS "vmp_admin_all" ON vectron_master_passwords;

DROP POLICY IF EXISTS "vmp_select_admin_techniker" ON vectron_master_passwords;
CREATE POLICY "vmp_select_admin_techniker" ON vectron_master_passwords
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'techniker'));

DROP POLICY IF EXISTS "vmp_write_admin" ON vectron_master_passwords;
CREATE POLICY "vmp_write_admin" ON vectron_master_passwords
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

NOTIFY pgrst, 'reload schema';
