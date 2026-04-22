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
