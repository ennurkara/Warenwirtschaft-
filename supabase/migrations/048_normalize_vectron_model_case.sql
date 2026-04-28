-- supabase/migrations/048_normalize_vectron_model_case.sql
--
-- Konsolidiert Case-Duplikate bei Vectron-Modellnamen ("Pos Touch 15" und
-- "POS Touch 15 II" Wide existierten parallel zu "Pos ..."-Schreibungen).
--
-- Strategie:
-- 1) Wo nur die kleinschreibung in Verwendung ist und keine Großschreibung
--    existiert: rename.
-- 2) Wo beide Schreibungen existieren und die kleinschreibung 0 devices hat:
--    DELETE der kleinschreibung.
-- 3) "Pos Touch 15 Wide" hat 0 devices und kommt im Vectron-Status-Monitor
--    nicht vor (canonical ist "POS Touch 15 II Wide") → DELETE.
--
-- Idempotent: jede Operation pruft den Soll-Zustand vorher.

-- 1) Renames (Pos → POS), nur wenn Ziel nicht existiert
UPDATE models m
   SET modellname = 'POS Touch 15'
  FROM manufacturers mf
 WHERE m.manufacturer_id = mf.id
   AND mf.name = 'Vectron'
   AND m.modellname = 'Pos Touch 15'
   AND NOT EXISTS (
     SELECT 1 FROM models m2
      WHERE m2.manufacturer_id = mf.id
        AND m2.modellname = 'POS Touch 15'
        AND m2.id <> m.id
   );

UPDATE models m
   SET modellname = 'POS Touch 15 II'
  FROM manufacturers mf
 WHERE m.manufacturer_id = mf.id
   AND mf.name = 'Vectron'
   AND m.modellname = 'Pos Touch 15 II'
   AND NOT EXISTS (
     SELECT 1 FROM models m2
      WHERE m2.manufacturer_id = mf.id
        AND m2.modellname = 'POS Touch 15 II'
        AND m2.id <> m.id
   );

UPDATE models m
   SET modellname = 'POS 7'
  FROM manufacturers mf
 WHERE m.manufacturer_id = mf.id
   AND mf.name = 'Vectron'
   AND m.modellname = 'Pos 7'
   AND NOT EXISTS (
     SELECT 1 FROM models m2
      WHERE m2.manufacturer_id = mf.id
        AND m2.modellname = 'POS 7'
        AND m2.id <> m.id
   );

-- 2) Duplikate loeschen: nur wenn 0 devices und Großschreibung-Variante existiert
DELETE FROM models m
 USING manufacturers mf
 WHERE m.manufacturer_id = mf.id
   AND mf.name = 'Vectron'
   AND m.modellname IN ('Pos Touch 12', 'Pos Touch 14 Wide')
   AND NOT EXISTS (SELECT 1 FROM devices d WHERE d.model_id = m.id)
   AND EXISTS (
     SELECT 1 FROM models m2
      WHERE m2.manufacturer_id = mf.id
        AND LOWER(m2.modellname) = LOWER(m.modellname)
        AND m2.modellname <> m.modellname
        AND m2.id <> m.id
   );

-- 3) "Pos Touch 15 Wide" — kein Pendant, 0 devices, nicht in Vectron-Daten
DELETE FROM models m
 USING manufacturers mf
 WHERE m.manufacturer_id = mf.id
   AND mf.name = 'Vectron'
   AND m.modellname = 'Pos Touch 15 Wide'
   AND NOT EXISTS (SELECT 1 FROM devices d WHERE d.model_id = m.id);

NOTIFY pgrst, 'reload schema';
