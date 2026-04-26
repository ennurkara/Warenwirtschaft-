-- supabase/migrations/040_normalize_apro_license_names.sql
--
-- Bereinigt doppelte/mehrfache Leerzeichen in den Apro-Lizenz-Modellnamen
-- (Excel-Import hatte z.B. "APRO. Kasse  9" mit zwei Spaces). Reduziert
-- jede Whitespace-Folge auf ein einzelnes Leerzeichen und trimt Ränder.
--
-- Idempotent: nach dem ersten Run gibt es keine doppelten Spaces mehr,
-- regexp_replace ist No-Op.

UPDATE models
   SET modellname = regexp_replace(trim(modellname), '\s+', ' ', 'g')
 WHERE manufacturer_id = (SELECT id FROM manufacturers WHERE name = 'Apro')
   AND category_id    = (SELECT id FROM categories     WHERE name = 'Apro-Lizenz')
   AND modellname    <> regexp_replace(trim(modellname), '\s+', ' ', 'g');

NOTIFY pgrst, 'reload schema';
