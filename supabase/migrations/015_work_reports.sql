-- supabase/migrations/015_work_reports.sql
--
-- Arbeitsberichte (sister-app "arbeitsbericht"): work_reports + work_report_devices.
-- customers existiert bereits (003_warenwirtschaft_core.sql) und wird referenziert.
-- profiles existiert bereits (001_initial_schema.sql).
-- devices existiert bereits (001 + 005_devices_restructure.sql).
--
-- Idempotent. Ersetzt arbeitsbericht/supabase/migrations/003_work_reports.sql
-- (dortige Duplikat-Definition von customers wird verworfen).

-- Status-Enum für Arbeitsberichte
DO $$ BEGIN
  CREATE TYPE work_report_status AS ENUM ('entwurf', 'abgeschlossen');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Fortlaufende Berichtsnummer (AB-YYYY-NNNN). Trigger setzt sie bei Insert, falls NULL.
CREATE OR REPLACE FUNCTION generate_report_number()
RETURNS text AS $$
DECLARE
  year_str text := to_char(now(), 'YYYY');
  seq_num  int;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num
  FROM work_reports
  WHERE report_number LIKE 'AB-' || year_str || '-%';
  RETURN 'AB-' || year_str || '-' || LPAD(seq_num::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_report_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.report_number IS NULL THEN
    NEW.report_number := generate_report_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Arbeitsberichte
CREATE TABLE IF NOT EXISTS work_reports (
  id                    uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number         text               UNIQUE,
  customer_id           uuid               NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  technician_id         uuid               NOT NULL REFERENCES profiles(id)  ON DELETE RESTRICT,
  description           text,
  work_hours            numeric(5,2),
  travel_from           text,
  travel_to             text,
  start_time            timestamptz        NOT NULL DEFAULT now(),
  end_time              timestamptz,
  status                work_report_status NOT NULL DEFAULT 'entwurf',
  technician_signature  text,
  customer_signature    text,
  completed_at          timestamptz,
  created_at            timestamptz        NOT NULL DEFAULT now(),
  updated_at            timestamptz        NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_reports_customer_idx   ON work_reports(customer_id);
CREATE INDEX IF NOT EXISTS work_reports_technician_idx ON work_reports(technician_id);
CREATE INDEX IF NOT EXISTS work_reports_status_idx     ON work_reports(status);

DROP TRIGGER IF EXISTS work_reports_updated_at ON work_reports;
CREATE TRIGGER work_reports_updated_at
  BEFORE UPDATE ON work_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS work_reports_set_number ON work_reports;
CREATE TRIGGER work_reports_set_number
  BEFORE INSERT ON work_reports
  FOR EACH ROW EXECUTE FUNCTION set_report_number();

-- Geräte-Zuordnung (Junction). IST zugleich die „Einsatz-Buchung" — kein separater Beleg.
CREATE TABLE IF NOT EXISTS work_report_devices (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_report_id uuid        NOT NULL REFERENCES work_reports(id) ON DELETE CASCADE,
  device_id      uuid        NOT NULL REFERENCES devices(id)      ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(work_report_id, device_id)
);

CREATE INDEX IF NOT EXISTS work_report_devices_device_idx ON work_report_devices(device_id);
