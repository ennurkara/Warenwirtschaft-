-- supabase/migrations/055_vectron_site_master_passwords.sql
--
-- Echtes Master-Passwort pro Vectron-Kasse — das was an der Kasse selbst
-- eingegeben wird, rein numerisch (8 Stellen). Quelle:
--   GET /partner-api/v1/sites/{siteId}/cash-register/master-password/{serialNumber}
--   (Service-Partner-Scope-Token; Antwort ist plain-text, kein JSON-Wrapper)
--
-- Sicherheits-Design analog zu 054 (gedroppt in 056):
--   - Separate Tabelle damit kein DEVICE_SELECT-Join sie mit raus-zieht
--   - admin-only RLS auf ALLE Operationen
--   - Service-Role bypassed RLS fuer den Sync-Job
--
-- Filename "site_master_passwords" ist historisch (erste Recon-Annahme: Pwd
-- haengt an der Site). Tatsaechliche Granularitaet ist pro Kasse → device_id-PK.
-- Vorgaenger-Tabelle vectron_site_secrets aus einer fruehen Iteration wird hier
-- mit gedroppt; sie wurde nie befuellt.

DROP TABLE IF EXISTS vectron_site_secrets;

CREATE TABLE IF NOT EXISTS vectron_master_passwords (
  device_id        uuid PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  master_password  text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS vmp_updated_at ON vectron_master_passwords;
CREATE TRIGGER vmp_updated_at
  BEFORE UPDATE ON vectron_master_passwords
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE vectron_master_passwords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vmp_admin_all" ON vectron_master_passwords;
CREATE POLICY "vmp_admin_all" ON vectron_master_passwords
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

NOTIFY pgrst, 'reload schema';
