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
