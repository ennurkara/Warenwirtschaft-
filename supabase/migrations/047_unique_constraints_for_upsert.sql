-- supabase/migrations/047_unique_constraints_for_upsert.sql
--
-- Hotfix: PostgREST onConflict in den Supabase-JS-Clients verlangt einen
-- echten UNIQUE-Constraint, kein partieller UNIQUE-Index. Die in 043/044/045
-- angelegten Partial Unique Indexes (WHERE ... IS NOT NULL) reichen fuer
-- Postgres-Constraint-Pruefung, nicht aber fuer den Upsert-Plan von PostgREST.
--
-- Volle UNIQUE-Constraints behandeln NULL als nicht-gleich, daher mehrere
-- NULLs sind weiterhin erlaubt — Verhalten bleibt identisch fuer Nicht-Vectron-
-- Kunden ohne vectron_operator_id.
--
-- Idempotent.

-- 1) customers.vectron_operator_id
DROP INDEX IF EXISTS customers_vectron_operator_id_uniq;
DO $$ BEGIN
  ALTER TABLE customers
    ADD CONSTRAINT customers_vectron_operator_id_key UNIQUE (vectron_operator_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) customer_sites.vectron_site_id
DROP INDEX IF EXISTS customer_sites_vectron_site_id_uniq;
DO $$ BEGIN
  ALTER TABLE customer_sites
    ADD CONSTRAINT customer_sites_vectron_site_id_key UNIQUE (vectron_site_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3) vectron_details.vectron_cash_register_id
DROP INDEX IF EXISTS vectron_details_cash_register_id_uniq;
DO $$ BEGIN
  ALTER TABLE vectron_details
    ADD CONSTRAINT vectron_details_cash_register_id_key UNIQUE (vectron_cash_register_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4) devices.serial_number ist seit 014 schon UNIQUE — sicherheitshalber pruefen
DO $$ BEGIN
  ALTER TABLE devices
    ADD CONSTRAINT devices_serial_number_key UNIQUE (serial_number);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
