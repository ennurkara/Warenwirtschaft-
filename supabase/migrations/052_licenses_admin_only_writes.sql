-- supabase/migrations/052_licenses_admin_only_writes.sql
--
-- APRO-Lizenzen sollen nur fuer den Admin schreibbar sein. Mitarbeiter und
-- Techniker sehen sie weiter (read-only) in der Kundenkartei.
--
-- Vorher: insert/update fuer admin + mitarbeiter (+ techniker durch 039).
-- Nachher: insert/update/delete nur admin.
--
-- Idempotent.

DROP POLICY IF EXISTS "licenses_insert" ON licenses;
CREATE POLICY "licenses_insert" ON licenses
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "licenses_update" ON licenses;
CREATE POLICY "licenses_update" ON licenses
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "licenses_delete" ON licenses;
CREATE POLICY "licenses_delete" ON licenses
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

NOTIFY pgrst, 'reload schema';
