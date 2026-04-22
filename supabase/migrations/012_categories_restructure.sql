-- supabase/migrations/012_categories_restructure.sql
--
-- Categories restructure (Phase 1 of 2026-04-22 redesign):
--  - Add `kind` (column-archetype) + `cluster` (UI grouping) to categories.
--  - Create stock_items + stock_movements for consumables (Bonrollen, USB-Sticks).
--  - View v_inventory_overview unifies devices + stock for the dashboard.
--
-- This migration is IDEMPOTENT: it can be re-run safely. The destructive data
-- wipe + reseed lives in supabase/scripts/2026-04-22-categories-reseed.sql
-- (one-shot, NOT a migration).

-- 1. categories: kind + cluster columns

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'generic';

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS cluster text NOT NULL DEFAULT 'sonstiges';

DO $$ BEGIN
  ALTER TABLE categories
    ADD CONSTRAINT categories_kind_check
    CHECK (kind IN ('kassenhardware', 'generic', 'simple', 'stock'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE categories
    ADD CONSTRAINT categories_cluster_check
    CHECK (cluster IN ('kassen', 'druck', 'mobile', 'peripherie', 'netzwerk_strom', 'montage', 'sonstiges'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. stock_items: one row per (Stock-)model with current quantity

CREATE TABLE IF NOT EXISTS stock_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id    uuid NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
  quantity    integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  location    text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_items_model_uniq ON stock_items(model_id);

DROP TRIGGER IF EXISTS stock_items_updated_at ON stock_items;
CREATE TRIGGER stock_items_updated_at
  BEFORE UPDATE ON stock_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. stock_movements: audit log of every quantity delta

DO $$ BEGIN
  CREATE TYPE stock_movement_kind AS ENUM ('einkauf', 'verkauf', 'korrektur');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS stock_movements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id  uuid NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  kind           stock_movement_kind NOT NULL,
  delta          integer NOT NULL CHECK (delta <> 0),
  unit_price     numeric(10,2),
  reference_id   uuid,
  user_id        uuid NOT NULL REFERENCES profiles(id),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_item_idx ON stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS stock_movements_created_idx ON stock_movements(created_at DESC);

-- 4. RLS for stock_items

ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_items_select_all" ON stock_items;
CREATE POLICY "stock_items_select_all"
  ON stock_items FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "stock_items_insert_admin_staff" ON stock_items;
CREATE POLICY "stock_items_insert_admin_staff"
  ON stock_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin','mitarbeiter'))
  );

DROP POLICY IF EXISTS "stock_items_update_admin_staff" ON stock_items;
CREATE POLICY "stock_items_update_admin_staff"
  ON stock_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin','mitarbeiter'))
  );

DROP POLICY IF EXISTS "stock_items_delete_admin" ON stock_items;
CREATE POLICY "stock_items_delete_admin"
  ON stock_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. RLS for stock_movements

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_movements_select_all" ON stock_movements;
CREATE POLICY "stock_movements_select_all"
  ON stock_movements FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "stock_movements_insert_admin_staff" ON stock_movements;
CREATE POLICY "stock_movements_insert_admin_staff"
  ON stock_movements FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin','mitarbeiter'))
  );

-- Movements are append-only: no UPDATE/DELETE policies, so non-superuser
-- writes are silently denied. Corrections happen via a new 'korrektur' row.

-- 6. v_inventory_overview: unified count per category for dashboard
--    For device categories: 1 row in devices = 1 unit.
--    For stock categories: sum(quantity) across stock_items in that category.

CREATE OR REPLACE VIEW v_inventory_overview AS
SELECT
  c.id           AS category_id,
  c.name         AS category_name,
  c.kind         AS category_kind,
  c.cluster      AS category_cluster,
  CASE
    WHEN c.kind = 'stock'
      THEN COALESCE((
        SELECT SUM(si.quantity)
        FROM stock_items si
        JOIN models m ON m.id = si.model_id
        WHERE m.category_id = c.id
      ), 0)
    ELSE COALESCE((
      SELECT COUNT(*)
      FROM devices d
      JOIN models m ON m.id = d.model_id
      WHERE m.category_id = c.id
    ), 0)
  END            AS unit_count
FROM categories c;
