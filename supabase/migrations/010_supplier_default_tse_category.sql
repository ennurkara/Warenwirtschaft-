-- Migration 010
--  - default_supplier_id am Modell (Auto-Fill beim Gerät-Anlegen)
--  - Kategorie "TSE Swissbit" + Hersteller "Swissbit" + Modelle "USB", "SD"
--    (TSEs sind eigene Lagergeräte; Zuordnung zu Kassen folgt in späterer Phase
--     über Arbeitsberichte/Kundenkartei.)
--  - v_incomplete_devices: Geräte ohne Einkaufsbeleg → Dashboard-Vermerk
--  - v_tse_expiring droppen: hängt an kassen_details (seit 008 weg); neue
--    TSE-Ablauf-Logik kommt in Phase 2 zusammen mit der Installationshistorie.

-- 1. Default-Lieferant am Modell
ALTER TABLE models
  ADD COLUMN IF NOT EXISTS default_supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

-- 2. TSE Swissbit Kategorie + Hersteller + Modelle
INSERT INTO categories (name) VALUES ('TSE Swissbit')
ON CONFLICT (name) DO NOTHING;

INSERT INTO manufacturers (name) VALUES ('Swissbit')
ON CONFLICT (name) DO NOTHING;

WITH cat AS (SELECT id FROM categories    WHERE name = 'TSE Swissbit'),
     mf  AS (SELECT id FROM manufacturers WHERE name = 'Swissbit')
INSERT INTO models (manufacturer_id, category_id, modellname, variante, version)
SELECT mf.id, cat.id, 'USB', NULL, NULL FROM mf, cat UNION ALL
SELECT mf.id, cat.id, 'SD',  NULL, NULL FROM mf, cat
ON CONFLICT (manufacturer_id, modellname, variante, version) DO NOTHING;

-- 3. View: unvollständige Geräte (kein Einkaufsbeleg)
CREATE OR REPLACE VIEW v_incomplete_devices AS
SELECT
  d.id               AS device_id,
  d.serial_number,
  d.created_at,
  m.modellname,
  mf.name            AS manufacturer_name,
  c.name             AS category_name
FROM devices d
LEFT JOIN purchase_items pi ON pi.device_id = d.id
LEFT JOIN models         m  ON d.model_id   = m.id
LEFT JOIN manufacturers  mf ON m.manufacturer_id = mf.id
LEFT JOIN categories     c  ON m.category_id = c.id
WHERE pi.id IS NULL
ORDER BY d.created_at DESC;

-- 4. Alte TSE-Warn-View entfernen (hängt an gedroppter kassen_details)
DROP VIEW IF EXISTS v_tse_expiring;
