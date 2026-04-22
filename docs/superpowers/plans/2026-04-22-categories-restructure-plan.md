# Categories Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder categories with 21 domain-correct categories in 6 clusters, introduce a Stock archetype (Bonrollen, USB-Sticks) backed by a new `stock_items` + `stock_movements` schema, and switch the frontend column dispatcher from category-name strings to a typed `kind` enum.

**Architecture:** Schema-only changes ship as idempotent migration `012_categories_restructure.sql`. Destructive data wipe + reseed lives in a separate one-shot script `supabase/scripts/2026-04-22-categories-reseed.sql` (run manually in Supabase SQL Editor with explicit operator confirmation). Frontend updates `lib/category-columns.ts` to dispatch on `category.kind` instead of `category.name`, adds Stock-specific list/form components, and groups the CategoryGrid by cluster.

**Tech Stack:** Next.js 14 App Router, TypeScript strict mode, Supabase Postgres + RLS, Tailwind + shadcn/ui, Jest.

**Spec:** `docs/superpowers/specs/2026-04-22-categories-restructure-design.md`

**Branch:** `feat/warenwirtschaft-v2`

---

## File Map

**Created:**
- `supabase/migrations/012_categories_restructure.sql` — idempotent schema migration
- `supabase/scripts/2026-04-22-categories-reseed.sql` — one-shot data wipe + reseed
- `components/inventory/stock-item-list.tsx` — Stock-archetype list view
- `components/inventory/stock-item-form.tsx` — Stock-archetype add/edit form
- `lib/inventory/stock-queries.ts` — `fetchStockItems`, `fetchStockItem`

**Modified:**
- `lib/types.ts` — add `CategoryKind`, `Cluster`, extend `Category`, add `StockItem` + `StockMovement`
- `lib/category-columns.ts` — replace `getColumnsForCategory(name)` with `getColumnsForKind(kind)`; add `STOCK_COLUMNS`; add `MENGE` column key
- `lib/inventory/queries.ts` — `DEVICE_SELECT` already pulls `category(*)` so `kind`/`cluster` arrive automatically; no edit needed there
- `components/inventory/device-list.tsx` — call `getColumnsForKind` with `activeCategoryKind` instead of name
- `components/inventory/device-form.tsx` — gate Vectron fields on `category?.kind === 'kassenhardware'`
- `components/inventory/category-grid.tsx` — group tiles by cluster with section headings
- `components/inventory/category-device-list.tsx` — pass `activeCategoryKind` through to DeviceList
- `app/(protected)/inventory/page.tsx` — branch on `category.kind === 'stock'` to render StockItemList; pass kind through
- `__tests__/lib/category-columns.test.ts` — replace name-based tests with kind-based tests, add Stock coverage

**NOT modified (out of scope, deferred):**
- `components/dashboard/*` — Bestand-nach-Kategorie widget continues showing devices only; stock items reach the dashboard in a follow-up
- `app/api/chat/*` — chat context build is unchanged
- Wareneingangs-/Verkaufs-Belege for stock — stock movements are recorded directly via the Stock UI; no `purchases`/`sales` integration

---

## Phase A: Schema Migration (Idempotent)

### Task A1: Add `kind` and `cluster` columns to `categories`

**Files:**
- Create: `supabase/migrations/012_categories_restructure.sql`

- [ ] **Step 1: Create the migration file with header + the categories ALTER**

```sql
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
```

Note: `'sonstiges'` is included in the cluster CHECK as a safety default for the `Sonstiges` legacy category and any new categories an admin might create through the UI.

- [ ] **Step 2: Commit the partial migration**

```bash
git add supabase/migrations/012_categories_restructure.sql
git commit -m "feat(db): add kind + cluster columns to categories (012, part 1)"
```

### Task A2: Add `stock_items` table

**Files:**
- Modify: `supabase/migrations/012_categories_restructure.sql`

- [ ] **Step 1: Append the stock_items DDL**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/012_categories_restructure.sql
git commit -m "feat(db): add stock_items table (012, part 2)"
```

### Task A3: Add `stock_movements` table + enum

**Files:**
- Modify: `supabase/migrations/012_categories_restructure.sql`

- [ ] **Step 1: Append the enum + table DDL**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/012_categories_restructure.sql
git commit -m "feat(db): add stock_movements table + kind enum (012, part 3)"
```

### Task A4: RLS policies for stock_items + stock_movements

**Files:**
- Modify: `supabase/migrations/012_categories_restructure.sql`

- [ ] **Step 1: Append RLS DDL — mirrors the `devices` policies (see migration 007)**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/012_categories_restructure.sql
git commit -m "feat(db): RLS policies for stock_items + stock_movements (012, part 4)"
```

### Task A5: Inventory overview view

**Files:**
- Modify: `supabase/migrations/012_categories_restructure.sql`

- [ ] **Step 1: Append the view**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/012_categories_restructure.sql
git commit -m "feat(db): v_inventory_overview view unifies devices + stock (012, part 5)"
```

### Task A6: Apply migration 012 to the cloud DB

⚠️ **OPERATOR ACTION (not Claude):** This must be run manually by the user in the Supabase SQL Editor against the cloud-hosted project. The repo has no local Supabase instance.

- [ ] **Step 1: User opens Supabase Studio → SQL Editor**

URL: `https://studio.kassen-buch.cloud/project/<id>/sql/new` (use the studio behind Traefik basicauth)

- [ ] **Step 2: User pastes the entire contents of `supabase/migrations/012_categories_restructure.sql`**

- [ ] **Step 3: User clicks Run, confirms no errors**

Expected: success message, no rows affected (DDL only).

- [ ] **Step 4: User verifies new columns + tables exist**

Run in SQL editor:
```sql
SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'categories' AND column_name IN ('kind','cluster');
SELECT count(*) FROM stock_items;        -- expect 0
SELECT count(*) FROM stock_movements;    -- expect 0
SELECT * FROM v_inventory_overview LIMIT 1;  -- expect empty or current data
```

Expected: 2 rows for the columns query, 0 counts for the new tables, view returns rows for existing categories.

---

## Phase B: Data Wipe + Reseed (One-Shot)

### Task B1: Write the reseed script

**Files:**
- Create: `supabase/scripts/2026-04-22-categories-reseed.sql`

- [ ] **Step 1: Create the scripts folder if needed**

```bash
mkdir -p supabase/scripts
```

- [ ] **Step 2: Write the script**

```sql
-- supabase/scripts/2026-04-22-categories-reseed.sql
--
-- ONE-SHOT, DESTRUCTIVE. Wipes all inventory test data and reseeds
-- the 21 production categories. NOT idempotent — re-running wipes again.
--
-- Run manually in Supabase SQL Editor AFTER migration 012 has been applied.
-- Operator must explicitly confirm before running. Pre-check counts first.

-- ==========================================================================
-- 1. PRE-CHECK — review these counts before scrolling down to the wipe block.
-- ==========================================================================

SELECT 'devices'        AS tbl, count(*) FROM devices
UNION ALL SELECT 'vectron_details',     count(*) FROM vectron_details
UNION ALL SELECT 'purchase_items',      count(*) FROM purchase_items
UNION ALL SELECT 'purchases',           count(*) FROM purchases
UNION ALL SELECT 'sale_items',          count(*) FROM sale_items
UNION ALL SELECT 'sales',               count(*) FROM sales
UNION ALL SELECT 'stock_items',         count(*) FROM stock_items
UNION ALL SELECT 'stock_movements',     count(*) FROM stock_movements
UNION ALL SELECT 'models',              count(*) FROM models
UNION ALL SELECT 'manufacturers',       count(*) FROM manufacturers
UNION ALL SELECT 'suppliers',           count(*) FROM suppliers
UNION ALL SELECT 'categories',          count(*) FROM categories;

-- ==========================================================================
-- 2. WIPE — uncomment and run only after operator confirmation.
-- ==========================================================================

-- BEGIN;
-- DELETE FROM stock_movements;
-- DELETE FROM sale_items;
-- DELETE FROM sales;
-- DELETE FROM purchase_items;
-- DELETE FROM purchases;
-- DELETE FROM vectron_details;
-- DELETE FROM devices;
-- DELETE FROM stock_items;
-- DELETE FROM models;
-- DELETE FROM manufacturers;
-- DELETE FROM suppliers;
-- DELETE FROM categories;
-- COMMIT;

-- ==========================================================================
-- 3. RESEED CATEGORIES — 21 entries across 6 clusters.
--    Uncomment after the wipe COMMIT.
-- ==========================================================================

-- INSERT INTO categories (name, icon, kind, cluster) VALUES
--   -- Cluster 1: kassen
--   ('Kassenhardware',           'cash-register',     'kassenhardware', 'kassen'),
--   ('Dockingstation',           'dock',              'generic',        'kassen'),
--   ('Kundendisplay',            'monitor-smartphone','generic',        'kassen'),
--   ('Kassenschublade',          'archive',           'generic',        'kassen'),
--   ('Schlösser',                'key',               'generic',        'kassen'),
--   ('TSE Swissbit',             'shield-check',      'generic',        'kassen'),
--   ('Scanner',                  'scan',              'generic',        'kassen'),
--   -- Cluster 2: druck
--   ('Drucker',                  'printer',           'generic',        'druck'),
--   ('Küchenmonitor',            'monitor',           'generic',        'druck'),
--   ('Bonrollen',                'scroll',            'stock',          'druck'),
--   -- Cluster 3: mobile
--   ('Handhelds',                'tablet',            'generic',        'mobile'),
--   ('Ladestation',              'battery-charging',  'generic',        'mobile'),
--   ('Kiosksysteme',             'square-terminal',   'generic',        'mobile'),
--   -- Cluster 4: peripherie
--   ('Waagen',                   'scale',             'generic',        'peripherie'),
--   ('Externe Festplatte',       'hard-drive',        'generic',        'peripherie'),
--   ('USB-Sticks',               'usb',               'stock',          'peripherie'),
--   -- Cluster 5: netzwerk_strom
--   ('Netzwerktechnik',          'network',           'generic',        'netzwerk_strom'),
--   ('Netzteile',                'plug',              'generic',        'netzwerk_strom'),
--   ('USV',                      'battery-warning',   'generic',        'netzwerk_strom'),
--   -- Cluster 6: montage
--   ('Kassenmontagesystem',      'columns',           'simple',         'montage'),
--   ('Installationsmaterial',    'cable',             'simple',         'montage');

-- ==========================================================================
-- 4. POST-CHECK — uncomment after reseed.
-- ==========================================================================

-- SELECT cluster, count(*) FROM categories GROUP BY cluster ORDER BY cluster;
-- SELECT name, kind, cluster, icon FROM categories ORDER BY cluster, name;
```

Note: `'Ladestation'` is shortened from "Ladestation (Handhelds)" because the cluster context already disambiguates. If you prefer the longer name, change the INSERT row.

- [ ] **Step 3: Commit the script**

```bash
git add supabase/scripts/2026-04-22-categories-reseed.sql
git commit -m "feat(db): one-shot reseed script for 21 categories"
```

### Task B2: Operator confirmation gate

⚠️ **STOP AND ASK USER BEFORE PROCEEDING.** The user explicitly said: *"Frag mich aber erst bevor du löschst."*

- [ ] **Step 1: Run the PRE-CHECK block from the script**

In Supabase SQL Editor: paste only the SELECT block (Section 1 of the script). Show the user the resulting counts.

- [ ] **Step 2: Show the user the counts and ask for explicit go-ahead**

Sample message:
```
Pre-check counts (Supabase Studio):
  devices:         X
  models:          Y
  manufacturers:   Z
  suppliers:       N
  categories:      10
  …

Going to DELETE all of the above and reseed 21 categories.
Confirm with "ja löschen" before I proceed.
```

- [ ] **Step 3: Wait for user confirmation**

Do NOT run the wipe block until the user replies with explicit approval. If the user says no, stop and ask what to change.

### Task B3: Operator runs wipe + reseed

⚠️ **Only proceed after Task B2 confirmation.**

- [ ] **Step 1: Operator uncomments and runs Section 2 (wipe block)**

Watch for FK violation errors. If any occur, the wipe order in the script needs adjustment — stop and report.

- [ ] **Step 2: Operator uncomments and runs Section 3 (reseed)**

Expected: 21 rows inserted into `categories`.

- [ ] **Step 3: Operator runs Section 4 (post-check)**

Expected output:
```
cluster          count
kassen           7
druck            3
mobile           3
peripherie       3
netzwerk_strom   3
montage          2
```
Total = 21 categories.

---

## Phase C: TypeScript Types

### Task C1: Add kind/cluster/StockItem types to lib/types.ts

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add the new types and extend Category**

After line 3 (`export type DeviceStatus = ...`), add:

```typescript
export type CategoryKind = 'kassenhardware' | 'generic' | 'simple' | 'stock'
export type Cluster = 'kassen' | 'druck' | 'mobile' | 'peripherie' | 'netzwerk_strom' | 'montage' | 'sonstiges'
export type StockMovementKind = 'einkauf' | 'verkauf' | 'korrektur'
```

Replace the existing `Category` interface (lines 12-17) with:

```typescript
export interface Category {
  id: string
  name: string
  icon: string | null
  kind: CategoryKind
  cluster: Cluster
  created_at: string
}
```

At the end of the file (after `ChatMessage`), add:

```typescript
export interface StockItem {
  id: string
  model_id: string
  quantity: number
  location: string | null
  notes: string | null
  created_at: string
  updated_at: string
  model?: Model
}

export interface StockMovement {
  id: string
  stock_item_id: string
  kind: StockMovementKind
  delta: number
  unit_price: number | null
  reference_id: string | null
  user_id: string
  note: string | null
  created_at: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors. (Existing code does not yet read `kind`/`cluster`, so adding them as required fields is safe — every Category row from Supabase will carry them after migration 012.)

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): add CategoryKind, Cluster, StockItem, StockMovement"
```

---

## Phase D: Category Columns Dispatcher

### Task D1: Replace name-based tests with kind-based tests

**Files:**
- Modify: `__tests__/lib/category-columns.test.ts`

- [ ] **Step 1: Overwrite the file with the new test suite**

```typescript
import { getColumnsForKind, COLUMN_KEY } from '@/lib/category-columns'

describe('getColumnsForKind', () => {
  it('returns Kassenhardware columns for kind="kassenhardware"', () => {
    const cols = getColumnsForKind('kassenhardware')
    const keys = cols.map(c => c.key)
    expect(keys).toContain(COLUMN_KEY.SERIAL)
    expect(keys).toContain(COLUMN_KEY.SW_SERIAL)
    expect(keys).toContain(COLUMN_KEY.LICENSE_TYPE)
    expect(keys).toContain(COLUMN_KEY.FISKAL_2020)
    expect(keys).toContain(COLUMN_KEY.ZVT)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).toContain(COLUMN_KEY.VK)
  })

  it('returns generic columns for kind="generic"', () => {
    const cols = getColumnsForKind('generic')
    const keys = cols.map(c => c.key)
    expect(keys).toContain(COLUMN_KEY.SERIAL)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).not.toContain(COLUMN_KEY.SW_SERIAL)
    expect(keys).not.toContain(COLUMN_KEY.FISKAL_2020)
    expect(keys).not.toContain(COLUMN_KEY.MENGE)
  })

  it('returns simple columns for kind="simple"', () => {
    const cols = getColumnsForKind('simple')
    const keys = cols.map(c => c.key)
    expect(keys).not.toContain(COLUMN_KEY.SERIAL)
    expect(keys).toContain(COLUMN_KEY.NAME)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).toContain(COLUMN_KEY.VK)
    expect(keys).toContain(COLUMN_KEY.LOCATION)
    expect(keys).not.toContain(COLUMN_KEY.MENGE)
  })

  it('returns stock columns for kind="stock"', () => {
    const cols = getColumnsForKind('stock')
    const keys = cols.map(c => c.key)
    expect(keys).toContain(COLUMN_KEY.NAME)
    expect(keys).toContain(COLUMN_KEY.MANUFACTURER)
    expect(keys).toContain(COLUMN_KEY.MENGE)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).toContain(COLUMN_KEY.VK)
    expect(keys).toContain(COLUMN_KEY.LOCATION)
    expect(keys).not.toContain(COLUMN_KEY.SERIAL)
    expect(keys).not.toContain(COLUMN_KEY.STATUS)
  })

  it('falls back to generic for an undefined kind', () => {
    // @ts-expect-error testing runtime fallback
    const cols = getColumnsForKind(undefined)
    expect(cols.map(c => c.key)).toContain(COLUMN_KEY.SERIAL)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/category-columns -v`
Expected: ALL fail (function `getColumnsForKind` does not yet exist; `MENGE` column key does not yet exist).

### Task D2: Implement the new dispatcher

**Files:**
- Modify: `lib/category-columns.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
import type { CategoryKind } from '@/lib/types'

export const COLUMN_KEY = {
  MODEL: 'model',
  MANUFACTURER: 'manufacturer',
  SERIAL: 'serial',
  SW_SERIAL: 'sw_serial',
  FISKAL_2020: 'fiskal_2020',
  ZVT: 'zvt',
  LICENSE_TYPE: 'license_type',
  EK: 'ek',
  VK: 'vk',
  STATUS: 'status',
  LOCATION: 'location',
  NAME: 'name',
  MENGE: 'menge',
} as const

export type ColumnKey = (typeof COLUMN_KEY)[keyof typeof COLUMN_KEY]

export interface ColumnDef {
  key: ColumnKey
  label: string
  align?: 'left' | 'right'
}

const KASSENHARDWARE_COLUMNS: ColumnDef[] = [
  { key: COLUMN_KEY.MODEL,        label: 'Modell' },
  { key: COLUMN_KEY.MANUFACTURER, label: 'Hersteller' },
  { key: COLUMN_KEY.SERIAL,       label: 'HW-SN' },
  { key: COLUMN_KEY.SW_SERIAL,    label: 'SW-SN' },
  { key: COLUMN_KEY.LICENSE_TYPE, label: 'Lizenz' },
  { key: COLUMN_KEY.FISKAL_2020,  label: 'Fiskal 2020' },
  { key: COLUMN_KEY.ZVT,          label: 'ZVT' },
  { key: COLUMN_KEY.EK,           label: 'EK', align: 'right' },
  { key: COLUMN_KEY.VK,           label: 'VK', align: 'right' },
  { key: COLUMN_KEY.STATUS,       label: 'Status' },
]

const GENERIC_DEVICE_COLUMNS: ColumnDef[] = [
  { key: COLUMN_KEY.MODEL,        label: 'Modell' },
  { key: COLUMN_KEY.MANUFACTURER, label: 'Hersteller' },
  { key: COLUMN_KEY.SERIAL,       label: 'Seriennummer' },
  { key: COLUMN_KEY.EK,           label: 'EK', align: 'right' },
  { key: COLUMN_KEY.VK,           label: 'VK', align: 'right' },
  { key: COLUMN_KEY.STATUS,       label: 'Status' },
]

const SIMPLE_COLUMNS: ColumnDef[] = [
  { key: COLUMN_KEY.NAME,         label: 'Name' },
  { key: COLUMN_KEY.EK,           label: 'EK', align: 'right' },
  { key: COLUMN_KEY.VK,           label: 'VK', align: 'right' },
  { key: COLUMN_KEY.LOCATION,     label: 'Standort' },
  { key: COLUMN_KEY.STATUS,       label: 'Status' },
]

const STOCK_COLUMNS: ColumnDef[] = [
  { key: COLUMN_KEY.NAME,         label: 'Name' },
  { key: COLUMN_KEY.MANUFACTURER, label: 'Hersteller' },
  { key: COLUMN_KEY.MENGE,        label: 'Menge', align: 'right' },
  { key: COLUMN_KEY.EK,           label: 'EK', align: 'right' },
  { key: COLUMN_KEY.VK,           label: 'VK', align: 'right' },
  { key: COLUMN_KEY.LOCATION,     label: 'Standort' },
]

export function getColumnsForKind(kind: CategoryKind | undefined): ColumnDef[] {
  switch (kind) {
    case 'kassenhardware': return KASSENHARDWARE_COLUMNS
    case 'simple':         return SIMPLE_COLUMNS
    case 'stock':          return STOCK_COLUMNS
    case 'generic':
    default:               return GENERIC_DEVICE_COLUMNS
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest __tests__/lib/category-columns -v`
Expected: all 5 pass.

- [ ] **Step 3: Commit**

```bash
git add lib/category-columns.ts __tests__/lib/category-columns.test.ts
git commit -m "feat(ui): switch column dispatcher to category.kind, add Stock archetype"
```

---

## Phase E: Stock Queries

### Task E1: Add stock queries module

**Files:**
- Create: `lib/inventory/stock-queries.ts`

- [ ] **Step 1: Create the file**

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import type { StockItem } from '@/lib/types'

const STOCK_SELECT = `
  *,
  model:models(
    *,
    manufacturer:manufacturers(*),
    category:categories(*)
  )
`

export async function fetchStockItems(
  supabase: SupabaseClient,
  filter?: { categoryId?: string }
): Promise<StockItem[]> {
  let q = supabase.from('stock_items').select(STOCK_SELECT).order('created_at', { ascending: false })

  if (filter?.categoryId) {
    const { data: models } = await supabase.from('models').select('id').eq('category_id', filter.categoryId)
    const modelIds = (models ?? []).map(m => m.id)
    if (modelIds.length === 0) return []
    q = q.in('model_id', modelIds)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as StockItem[]
}

export async function fetchStockItem(supabase: SupabaseClient, id: string): Promise<StockItem | null> {
  const { data, error } = await supabase.from('stock_items').select(STOCK_SELECT).eq('id', id).single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as unknown as StockItem
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/inventory/stock-queries.ts
git commit -m "feat(queries): add fetchStockItems / fetchStockItem"
```

---

## Phase F: Update Callers to Use `kind`

### Task F1: device-list passes kind instead of name

**Files:**
- Modify: `components/inventory/device-list.tsx`
- Modify: `components/inventory/category-device-list.tsx`

- [ ] **Step 1: Find the existing prop in device-list.tsx**

Read the file. Locate the line:
```typescript
const columns = useMemo(() => getColumnsForCategory(activeCategoryName ?? 'Unbekannt'), [activeCategoryName])
```

- [ ] **Step 2: Change the import + the call**

Replace the import:
```typescript
import { getColumnsForKind, COLUMN_KEY, ColumnKey } from '@/lib/category-columns'
```

In the props interface for `DeviceList`, add:
```typescript
activeCategoryKind?: import('@/lib/types').CategoryKind
```

(Keep `activeCategoryName` for the breadcrumb; only the column dispatch changes.)

Change the column line to:
```typescript
const columns = useMemo(() => getColumnsForKind(activeCategoryKind), [activeCategoryKind])
```

- [ ] **Step 3: Plumb the prop through `category-device-list.tsx`**

Add `activeCategoryKind` to its props interface and forward it to DeviceList. The page passes it in (next task).

- [ ] **Step 4: Verify TypeScript compiles**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors. (`getColumnsForCategory` is gone; if any other file still imports it, fix it now.)

- [ ] **Step 5: Search for stragglers**

Run: `npx grep -rn "getColumnsForCategory" .` (or use the editor's project-wide search)
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add components/inventory/device-list.tsx components/inventory/category-device-list.tsx
git commit -m "feat(ui): device-list dispatches columns on kind"
```

### Task F2: device-form gates Vectron fields on kind

**Files:**
- Modify: `components/inventory/device-form.tsx`

- [ ] **Step 1: Read the file, find line 30**

Current:
```typescript
const isKassenhardware = category?.name === 'Kassenhardware'
```

- [ ] **Step 2: Replace with kind check**

```typescript
const isKassenhardware = category?.kind === 'kassenhardware'
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors. `Category` already has `kind` (added in Task C1).

- [ ] **Step 4: Commit**

```bash
git add components/inventory/device-form.tsx
git commit -m "feat(ui): gate Vectron fields on category.kind, not name"
```

---

## Phase G: CategoryGrid Cluster Headings

### Task G1: Group tiles by cluster

**Files:**
- Modify: `components/inventory/category-grid.tsx`

- [ ] **Step 1: Add a cluster ordering + label map at the top of the file**

After the existing imports, add:

```typescript
import type { Cluster } from '@/lib/types'

const CLUSTER_ORDER: Cluster[] = [
  'kassen',
  'druck',
  'mobile',
  'peripherie',
  'netzwerk_strom',
  'montage',
  'sonstiges',
]

const CLUSTER_LABEL: Record<Cluster, string> = {
  kassen: 'Kassen & direktes Kassen-Zubehör',
  druck: 'Druck & Ausgabe',
  mobile: 'Mobile Erfassung & Selbstbedienung',
  peripherie: 'Peripherie',
  netzwerk_strom: 'Netzwerk & Strom',
  montage: 'Montage & Kabelage',
  sonstiges: 'Sonstiges',
}
```

- [ ] **Step 2: Group categories by cluster inside the component**

Inside `CategoryGrid`, before the return:

```typescript
const grouped = CLUSTER_ORDER
  .map(cluster => ({
    cluster,
    label: CLUSTER_LABEL[cluster],
    items: categories.filter(c => c.cluster === cluster),
  }))
  .filter(g => g.items.length > 0)
```

- [ ] **Step 3: Replace the flat tile loop with grouped rendering**

Keep the "Gesamt" tile at the top (unchanged). After it, replace the `categories.map(...)` block with:

```tsx
{grouped.map(group => (
  <section key={group.cluster} className="space-y-3">
    <div className="kb-label text-[var(--ink-3)]">{group.label}</div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px]">
      {group.items.map(category => (
        <Link key={category.id} href={`/inventory?category=${category.id}`} className="group">
          {/* existing tile JSX (lines 65-83 in the original) — keep as-is */}
        </Link>
      ))}
    </div>
  </section>
))}
```

(Move the existing tile JSX inside the inner loop. The "Gesamt" tile keeps its own block above the `grouped.map` so it always appears first.)

- [ ] **Step 4: Verify TypeScript compiles**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Smoke test in browser**

Run: `npm run dev` (or `node node_modules/next/dist/bin/next dev` on Windows)
Visit `http://localhost:3000/inventory`. Expected: 6 cluster sections rendered with correct labels, "Gesamt" tile on top. After Phase B has run, all 21 categories appear in their clusters with 0 device counts.

- [ ] **Step 6: Commit**

```bash
git add components/inventory/category-grid.tsx
git commit -m "feat(ui): group CategoryGrid tiles by cluster"
```

---

## Phase H: Stock UI

### Task H1: Stock list component

**Files:**
- Create: `components/inventory/stock-item-list.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { StockItem } from '@/lib/types'
import { getColumnsForKind, COLUMN_KEY } from '@/lib/category-columns'

interface StockItemListProps {
  items: StockItem[]
  categoryName: string
  canAdd: boolean
}

export function StockItemList({ items, categoryName, canAdd }: StockItemListProps) {
  const columns = getColumnsForKind('stock')

  return (
    <div className="max-w-[1280px] mx-auto space-y-[18px]">
      <div className="kb-h-row flex-col md:flex-row items-start md:items-end gap-4 pb-4 mb-2 border-b border-[var(--rule-soft)]">
        <div>
          <div className="kb-label mb-1.5">
            <Link href="/inventory" className="hover:underline">Inventar</Link> · {categoryName}
          </div>
          <h1 className="kb-h1">{categoryName}</h1>
          <div className="text-[13px] text-[var(--ink-3)] mt-1">{items.length} Posten</div>
        </div>
        {canAdd && (
          <Button asChild>
            <Link href={`/inventory/new?kind=stock&category=${encodeURIComponent(categoryName)}`}>
              <Plus className="h-3.5 w-3.5" />
              Bestand erfassen
            </Link>
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center text-[var(--ink-3)] py-12">Keine Bestandsposten in dieser Kategorie.</div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left border-b border-[var(--rule)]">
              {columns.map(col => (
                <th key={col.key} className={`py-2 px-3 kb-label ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-[var(--rule-soft)] hover:bg-[var(--paper-2)]">
                {columns.map(col => (
                  <td key={col.key} className={`py-2 px-3 ${col.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                    {renderStockCell(item, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function renderStockCell(item: StockItem, key: string): string {
  switch (key) {
    case COLUMN_KEY.NAME:         return item.model?.modellname ?? '—'
    case COLUMN_KEY.MANUFACTURER: return item.model?.manufacturer?.name ?? '—'
    case COLUMN_KEY.MENGE:        return String(item.quantity)
    case COLUMN_KEY.EK:           return item.model?.default_ek != null ? `${item.model.default_ek.toFixed(2)} €` : '—'
    case COLUMN_KEY.VK:           return item.model?.default_vk != null ? `${item.model.default_vk.toFixed(2)} €` : '—'
    case COLUMN_KEY.LOCATION:     return item.location ?? '—'
    default:                      return '—'
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/inventory/stock-item-list.tsx
git commit -m "feat(ui): StockItemList component"
```

### Task H2: Inventory page routes by kind

**Files:**
- Modify: `app/(protected)/inventory/page.tsx`

- [ ] **Step 1: Read current file (already mapped above)**

Current shape: server component that handles 3 cases — no `category` param (grid), `category=all` (all devices), `category=<id>` (filtered).

- [ ] **Step 2: Update the third branch to fork on `category.kind`**

After fetching the single category and BEFORE the `redirect('/inventory')` early-return, branch:

```typescript
import { fetchStockItems } from '@/lib/inventory/stock-queries'
import { StockItemList } from '@/components/inventory/stock-item-list'
// (also keep existing imports)

// ...inside the single-category branch, after fetching `category`...

if (!category) {
  redirect('/inventory')
}

if (category.kind === 'stock') {
  const items = await fetchStockItems(supabase, { categoryId })
  return (
    <StockItemList
      items={items}
      categoryName={category.name}
      canAdd={canAdd}
    />
  )
}

// Existing CategoryDeviceList branch — pass kind through
const devices = await fetchDevices(supabase, { categoryId })
return (
  <CategoryDeviceList
    devices={devices}
    categories={(categories ?? []) as Category[]}
    canAdd={canAdd}
    categoryName={category.name}
    activeCategoryName={category.name}
    activeCategoryKind={category.kind}      // NEW
    hideCategoryFilter
    emptyMessage="Keine Geräte in dieser Kategorie."
  />
)
```

(Restructure the current `Promise.all` so we fetch `category` first, then conditionally fetch either `devices` or `stock_items` — avoids a useless device fetch for stock categories.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors. If `CategoryDeviceList` props complains about the new `activeCategoryKind`, that prop was added in Task F1 — re-check.

- [ ] **Step 4: Smoke test in browser**

Visit:
- `/inventory` → cluster grid shows 6 sections
- `/inventory?category=<bonrollen-id>` → StockItemList renders (empty initially)
- `/inventory?category=<drucker-id>` → CategoryDeviceList renders (empty initially)
- `/inventory?category=all` → flat device list (empty initially)

(Get UUIDs from Supabase Studio after Phase B has run.)

- [ ] **Step 5: Commit**

```bash
git add app/\(protected\)/inventory/page.tsx
git commit -m "feat(routing): /inventory branches Stock vs Device by category.kind"
```

### Task H3: Defer stock-item-form to follow-up

The MVP exposes the StockItemList route; full add/edit form for Stock is deferred. The "Bestand erfassen" button currently links to `/inventory/new?kind=stock&...`. That route does not exist yet — clicking it will 404.

- [ ] **Step 1: Decide whether to scaffold a placeholder page now**

If the user wants to be able to add stock items immediately, scaffold a minimal page that creates a `stock_items` row + initial `stock_movements` entry. Otherwise leave the button as a known dead link until the follow-up.

- [ ] **Step 2: Ask the user**

Sample: "Stock-Add-Form ist noch nicht im Plan. Soll ich jetzt eine Minimal-Seite mitbauen, oder im Folgeticket?"

Default if no answer: defer.

---

## Phase I: Final Verification

### Task I1: Full typecheck + tests

- [ ] **Step 1: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npx jest`
Expected: all tests pass. (Note the CLAUDE.md caveat: in Git Bash the exit code is unreliable — eyeball the output.)

### Task I2: Manual browser walk-through

Run: `npm run dev` (or the Windows fallback)

- [ ] **Step 1: Visit `/inventory`**

Expected: 6 cluster sections in correct order with all 21 category tiles. "Gesamt" tile on top. All counts = 0.

- [ ] **Step 2: Click into a Generic category (e.g., Drucker)**

Expected: empty CategoryDeviceList, breadcrumb shows "Inventar > Drucker", generic columns (Modell, Hersteller, Seriennummer, EK, VK, Status). "Gerät anlegen" visible for admin.

- [ ] **Step 3: Click into Kassenhardware**

Expected: CategoryDeviceList with full Vectron columns (HW-SN, SW-SN, Lizenz, Fiskal 2020, ZVT).

- [ ] **Step 4: Click into Bonrollen (Stock)**

Expected: StockItemList with columns (Name, Hersteller, Menge, EK, VK, Standort). "Bestand erfassen" button (or 404 if Task H3 deferred).

- [ ] **Step 5: Click into Installationsmaterial (Simple)**

Expected: CategoryDeviceList with simple columns (Name, EK, VK, Standort, Status).

- [ ] **Step 6: Visit `/inventory?category=all`**

Expected: empty flat device list, category filter dropdown visible.

### Task I3: Final commit + tag

- [ ] **Step 1: Run git status, ensure no leftover changes**

```bash
git status
```

- [ ] **Step 2: If everything is clean, the work is done**

The branch `feat/warenwirtschaft-v2` now contains the full restructure. No tag/merge — that's a user decision.

---

## Notes for the Engineer

- **Migrations are manual.** There is no `supabase db push` or local Supabase instance. Every SQL change must be pasted into the Supabase SQL Editor at `studio.kassen-buch.cloud`. Verify by re-querying after running.
- **Idempotence matters.** Migration 012 must be safe to re-run — use `IF NOT EXISTS`, exception-wrapped enum/constraint creation, `DROP POLICY IF EXISTS` before `CREATE POLICY`. The reseed script (`scripts/`) is the only intentionally one-shot piece.
- **User confirmation gate (Task B2).** The user said: *"Frag mich aber erst bevor du löschst!"*. Do not run the wipe block without explicit go-ahead.
- **TypeScript strict.** Adding `kind` and `cluster` as required fields on `Category` is intentional — every row from Supabase will carry them after migration 012, and missing them at compile time would be a real bug.
- **Out of scope (separate plans):** dashboard widget update for stock counts, Wareneingangs-/Verkaufs-Beleg integration for stock, full Stock add/edit form, Phase 2 (TSE install history via Arbeitsbericht).
