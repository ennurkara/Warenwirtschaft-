-- supabase/migrations/029_customer_kind.sql
--
-- Klassifiziert Kunden in Vectron, Apro oder Sonstige.
-- Default 'sonstige' für alle Bestandskunden, Pflege erfolgt manuell pro Kunde.
--
-- Idempotent.

DO $$ BEGIN
  CREATE TYPE customer_kind_enum AS ENUM ('vectron', 'apro', 'sonstige');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_kind customer_kind_enum NOT NULL DEFAULT 'sonstige';

CREATE INDEX IF NOT EXISTS customers_kind_idx ON customers(customer_kind);

NOTIFY pgrst, 'reload schema';
