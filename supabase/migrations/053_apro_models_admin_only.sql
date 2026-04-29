-- supabase/migrations/053_apro_models_admin_only.sql
--
-- Models-Insert: APRO-Lizenz-Modelle (also Eintraege im Lizenzkatalog)
-- nur fuer Admin. Andere Kategorien (Hardware, Stock-Items, ...) bleiben
-- fuer Admin / Mitarbeiter / Techniker offen — das ist Standard-Workflow
-- im Lieferschein- und Inventory-Picker.
--
-- Idempotent.

DROP POLICY IF EXISTS "models_insert" ON models;
CREATE POLICY "models_insert" ON models
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE
      WHEN category_id IN (SELECT id FROM categories WHERE name = 'Apro-Lizenz')
        THEN get_my_role() = 'admin'
      ELSE get_my_role() IN ('admin', 'mitarbeiter', 'techniker')
    END
  );

NOTIFY pgrst, 'reload schema';
