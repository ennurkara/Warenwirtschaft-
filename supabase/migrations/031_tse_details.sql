-- supabase/migrations/031_tse_details.sql
--
-- 1:1-Detail-Tabelle für TSE-Devices (Kategorie "TSE Swissbit").
-- installed_in_device verlinkt die TSE auf eine Kasse, sobald installiert.
-- Wenn TSE noch im Lager: installed_in_device IS NULL und devices.status = 'lager'.
--
-- Idempotent.

DO $$ BEGIN
  CREATE TYPE tse_kind_enum AS ENUM ('usb', 'sd');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tse_details (
  device_id            uuid PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  kind                 tse_kind_enum NOT NULL,
  bsi_k_tr_number      text,
  expires_at           date,
  installed_in_device  uuid REFERENCES devices(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tse_details_installed_idx
  ON tse_details(installed_in_device) WHERE installed_in_device IS NOT NULL;
CREATE INDEX IF NOT EXISTS tse_details_expires_idx
  ON tse_details(expires_at) WHERE expires_at IS NOT NULL;

DROP TRIGGER IF EXISTS tse_details_updated_at ON tse_details;
CREATE TRIGGER tse_details_updated_at
  BEFORE UPDATE ON tse_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tse_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tse_select" ON tse_details;
CREATE POLICY "tse_select" ON tse_details
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tse_insert" ON tse_details;
CREATE POLICY "tse_insert" ON tse_details
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'mitarbeiter'));

DROP POLICY IF EXISTS "tse_update" ON tse_details;
CREATE POLICY "tse_update" ON tse_details
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'mitarbeiter'));

DROP POLICY IF EXISTS "tse_delete" ON tse_details;
CREATE POLICY "tse_delete" ON tse_details
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

NOTIFY pgrst, 'reload schema';
