-- supabase/migrations/036_seed_bonrollen.sql
--
-- Bonrollen-Stammdaten: Hersteller "Diverse" + 5 Modelle in der bestehenden
-- Kategorie "Bonrollen" (kind='stock'), Einheit jeweils Karton.
--
-- Idempotent. variante/version bleiben NULL — wenn später spezifische Maße
-- gepflegt werden sollen, eigene Modelle pro Maß-Variante via /admin/models.

INSERT INTO manufacturers (name)
VALUES ('Diverse')
ON CONFLICT (name) DO NOTHING;

-- Modelle seeden via NOT EXISTS (UNIQUE-Index enthält nullable version,
-- ON CONFLICT funktioniert hier nicht zuverlässig — siehe Migration 030).
INSERT INTO models (manufacturer_id, category_id, modellname, notes)
SELECT mf.id, c.id, 'Thermorollen Karton', 'Bestand pro Karton'
FROM manufacturers mf CROSS JOIN categories c
WHERE mf.name = 'Diverse' AND c.name = 'Bonrollen'
  AND NOT EXISTS (
    SELECT 1 FROM models mo WHERE mo.manufacturer_id = mf.id
      AND mo.modellname = 'Thermorollen Karton'
      AND mo.variante IS NULL AND mo.version IS NULL
  );

INSERT INTO models (manufacturer_id, category_id, modellname, notes)
SELECT mf.id, c.id, 'Thermorollen Phenolfrei Karton', 'Bestand pro Karton, BPA-/Phenolfrei'
FROM manufacturers mf CROSS JOIN categories c
WHERE mf.name = 'Diverse' AND c.name = 'Bonrollen'
  AND NOT EXISTS (
    SELECT 1 FROM models mo WHERE mo.manufacturer_id = mf.id
      AND mo.modellname = 'Thermorollen Phenolfrei Karton'
      AND mo.variante IS NULL AND mo.version IS NULL
  );

INSERT INTO models (manufacturer_id, category_id, modellname, notes)
SELECT mf.id, c.id, 'Bonrollen Küche Karton', 'Für Küchendrucker mit Farbband'
FROM manufacturers mf CROSS JOIN categories c
WHERE mf.name = 'Diverse' AND c.name = 'Bonrollen'
  AND NOT EXISTS (
    SELECT 1 FROM models mo WHERE mo.manufacturer_id = mf.id
      AND mo.modellname = 'Bonrollen Küche Karton'
      AND mo.variante IS NULL AND mo.version IS NULL
  );

INSERT INTO models (manufacturer_id, category_id, modellname, notes)
SELECT mf.id, c.id, 'EC Rollen Karton', 'Für EC-Geräte (z.B. A35, A800)'
FROM manufacturers mf CROSS JOIN categories c
WHERE mf.name = 'Diverse' AND c.name = 'Bonrollen'
  AND NOT EXISTS (
    SELECT 1 FROM models mo WHERE mo.manufacturer_id = mf.id
      AND mo.modellname = 'EC Rollen Karton'
      AND mo.variante IS NULL AND mo.version IS NULL
  );

INSERT INTO models (manufacturer_id, category_id, modellname, notes)
SELECT mf.id, c.id, 'Gürtel Rollen Karton', 'Für Gürteldrucker / Orderman'
FROM manufacturers mf CROSS JOIN categories c
WHERE mf.name = 'Diverse' AND c.name = 'Bonrollen'
  AND NOT EXISTS (
    SELECT 1 FROM models mo WHERE mo.manufacturer_id = mf.id
      AND mo.modellname = 'Gürtel Rollen Karton'
      AND mo.variante IS NULL AND mo.version IS NULL
  );

NOTIFY pgrst, 'reload schema';
