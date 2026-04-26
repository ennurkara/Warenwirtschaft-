-- supabase/migrations/033_licenses.sql
--
-- Apro-Lizenzen: einzelne Module/Lizenzen mit monatlicher Update-Gebühr.
-- Für Vectron-Kunden bleibt diese Tabelle leer (Lizenzen kommen über MyVectron / Smart 4 Pay).
--
-- Idempotent.

DO $$ BEGIN
  CREATE TYPE license_status_enum AS ENUM ('aktiv', 'gekuendigt', 'abgelaufen');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS licenses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  name                text NOT NULL,
  license_key         text,
  purchased_at        date,
  monthly_update_fee  numeric(10,2),
  status              license_status_enum NOT NULL DEFAULT 'aktiv',
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS licenses_customer_idx ON licenses(customer_id);
CREATE INDEX IF NOT EXISTS licenses_status_idx   ON licenses(status);

DROP TRIGGER IF EXISTS licenses_updated_at ON licenses;
CREATE TRIGGER licenses_updated_at
  BEFORE UPDATE ON licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "licenses_select" ON licenses;
CREATE POLICY "licenses_select" ON licenses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "licenses_insert" ON licenses;
CREATE POLICY "licenses_insert" ON licenses
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'mitarbeiter'));

DROP POLICY IF EXISTS "licenses_update" ON licenses;
CREATE POLICY "licenses_update" ON licenses
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'mitarbeiter'));

DROP POLICY IF EXISTS "licenses_delete" ON licenses;
CREATE POLICY "licenses_delete" ON licenses
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

NOTIFY pgrst, 'reload schema';
