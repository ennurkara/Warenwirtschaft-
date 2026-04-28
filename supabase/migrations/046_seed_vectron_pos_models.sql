-- supabase/migrations/046_seed_vectron_pos_models.sql
--
-- Seedet alle Vectron POS-Hardware-Modelle, die im MyVectron-Portal
-- vorkommen, in die models-Tabelle. Erweitert die in 008 angelegten 4
-- Modelle um 17 weitere Typen.
--
-- Plattform (K5/K6/K7/Android/PC) wird NICHT in models.variante gepflegt,
-- sondern in vectron_details.platform — das Modell beschreibt die Hardware,
-- die Plattform ist Software-Generation.
--
-- Idempotent (UNIQUE auf manufacturer+modellname+variante+version, NULL-safe
-- ueber WHERE NOT EXISTS).

WITH cat AS (SELECT id FROM categories WHERE name = 'Kassenhardware'),
     mv  AS (SELECT id FROM manufacturers WHERE name = 'Vectron')
INSERT INTO models (manufacturer_id, category_id, modellname, variante, version)
SELECT mv.id, cat.id, t.modellname, NULL::text, NULL::text
FROM mv, cat, (VALUES
  ('POS Touch 15 II Wide'),
  ('POS Touch 14 Wide'),
  ('POS Touch 12'),
  ('POS Touch 12 II'),
  ('POS MobilePro III'),
  ('POS Mobile XL'),
  ('POS Life'),
  ('POS SteelTouch II (15 inch)'),
  ('POS SteelTouch II (17 inch)'),
  ('POS M4'),
  ('POS M4 Pay'),
  ('POS Mini II'),
  ('POS 7 Mini'),
  ('POS Vario II'),
  ('POS PC')
) AS t(modellname)
WHERE NOT EXISTS (
  SELECT 1 FROM models m
  WHERE m.manufacturer_id = mv.id
    AND m.modellname = t.modellname
    AND m.variante IS NOT DISTINCT FROM NULL
    AND m.version IS NOT DISTINCT FROM NULL
);

NOTIFY pgrst, 'reload schema';
