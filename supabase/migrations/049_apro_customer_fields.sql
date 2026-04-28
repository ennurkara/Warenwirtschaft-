-- supabase/migrations/049_apro_customer_fields.sql
--
-- Erweitert customers um Re-Sync-Anker fuer APRO Distributoren-Portal:
--  - apro_customer_id   numerische ID aus liveupdate.apro.at (z.B. "27437")
--  - apro_license_key   Lizenznehmer-UUID
--
-- Idempotent.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS apro_customer_id  text,
  ADD COLUMN IF NOT EXISTS apro_license_key  uuid;

DO $$ BEGIN
  ALTER TABLE customers
    ADD CONSTRAINT customers_apro_customer_id_key UNIQUE (apro_customer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE customers
    ADD CONSTRAINT customers_apro_license_key_key UNIQUE (apro_license_key);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS customers_apro_customer_id_idx
  ON customers(apro_customer_id) WHERE apro_customer_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
