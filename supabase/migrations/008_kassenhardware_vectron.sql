-- supabase/migrations/008_kassenhardware_vectron.sql

-- 1. Kategorie umbenennen
UPDATE categories SET name = 'Kassenhardware' WHERE name = 'Registrierkasse';

-- 2. Alte kassen_details verwerfen (vectron_details ersetzt sie)
DROP TABLE IF EXISTS kassen_details CASCADE;

-- 3. Hersteller seeden (idempotent)
INSERT INTO manufacturers (name) VALUES
  ('Vectron'), ('Orderman'), ('Aures')
ON CONFLICT (name) DO NOTHING;

-- 4. Modelle seeden (idempotent via UNIQUE(manufacturer_id, modellname, variante, version))
WITH cat AS (SELECT id FROM categories WHERE name = 'Kassenhardware'),
     mv  AS (SELECT id FROM manufacturers WHERE name = 'Vectron'),
     mo  AS (SELECT id FROM manufacturers WHERE name = 'Orderman'),
     ma  AS (SELECT id FROM manufacturers WHERE name = 'Aures')
INSERT INTO models (manufacturer_id, category_id, modellname, variante, version)
SELECT mv.id, cat.id, 'POS Touch 15',    NULL, NULL FROM mv, cat UNION ALL
SELECT mv.id, cat.id, 'POS Touch 15 II', NULL, NULL FROM mv, cat UNION ALL
SELECT mv.id, cat.id, 'POS Touch 14',    NULL, NULL FROM mv, cat UNION ALL
SELECT mv.id, cat.id, 'POS 7',           NULL, NULL FROM mv, cat UNION ALL
SELECT mo.id, cat.id, 'Magellan',        NULL, NULL FROM mo, cat UNION ALL
SELECT ma.id, cat.id, 'Yuno B',          NULL, NULL FROM ma, cat UNION ALL
SELECT ma.id, cat.id, 'Yuno 2',          NULL, NULL FROM ma, cat
ON CONFLICT (manufacturer_id, modellname, variante, version) DO NOTHING;

-- 5. vectron_details Tabelle (1:1 mit devices, nur für Vectron-Geräte)
CREATE TYPE vectron_license_type AS ENUM ('full', 'light');

CREATE TABLE vectron_details (
  device_id    uuid PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  sw_serial    text,
  fiskal_2020  boolean NOT NULL DEFAULT false,
  zvt          boolean NOT NULL DEFAULT false,
  license_type vectron_license_type NOT NULL
);

-- 6. RLS für vectron_details
ALTER TABLE vectron_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vectron_details_select_all"
  ON vectron_details FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "vectron_details_insert_admin_staff"
  ON vectron_details FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin','mitarbeiter'))
  );

CREATE POLICY "vectron_details_update_admin_staff"
  ON vectron_details FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin','mitarbeiter'))
  );

CREATE POLICY "vectron_details_delete_admin"
  ON vectron_details FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin')
  );
