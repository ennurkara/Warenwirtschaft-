-- supabase/migrations/044_customer_sites.sql
--
-- Filialen ("Sites") pro Kunde. Vectron-Operatoren haben oft mehrere Filialen
-- (Baeckerei Ziegler: 32, Baeckerei Betz: 3). Eine Kasse haengt an einer Filiale,
-- nicht direkt am Kunden. Fuer "sonstige" Kunden bleibt das optional.
--
-- vectron_site_id ist der Re-Sync-Anker fuer Daten aus dem MyVectron-Portal.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS customer_sites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vectron_site_id uuid,
  site_no         text,
  name            text NOT NULL,
  street          text,
  postal_code     text,
  city            text,
  country         text DEFAULT 'DE',
  email           text,
  phone           text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- UNIQUE-Index fuer Re-Sync vom MyVectron-Portal
CREATE UNIQUE INDEX IF NOT EXISTS customer_sites_vectron_site_id_uniq
  ON customer_sites(vectron_site_id)
  WHERE vectron_site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS customer_sites_customer_idx
  ON customer_sites(customer_id);

DROP TRIGGER IF EXISTS customer_sites_updated_at ON customer_sites;
CREATE TRIGGER customer_sites_updated_at
  BEFORE UPDATE ON customer_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE customer_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_sites_select" ON customer_sites;
CREATE POLICY "customer_sites_select" ON customer_sites
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "customer_sites_insert" ON customer_sites;
CREATE POLICY "customer_sites_insert" ON customer_sites
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'mitarbeiter'));

DROP POLICY IF EXISTS "customer_sites_update" ON customer_sites;
CREATE POLICY "customer_sites_update" ON customer_sites
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'mitarbeiter'));

DROP POLICY IF EXISTS "customer_sites_delete" ON customer_sites;
CREATE POLICY "customer_sites_delete" ON customer_sites
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

NOTIFY pgrst, 'reload schema';
