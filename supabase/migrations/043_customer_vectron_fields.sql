-- supabase/migrations/043_customer_vectron_fields.sql
--
-- Erweitert customers um Vectron-spezifische Felder fuer den Import aus
-- dem MyVectron Servicepartner-Portal:
--  - country               Land (Default 'DE')
--  - vat_id                USt-IdNr (z.B. DE257883768)
--  - tax_number            Steuernummer (z.B. 132/204/70843)
--  - customer_number       Vectron-Kundennr (z.B. 13153121)
--  - vectron_operator_id   Vectron-UUID, dient als Re-Sync-Anker (UNIQUE)
--  - last_heartbeat_at     letzter Heartbeat einer Kasse (fuer Vertrags-Status)
--
-- Idempotent.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS country             text DEFAULT 'DE',
  ADD COLUMN IF NOT EXISTS vat_id              text,
  ADD COLUMN IF NOT EXISTS tax_number          text,
  ADD COLUMN IF NOT EXISTS customer_number     text,
  ADD COLUMN IF NOT EXISTS vectron_operator_id uuid,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at   timestamptz;

-- UNIQUE-Constraint via Index, idempotent
CREATE UNIQUE INDEX IF NOT EXISTS customers_vectron_operator_id_uniq
  ON customers(vectron_operator_id)
  WHERE vectron_operator_id IS NOT NULL;

-- Suche nach Vectron-Kundennummer
CREATE INDEX IF NOT EXISTS customers_customer_number_idx
  ON customers(customer_number)
  WHERE customer_number IS NOT NULL;

NOTIFY pgrst, 'reload schema';
