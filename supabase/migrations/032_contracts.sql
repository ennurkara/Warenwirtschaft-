-- supabase/migrations/032_contracts.sql
--
-- Vertrags-Tabelle für MyVectron / Smart 4 Pay / Apro-Updates.
-- Constraint: höchstens ein Vertrag mit status='aktiv' pro Kunde
-- (Partial-Unique-Index, gekuendigte/beendete Verträge bleiben als Historie liegen).
-- ec_device_id verlinkt das EC-Gerät bei Smart-4-Pay-Verträgen.
--
-- Idempotent.

DO $$ BEGIN
  CREATE TYPE contract_kind_enum AS ENUM ('myvectron', 'smart4pay', 'apro_updates');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contract_status_enum AS ENUM ('aktiv', 'gekuendigt', 'beendet');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS contracts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  kind          contract_kind_enum NOT NULL,
  start_date    date NOT NULL,
  end_date      date,
  monthly_fee   numeric(10,2),
  status        contract_status_enum NOT NULL DEFAULT 'aktiv',
  ec_device_id  uuid REFERENCES devices(id) ON DELETE SET NULL,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contracts_customer_idx ON contracts(customer_id);
CREATE INDEX IF NOT EXISTS contracts_status_idx   ON contracts(status);

CREATE UNIQUE INDEX IF NOT EXISTS contracts_one_active_per_customer
  ON contracts(customer_id) WHERE status = 'aktiv';

DROP TRIGGER IF EXISTS contracts_updated_at ON contracts;
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contracts_select" ON contracts;
CREATE POLICY "contracts_select" ON contracts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "contracts_insert" ON contracts;
CREATE POLICY "contracts_insert" ON contracts
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'mitarbeiter'));

DROP POLICY IF EXISTS "contracts_update" ON contracts;
CREATE POLICY "contracts_update" ON contracts
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'mitarbeiter'));

DROP POLICY IF EXISTS "contracts_delete" ON contracts;
CREATE POLICY "contracts_delete" ON contracts
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

NOTIFY pgrst, 'reload schema';
