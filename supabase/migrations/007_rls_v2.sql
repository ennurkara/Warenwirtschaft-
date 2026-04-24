-- supabase/migrations/007_rls_v2.sql

-- Enable RLS
ALTER TABLE manufacturers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE models          ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kassen_details  ENABLE ROW LEVEL SECURITY;

-- Helper get_my_role() existiert bereits aus 002_rls_policies.sql.

-- Muster: SELECT = authenticated; INSERT/UPDATE = admin+mitarbeiter; DELETE = admin.
-- (devices_update-Sonderfall wird unten separat gehandhabt.)

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'manufacturers','models','suppliers','customers',
    'purchases','purchase_items','sales','sale_items','kassen_details'
  ] LOOP
    EXECUTE format('CREATE POLICY %I_select ON %I FOR SELECT TO authenticated USING (true);', tbl, tbl);
    EXECUTE format('CREATE POLICY %I_insert ON %I FOR INSERT TO authenticated WITH CHECK (get_my_role() IN (''admin'',''mitarbeiter''));', tbl, tbl);
    EXECUTE format('CREATE POLICY %I_update ON %I FOR UPDATE TO authenticated USING (get_my_role() = ''admin'');', tbl, tbl);
    EXECUTE format('CREATE POLICY %I_delete ON %I FOR DELETE TO authenticated USING (get_my_role() = ''admin'');', tbl, tbl);
  END LOOP;
END $$;

-- devices UPDATE: mitarbeiter darf devices.status auf 'verkauft' setzen (für Sell-Flow).
-- Bestehende devices_update-Policy aus 002 erlaubt nur admin — erweitern:
DROP POLICY IF EXISTS devices_update ON devices;
CREATE POLICY devices_update ON devices FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin','mitarbeiter'));
