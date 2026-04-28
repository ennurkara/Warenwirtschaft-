-- supabase/migrations/051_licenses_quantity.sql
--
-- licenses += quantity / assigned
--
-- Aus dem APRO-Portal kommen drei Felder pro Lizenz-Eintrag:
--   - Lizenzmenge        → quantity   (wie viele Stueck der Kunde hat)
--   - Allokierte Lizenzen → assigned   (wie viele davon vergeben sind)
--   - Verbleibende Lizenzen           = quantity - assigned (berechnet)
--
-- quantity default 1 ist sinnvoll fuer manuell angelegte Einzel-Lizenzen.
--
-- Idempotent.

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS quantity int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assigned int NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
