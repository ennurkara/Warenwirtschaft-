-- supabase/migrations/054_vectron_master_passwords.sql
--
-- Master-/Maintenance-Passwort pro Vectron-Kasse. Aus dem myVectron-Operator-
-- Portal über GET /operator-api/v1/cash-registers/{id} → maintenanceConfiguration.password.
--
-- Sicherheits-Design: SEPARATE Tabelle (nicht Spalte auf vectron_details), damit
-- das Passwort niemals durch DEVICE_SELECT in lib/inventory/queries.ts mit raus-
-- joined wird. Zusätzlich admin-only RLS auf ALLE Operationen — Mitarbeiter,
-- Techniker und Viewer sehen die Tabelle gar nicht.
--
-- Schreibend füllt der Sync-Job (service-role bypassed RLS) die Tabelle. Lesend
-- greift nur die Admin-UI auf vectron-cash-register-Detail zu, RLS gated den Rest.

CREATE TABLE IF NOT EXISTS vectron_cash_register_secrets (
  device_id            uuid PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  maintenance_password text,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS vcrs_updated_at ON vectron_cash_register_secrets;
CREATE TRIGGER vcrs_updated_at
  BEFORE UPDATE ON vectron_cash_register_secrets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE vectron_cash_register_secrets ENABLE ROW LEVEL SECURITY;

-- Admin-only: SELECT, INSERT, UPDATE, DELETE — alles über eine Policy.
DROP POLICY IF EXISTS "vcrs_admin_all" ON vectron_cash_register_secrets;
CREATE POLICY "vcrs_admin_all" ON vectron_cash_register_secrets
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

NOTIFY pgrst, 'reload schema';
