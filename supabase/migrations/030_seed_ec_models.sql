-- supabase/migrations/030_seed_ec_models.sql
--
-- EC-Geräte als Vectron-Modelle in eigener Kategorie.
-- A35 = kabelgebunden, A800 = mobil (Bonierung über App).
--
-- Idempotent.

INSERT INTO categories (name, icon, kind, cluster)
VALUES ('EC-Gerät', 'credit-card', 'generic', 'kassen')
ON CONFLICT (name) DO NOTHING;

-- Vectron muss als Hersteller existieren (siehe 008_kassenhardware_vectron.sql).
-- ON CONFLICT funktioniert wegen nullable `version` nicht zuverlässig (NULL != NULL),
-- darum NOT EXISTS-Pattern für Idempotenz.
INSERT INTO models (manufacturer_id, category_id, modellname, variante)
SELECT m.id, c.id, 'A35', 'kabelgebunden'
FROM manufacturers m
CROSS JOIN categories c
WHERE m.name = 'Vectron'
  AND c.name = 'EC-Gerät'
  AND NOT EXISTS (
    SELECT 1 FROM models mo
    WHERE mo.manufacturer_id = m.id
      AND mo.modellname = 'A35'
      AND mo.variante IS NOT DISTINCT FROM 'kabelgebunden'
      AND mo.version IS NULL
  );

INSERT INTO models (manufacturer_id, category_id, modellname, variante)
SELECT m.id, c.id, 'A800', 'mobil'
FROM manufacturers m
CROSS JOIN categories c
WHERE m.name = 'Vectron'
  AND c.name = 'EC-Gerät'
  AND NOT EXISTS (
    SELECT 1 FROM models mo
    WHERE mo.manufacturer_id = m.id
      AND mo.modellname = 'A800'
      AND mo.variante IS NOT DISTINCT FROM 'mobil'
      AND mo.version IS NULL
  );

NOTIFY pgrst, 'reload schema';
