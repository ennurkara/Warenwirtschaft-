-- supabase/migrations/035_licenses_model_link.sql
--
-- Verknüpft licenses mit dem Apro-Lizenz-Katalog via models.id und ergänzt
-- optionale Preis-Overrides pro Kunde (falls Kunde Sonderkonditionen hat;
-- sonst greifen die Defaults vom verlinkten Modell).
--
-- Idempotent.

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS model_id  uuid REFERENCES models(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ek_preis  numeric(10,2),
  ADD COLUMN IF NOT EXISTS vk_preis  numeric(10,2);

CREATE INDEX IF NOT EXISTS licenses_model_idx ON licenses(model_id);

NOTIFY pgrst, 'reload schema';
