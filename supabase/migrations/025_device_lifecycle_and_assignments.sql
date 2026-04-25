-- supabase/migrations/025_device_lifecycle_and_assignments.sql
--
-- Lifecycle-Erweiterung fuer Geraete (insbesondere Vectron-Kassen):
--  - Leihe: Firma verleiht Kasse temporaer an Kunde
--  - Verkauf: Kasse geht dauerhaft zum Kunden, bleibt sichtbar im Inventar
--  - Austausch: Eine Kasse raus zum Kunden + eine Kasse rein zur Reparatur
--  - Reparatur: Kasse beim Hersteller / Werkstatt
--
-- Aenderungen in dieser Migration:
--  1) device_status erweitert: + 'verliehen', + 'in_reparatur'
--  2) devices.current_customer_id (welcher Kunde hat das Gerät grade)
--  3) device_assignments Tabelle (Historie aller Verleih/Verkauf/Tausch-Vorgaenge)
--  4) RLS auf device_assignments
--  5) v_inventory_overview filtert verkauft + ausgemustert raus (Bestand-Logik)
--
-- Idempotent.

-- 1) Status-Enum erweitern
ALTER TYPE device_status ADD VALUE IF NOT EXISTS 'verliehen';
ALTER TYPE device_status ADD VALUE IF NOT EXISTS 'in_reparatur';

-- 2) devices.current_customer_id
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS current_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS devices_current_customer_idx
  ON devices(current_customer_id) WHERE current_customer_id IS NOT NULL;

-- 3) device_assignments
DO $$ BEGIN
  CREATE TYPE device_assignment_kind AS ENUM ('leihe', 'verkauf', 'austausch_raus', 'austausch_rein');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS device_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  customer_id     uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  kind            device_assignment_kind NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz NULL,
  swap_pair_id    uuid NULL REFERENCES device_assignments(id) ON DELETE SET NULL,
  work_report_id  uuid NULL REFERENCES work_reports(id) ON DELETE SET NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Aktive Zuordnungen (ended_at IS NULL) sind die UI-Hot-Path
CREATE INDEX IF NOT EXISTS device_assignments_active_device_idx
  ON device_assignments(device_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS device_assignments_active_customer_idx
  ON device_assignments(customer_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS device_assignments_swap_idx
  ON device_assignments(swap_pair_id) WHERE swap_pair_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS device_assignments_work_report_idx
  ON device_assignments(work_report_id) WHERE work_report_id IS NOT NULL;

DROP TRIGGER IF EXISTS device_assignments_updated_at ON device_assignments;
CREATE TRIGGER device_assignments_updated_at
  BEFORE UPDATE ON device_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4) RLS — alle authenticated lesen, mitarbeiter+admin schreiben
ALTER TABLE device_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_assignments_select" ON device_assignments;
CREATE POLICY "device_assignments_select" ON device_assignments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "device_assignments_insert" ON device_assignments;
CREATE POLICY "device_assignments_insert" ON device_assignments
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'mitarbeiter'));

DROP POLICY IF EXISTS "device_assignments_update" ON device_assignments;
CREATE POLICY "device_assignments_update" ON device_assignments
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'mitarbeiter'));

DROP POLICY IF EXISTS "device_assignments_delete" ON device_assignments;
CREATE POLICY "device_assignments_delete" ON device_assignments
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- 5) v_inventory_overview: "Bestand" = noch im Eigentum der Firma.
--    Verkauft + ausgemustert zaehlen nicht mehr zum Bestand.
CREATE OR REPLACE VIEW v_inventory_overview AS
SELECT
  c.id          AS category_id,
  c.name        AS category_name,
  c.kind        AS category_kind,
  c.cluster     AS category_cluster,
  CASE
    WHEN c.kind = 'stock'
      THEN COALESCE((
        SELECT SUM(si.quantity)
        FROM stock_items si
        JOIN models m ON m.id = si.model_id
        WHERE m.category_id = c.id
      ), 0)
    ELSE COALESCE((
      SELECT COUNT(*)
      FROM devices d
      JOIN models m ON m.id = d.model_id
      WHERE m.category_id = c.id
        AND d.status NOT IN ('verkauft', 'ausgemustert')
    ), 0)
  END           AS unit_count
FROM categories c;

NOTIFY pgrst, 'reload schema';
