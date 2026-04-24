# Categories Restructure — Design

**Status:** Draft, awaiting user review
**Date:** 2026-04-22
**Branch:** `feat/warenwirtschaft-v2`
**Companion plan:** TBD (`docs/superpowers/plans/2026-04-22-categories-restructure-plan.md`)

## Goal

Replace the placeholder category list (10 generic IT categories) with a domain-correct set of 21 categories grouped into 6 thematic clusters, reflecting how a Kassensystem-Fachhändler actually thinks about inventory. Introduce a second device archetype — **Stock items** (consumables tracked by quantity instead of by serial number) — to handle Bonrollen and USB-Sticks.

## Current State

`categories` table contains 10 seeded entries from migrations 001/008/010:

```
Kassenhardware, Drucker, Scanner, Kabel, Monitor,
Tastatur, Maus, Netzwerk, Sonstiges, TSE Swissbit
```

The `devices` table (since migration 005) has no `name`, no `category_id`, and no `quantity`. Each row is exactly one physical, serialized device. Category and display name come via the join `devices → models → categories`.

The UI in `lib/category-columns.ts` dispatches on category **name** (string) to choose a column set:
- `'Kassenhardware'` → full Vectron schema (HW-SN, SW-SN, Lizenz, Fiskal 2020, ZVT)
- `'Kabel'`, `'Sonstiges'` → simplified (Name + EK/VK + Standort)
- everything else → generic (Modell, Hersteller, Seriennummer, EK, VK, Status)

All current devices/models/manufacturers/suppliers are test data and will be wiped during this restructure (per user, only `auth.users` and `profiles` survive).

## Target Structure

### 21 Categories in 6 Clusters

```
1) KASSEN & DIREKTES KASSEN-ZUBEHÖR        [archetype: Kassenhardware / Generic]
   - Kassenhardware
   - Dockingstation (HP-Kassen)
   - Kundendisplay
   - Kassenschublade
   - Schlösser                              ← merged: Kellner + Bäcker
   - TSE Swissbit
   - Scanner

2) DRUCK & AUSGABE                         [Generic / Stock]
   - Drucker
   - Küchenmonitor
   - Bonrollen                              ★ Stock

3) MOBILE ERFASSUNG & SELBSTBEDIENUNG      [Generic]
   - Handhelds
   - Ladestation (Handhelds)
   - Kiosksysteme

4) PERIPHERIE                              [Generic / Stock]
   - Waagen
   - Externe Festplatte
   - USB-Sticks                             ★ Stock

5) NETZWERK & STROM                        [Generic]
   - Netzwerktechnik                        ← Switch + DLAN/Repeater + Funkantenne
   - Netzteile                              ← Drucker- + Kassen-Netzteile
   - USV

6) MONTAGE & KABELAGE                      [Simple]
   - Kassenmontagesystem                    ← Spacepole + Motul + Anker
   - Installationsmaterial                  ← Steckdosenleisten + Kabelmanagement + Kabel
```

### Cluster as Metadata

Clusters are organisational, not technical. They drive the **CategoryGrid** layout (sections/headings) and reporting groupings. Implementation: add a `cluster` column to `categories` (text, NOT NULL) — values `kassen`, `druck`, `mobile`, `peripherie`, `netzwerk_strom`, `montage`. Keeps grid grouping cheap; no separate `clusters` table.

### Four Column Archetypes

| | A: Kassenhardware | B: Generic | C: Simple | **D: Stock** ★ NEW |
|---|---|---|---|---|
| Modell | ✓ | ✓ | – | – |
| Hersteller | ✓ | ✓ | – | (optional) |
| HW-SN | ✓ | – | – | – |
| Seriennummer | – | ✓ | – | – |
| SW-SN, Lizenz, Fiskal 2020, ZVT | ✓ | – | – | – |
| Name | – | – | ✓ | ✓ |
| **Menge** | – | – | – | **✓** |
| EK / VK | ✓ | ✓ | ✓ | ✓ (per unit) |
| Standort | – | – | ✓ | ✓ |
| Status | ✓ | ✓ | ✓ | – (n/a for consumables) |

Mapping category → archetype is encoded as a `kind` enum on `categories` (`kassenhardware | generic | simple | stock`). The frontend's `getColumnsForCategory()` switches on `kind`, not on name. This decouples columns from naming and lets admins rename categories without breaking the UI.

## Schema Changes

### New: `stock_items` table

Variante B-clean: stock is its own world, not a bolt-on to `devices`.

```sql
CREATE TABLE stock_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id    uuid NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
  quantity    integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  location    text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX stock_items_model_uniq ON stock_items(model_id);
```

One row per (Stock-)model. Quantity is the source of truth. `model_id` references the same `models` table devices use — Stock items just live in models whose category has `kind = 'stock'`.

**Movements:** A separate `stock_movements` table tracks deltas (purchase, sale, adjustment) so we keep audit history without bloating `stock_items` itself:

```sql
CREATE TYPE stock_movement_kind AS ENUM ('einkauf', 'verkauf', 'korrektur');

CREATE TABLE stock_movements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id  uuid NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  kind           stock_movement_kind NOT NULL,
  delta          integer NOT NULL,        -- positive for einkauf/correction-up, negative for verkauf
  unit_price     numeric(10,2),           -- EK for einkauf, VK for verkauf
  reference_id   uuid,                    -- links to purchases.id or sales.id when applicable
  user_id        uuid NOT NULL REFERENCES profiles(id),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

**Purchase/Sale integration:** `purchase_items` and `sale_items` continue to reference `devices` for serialized goods. For stock, use the `stock_movements.reference_id` mechanism — no FK to `purchase_items`/`sale_items` because those tables are device-specific. (A view will reunify both worlds for the dashboard.)

### Modified: `categories` table

```sql
ALTER TABLE categories
  ADD COLUMN kind     text NOT NULL DEFAULT 'generic'
    CHECK (kind IN ('kassenhardware', 'generic', 'simple', 'stock')),
  ADD COLUMN cluster  text NOT NULL DEFAULT 'sonstiges'
    CHECK (cluster IN ('kassen', 'druck', 'mobile', 'peripherie', 'netzwerk_strom', 'montage'));
```

Both columns stay text (small, fixed sets, easier to read in queries) rather than enums — enums are awkward to extend later.

### Data Wipe + Reseed (one migration)

User confirmed all current devices/models/manufacturers/suppliers/categories are test data. **Before running this part, the implementation step will list every row to be deleted and ask for explicit go-ahead.** Order of deletion (FK-respecting):

1. `stock_movements` (none yet, but listed for completeness)
2. `sale_items`, `sales`
3. `purchase_items`, `purchases`
4. `vectron_details`
5. `devices`
6. `stock_items` (none yet)
7. `models`
8. `manufacturers`
9. `suppliers`
10. `categories`

**NOT deleted:** `auth.users`, `profiles`, role/RLS policies, storage buckets, `device-photos` storage objects (orphaned but harmless).

Then re-seed `categories` with the 21 new entries (with `kind`, `cluster`, `icon`).

## Frontend Changes

### `lib/category-columns.ts`

Switch dispatch from category **name** to category **kind**:

```ts
export function getColumnsForKind(kind: CategoryKind): ColumnDef[] {
  switch (kind) {
    case 'kassenhardware': return KASSENHARDWARE_COLUMNS
    case 'simple':         return SIMPLE_COLUMNS
    case 'stock':          return STOCK_COLUMNS  // new
    case 'generic':
    default:               return GENERIC_DEVICE_COLUMNS
  }
}
```

`STOCK_COLUMNS` adds `MENGE` and drops `SERIAL` / `STATUS`. Existing call sites (`device-list.tsx`, etc.) need access to `category.kind`, which means adding `kind` to the `DEVICE_SELECT` join.

### CategoryGrid (already specified in 2026-04-20-inventory-categories-design.md)

Extend with cluster headings: tiles grouped under cluster names. Order: kassen → druck → mobile → peripherie → netzwerk_strom → montage. "Alle Geräte" tile stays at top, ungrouped.

### Stock UI

Stock categories need a different list component (`StockItemList`) and a different "add" flow (set initial quantity, no serial). The detail view shows current quantity + movements history. Sell/Einkauf for stock items adjusts quantity and writes a `stock_movements` row.

Out of scope for this spec: full polish of stock UI. The MVP is the data model + a basic list/edit form. The `/inventory?category=<stock-cat-id>` route renders the new list component.

## Migration Plan (high-level — full plan in implementation step)

To preserve the project convention "migrations are append-only and idempotent" (CLAUDE.md), the work splits into **one idempotent migration + one one-shot data script**:

**`supabase/migrations/012_categories_restructure.sql`** — idempotent, schema only:

1. `ALTER TABLE categories` — `ADD COLUMN IF NOT EXISTS kind`, `ADD COLUMN IF NOT EXISTS cluster` (with CHECK constraints).
2. `CREATE TYPE stock_movement_kind` (wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`).
3. `CREATE TABLE IF NOT EXISTS stock_items`, `CREATE TABLE IF NOT EXISTS stock_movements`.
4. RLS policies for `stock_items` and `stock_movements` (mirror the `devices` policies — admin/mitarbeiter write, viewer read). Use `DROP POLICY IF EXISTS ... ; CREATE POLICY ...` pattern.
5. View `v_inventory_overview` that unions devices + stock_items for the dashboard (`CREATE OR REPLACE VIEW`).

**`supabase/scripts/2026-04-22-categories-reseed.sql`** — one-shot, destructive, NOT in `migrations/`:

1. Pre-check: `SELECT count(*) FROM devices, models, manufacturers, suppliers, categories;` — printed before deletion so the operator can abort.
2. Wipe data in FK-respecting order:
   1. `stock_movements`, 2. `sale_items`, `sales`, 3. `purchase_items`, `purchases`, 4. `vectron_details`, 5. `devices`, 6. `stock_items`, 7. `models`, 8. `manufacturers`, 9. `suppliers`, 10. `categories`.
3. Re-seed `categories` with the 21 entries (each with `kind`, `cluster`, `icon`).

The script is run **once, manually, in the Supabase SQL Editor**, with explicit operator confirmation. It is not part of the migration sequence so re-running 012 doesn't wipe data.

## Out of Scope

- Phase 2 (TSE-Installations­historie, Kundenkartei) — separate spec, builds on top of this.
- Migrating real production data into the new structure (none exists yet).
- Admin UI redesign for the categories CRUD page.
- Multi-language support (UI stays German).
- Per-Stock-item supplier defaults (deferred — stock items use model defaults like devices already do).

## Resolved Decisions

**Q1 — Stock vs. Belege:** **Stock stays separate.** Reason: stock items (Bonrollen, USB-Sticks) come from different suppliers than the device-side belegs in practice. `stock_movements` is the standalone audit log. `purchase_items` / `sale_items` remain device-only.

**Q2 — Hersteller column on stock list:** **Show Hersteller as its own column** on the Stock list UI. Reason: for Bonrollen, Hersteller often equals Lieferant, and the column is a useful at-a-glance signal. Implementation: include `models.manufacturer_id → manufacturers.name` in the `STOCK_SELECT` join.

## Open Questions

None remain at spec time.

## Files Likely Touched

- `supabase/migrations/012_categories_restructure.sql` (new)
- `lib/category-columns.ts` (rewrite dispatch on `kind`)
- `lib/types.ts` (add `CategoryKind`, `Cluster`, `StockItem`, `StockMovement`)
- `lib/inventory/queries.ts` (`DEVICE_SELECT` joins `category.kind`; new `STOCK_SELECT`)
- `components/inventory/category-grid.tsx` (cluster headings)
- `components/inventory/stock-item-list.tsx` (new)
- `components/inventory/stock-item-form.tsx` (new)
- `app/(protected)/inventory/page.tsx` (route stock vs device kind)
- `__tests__/lib/category-columns.test.ts` (update for kind dispatch)
