# Warenwirtschaft v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warenwirtschaft auf Einzelstück-Tracking mit Einkauf/Verkauf-Belegen, Kassen-spezifischen Feldern und KPI-Dashboard umbauen.

**Architecture:** Neue Tabellen (`manufacturers`, `models`, `suppliers`, `customers`, `purchases`, `purchase_items`, `sales`, `sale_items`, `kassen_details`) + bestehende `devices` umstrukturiert. Frontend lädt Spalten-Schema je Kategorie, Formulare schalten Kassen-Felder ein. Dashboard nutzt SQL-Views.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (PostgreSQL), Tailwind + shadcn/ui, Jest.

**Referenz-Spec:** `docs/superpowers/specs/2026-04-21-warenwirtschaft-v2-design.md`

**Ausführungsreihenfolge:** Phasen 1-8 müssen in dieser Reihenfolge laufen, da spätere Phasen auf früheren aufbauen. Innerhalb einer Phase können die Tasks der Reihe nach abgearbeitet werden.

---

## Phase 1: Datenbank-Schema

### Task 1: Vor-Check — Keine Produktivdaten

**Files:**
- Nur Query ausführen (Supabase Dashboard oder SQL Editor)

- [ ] **Step 1: Prüfen, ob echte Daten vorhanden sind**

Folgende Queries im Supabase SQL Editor (oder via `psql`) ausführen:

```sql
SELECT count(*) AS devices_count FROM devices;
SELECT count(*) AS movements_count FROM device_movements;
SELECT count(*) AS profiles_count FROM profiles;
```

Erwartet:
- `devices_count = 0` (oder nur Testdaten die verworfen werden dürfen)
- `movements_count = 0`
- `profiles_count` = Anzahl Test-User (unkritisch, bleiben erhalten)

- [ ] **Step 2: Bei Treffer stoppen**

Wenn `devices_count > 0`: **STOPP**. Plan mit User besprechen, ob Daten erhalten werden müssen (Daten-Migration nötig). Dieser Plan setzt leere Tabellen voraus.

Bei `devices_count = 0` → weiter mit Task 2.

---

### Task 2: Migration 003 — neue Stammdaten-Tabellen

**Files:**
- Create: `supabase/migrations/003_warenwirtschaft_core.sql`

- [ ] **Step 1: Migrationsdatei anlegen mit Stammdaten-Tabellen**

```sql
-- supabase/migrations/003_warenwirtschaft_core.sql
-- Hersteller
CREATE TABLE manufacturers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Modell-Katalog
CREATE TABLE models (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id uuid NOT NULL REFERENCES manufacturers(id) ON DELETE RESTRICT,
  category_id     uuid NOT NULL REFERENCES categories(id)    ON DELETE RESTRICT,
  modellname      text NOT NULL,
  variante        text,
  version         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manufacturer_id, modellname, variante, version)
);

CREATE INDEX models_manufacturer_idx ON models(manufacturer_id);
CREATE INDEX models_category_idx     ON models(category_id);

-- Lieferanten
CREATE TABLE suppliers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text,
  phone      text,
  address    text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Kunden
CREATE TABLE customers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text,
  phone      text,
  address    text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Migration in Supabase ausführen**

Via Supabase Dashboard → SQL Editor → den Inhalt einfügen und ausführen.

Erwartet: `Success. No rows returned.` und Tabellen existieren in Schema-Browser.

Query zur Verifikation:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN
  ('manufacturers','models','suppliers','customers');
```
Erwartet: 4 Rows.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_warenwirtschaft_core.sql
git commit -m "feat(db): add manufacturers, models, suppliers, customers tables"
```

---

### Task 3: Migration 003 (Teil 2) — Beleg-Tabellen und Kassen-Details

**Files:**
- Create: `supabase/migrations/004_warenwirtschaft_belege.sql`

- [ ] **Step 1: Beleg-Tabellen und kassen_details anlegen**

```sql
-- supabase/migrations/004_warenwirtschaft_belege.sql

-- Einkaufsbeleg-Kopf
CREATE TABLE purchases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  rechnungsnr text,
  datum       date NOT NULL,
  notes       text,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchases_supplier_idx ON purchases(supplier_id);
CREATE INDEX purchases_datum_idx    ON purchases(datum);

-- Einkaufsbeleg-Positionen (1 Position = 1 Einzelgerät)
CREATE TABLE purchase_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  device_id   uuid NOT NULL UNIQUE,  -- FK wird in Task 4 hinzugefügt (devices existiert dann neu)
  ek_preis    numeric(10,2) NOT NULL CHECK (ek_preis >= 0)
);

CREATE INDEX purchase_items_purchase_idx ON purchase_items(purchase_id);

-- Verkaufsbeleg-Kopf
CREATE TABLE sales (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  rechnungsnr text,
  datum       date NOT NULL,
  notes       text,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sales_customer_idx ON sales(customer_id);
CREATE INDEX sales_datum_idx    ON sales(datum);

-- Verkaufsbeleg-Positionen
CREATE TABLE sale_items (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id   uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  device_id uuid NOT NULL UNIQUE,  -- FK wird in Task 4 gesetzt
  vk_preis  numeric(10,2) NOT NULL CHECK (vk_preis >= 0)
);

CREATE INDEX sale_items_sale_idx ON sale_items(sale_id);

-- Kassen-spezifische Details (1:1 mit devices)
CREATE TABLE kassen_details (
  device_id       uuid PRIMARY KEY,  -- FK wird in Task 4 gesetzt
  fiskal_2020     boolean NOT NULL DEFAULT false,
  zvt             boolean NOT NULL DEFAULT false,
  hw_serial       text,
  sw_serial       text,
  tse_serial      text,
  tse_valid_until date
);
```

- [ ] **Step 2: Migration in Supabase ausführen**

Query zur Verifikation:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN
  ('purchases','purchase_items','sales','sale_items','kassen_details');
```
Erwartet: 5 Rows.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_warenwirtschaft_belege.sql
git commit -m "feat(db): add purchases, sales, kassen_details tables"
```

---

### Task 4: Migration 005 — devices umstrukturieren

**Files:**
- Create: `supabase/migrations/005_devices_restructure.sql`

- [ ] **Step 1: devices-Tabelle anpassen**

```sql
-- supabase/migrations/005_devices_restructure.sql

-- 1. Bestehende Tabelle device_movements löschen (wird durch purchases/sales ersetzt)
DROP TABLE IF EXISTS device_movements CASCADE;

-- 2. Alte Spalten von devices entfernen
ALTER TABLE devices
  DROP COLUMN IF EXISTS quantity,
  DROP COLUMN IF EXISTS condition,
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS category_id;

-- 3. enum device_status um 'verkauft' und 'reserviert' erweitern
ALTER TYPE device_status ADD VALUE IF NOT EXISTS 'verkauft';
ALTER TYPE device_status ADD VALUE IF NOT EXISTS 'reserviert';

-- 4. enum device_condition entfernen (wird nicht mehr verwendet)
DROP TYPE IF EXISTS device_condition;

-- 5. enum movement_action entfernen
DROP TYPE IF EXISTS movement_action;

-- 6. Neue Spalte model_id hinzufügen
ALTER TABLE devices
  ADD COLUMN model_id uuid REFERENCES models(id) ON DELETE RESTRICT;

-- Da devices leer ist (Task 1 hat das verifiziert), NOT NULL direkt setzen:
ALTER TABLE devices
  ALTER COLUMN model_id SET NOT NULL;

CREATE INDEX devices_model_idx ON devices(model_id);

-- 7. FKs in den Beleg-Tabellen nachziehen (in Task 3 wurden device_id ohne FK angelegt)
ALTER TABLE purchase_items
  ADD CONSTRAINT purchase_items_device_fk
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE RESTRICT;

ALTER TABLE sale_items
  ADD CONSTRAINT sale_items_device_fk
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE RESTRICT;

ALTER TABLE kassen_details
  ADD CONSTRAINT kassen_details_device_fk
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;
```

- [ ] **Step 2: Migration ausführen**

Query zur Verifikation:
```sql
-- devices hat model_id, kein quantity/condition/name/category_id mehr:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'devices' ORDER BY ordinal_position;
```
Erwartet: `id, serial_number, status, location, photo_url, notes, created_at, updated_at, model_id`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_devices_restructure.sql
git commit -m "feat(db): restructure devices for single-unit tracking"
```

---

### Task 5: Migration 006 — SQL-Views für Dashboard

**Files:**
- Create: `supabase/migrations/006_dashboard_views.sql`

- [ ] **Step 1: Views anlegen**

```sql
-- supabase/migrations/006_dashboard_views.sql

-- Gesamt-KPIs (eine Row)
CREATE OR REPLACE VIEW v_dashboard_kpis AS
SELECT
  (SELECT count(*) FROM devices WHERE status = 'lager') AS geraete_im_lager,
  COALESCE((
    SELECT sum(pi.ek_preis)
    FROM devices d
    JOIN purchase_items pi ON pi.device_id = d.id
    WHERE d.status = 'lager'
  ), 0) AS bestandswert_ek,
  COALESCE((
    SELECT sum(si.vk_preis)
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.datum >= date_trunc('month', current_date)
  ), 0) AS umsatz_mtd,
  COALESCE((
    SELECT sum(si.vk_preis - COALESCE(pi.ek_preis, 0))
    FROM sale_items si
    JOIN sales s          ON s.id = si.sale_id
    LEFT JOIN purchase_items pi ON pi.device_id = si.device_id
    WHERE s.datum >= date_trunc('month', current_date)
  ), 0) AS marge_mtd;

-- Bestand nach Kategorie (Bar-Chart)
CREATE OR REPLACE VIEW v_stock_by_category AS
SELECT
  c.id   AS category_id,
  c.name AS category_name,
  count(d.id) FILTER (WHERE d.status = 'lager') AS anzahl_im_lager,
  COALESCE(sum(pi.ek_preis) FILTER (WHERE d.status = 'lager'), 0) AS bestandswert_ek
FROM categories c
LEFT JOIN models m           ON m.category_id = c.id
LEFT JOIN devices d          ON d.model_id    = m.id
LEFT JOIN purchase_items pi  ON pi.device_id  = d.id
GROUP BY c.id, c.name
ORDER BY c.name;

-- Verkäufe letzte 30 Tage (Line-Chart)
CREATE OR REPLACE VIEW v_sales_last_30d AS
SELECT
  s.datum                    AS tag,
  sum(si.vk_preis)           AS umsatz,
  count(*)                   AS stueck
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
WHERE s.datum >= current_date - interval '30 days'
GROUP BY s.datum
ORDER BY s.datum;

-- Top-5 Modelle nach Umsatz YTD
CREATE OR REPLACE VIEW v_top_models_revenue AS
SELECT
  m.id AS model_id,
  mf.name || ' ' || m.modellname ||
    COALESCE(' ' || m.variante, '') ||
    COALESCE(' ' || m.version, '') AS model_label,
  count(si.id)        AS stueckzahl_verkauft,
  sum(si.vk_preis)    AS umsatz_ytd
FROM sale_items si
JOIN sales s         ON s.id = si.sale_id
JOIN devices d       ON d.id = si.device_id
JOIN models m        ON m.id = d.model_id
JOIN manufacturers mf ON mf.id = m.manufacturer_id
WHERE s.datum >= date_trunc('year', current_date)
GROUP BY m.id, mf.name, m.modellname, m.variante, m.version
ORDER BY umsatz_ytd DESC
LIMIT 5;

-- Letzte 5 Verkäufe
CREATE OR REPLACE VIEW v_recent_sales AS
SELECT
  s.id         AS sale_id,
  s.datum,
  c.name       AS kunde,
  mf.name || ' ' || m.modellname AS model_label,
  si.vk_preis
FROM sales s
JOIN sale_items si   ON si.sale_id = s.id
JOIN customers c     ON c.id = s.customer_id
JOIN devices d       ON d.id = si.device_id
JOIN models m        ON m.id = d.model_id
JOIN manufacturers mf ON mf.id = m.manufacturer_id
ORDER BY s.datum DESC, s.created_at DESC
LIMIT 5;

-- TSE-Ablauf-Warnungen (Kassen mit TSE-Frist < 90 Tagen)
CREATE OR REPLACE VIEW v_tse_expiring AS
SELECT
  d.id AS device_id,
  mf.name || ' ' || m.modellname AS model_label,
  kd.hw_serial,
  kd.tse_serial,
  kd.tse_valid_until,
  (kd.tse_valid_until - current_date) AS tage_verbleibend
FROM kassen_details kd
JOIN devices d       ON d.id = kd.device_id
JOIN models m        ON m.id = d.model_id
JOIN manufacturers mf ON mf.id = m.manufacturer_id
WHERE kd.tse_valid_until IS NOT NULL
  AND kd.tse_valid_until <= current_date + interval '90 days'
ORDER BY kd.tse_valid_until;
```

- [ ] **Step 2: Migration ausführen und Views verifizieren**

```sql
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'v_%';
```
Erwartet: 6 Views.

Smoke-Test:
```sql
SELECT * FROM v_dashboard_kpis;
```
Erwartet: 1 Row mit 4 Null/0-Werten (DB ist leer).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_dashboard_views.sql
git commit -m "feat(db): add dashboard views"
```

---

### Task 6: Migration 007 — RLS Policies für neue Tabellen

**Files:**
- Create: `supabase/migrations/007_rls_v2.sql`

- [ ] **Step 1: RLS Policies schreiben**

```sql
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

-- Helper: Rolle aus profiles ist bereits in 002_rls_policies.sql definiert (get_my_role()).

-- Muster: SELECT für alle authenticated, INSERT/UPDATE für mitarbeiter+admin, DELETE nur admin.
-- Stammdaten (manufacturers, models, suppliers, customers): INSERT/UPDATE = mitarbeiter+admin.
-- kassen_details: folgt devices (INSERT = mitarbeiter+admin, UPDATE/DELETE = admin).
-- Belege (purchases, sales, *_items): INSERT = mitarbeiter+admin, UPDATE/DELETE = admin.

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
-- Dafür überschreiben wir die UPDATE-Policy aus 002 gezielt:
DROP POLICY IF EXISTS devices_update ON devices;
CREATE POLICY devices_update ON devices FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin','mitarbeiter'));
```

- [ ] **Step 2: Migration ausführen**

Verifikation: Als Nicht-Admin-User `SELECT * FROM manufacturers` sollte funktionieren. `INSERT` als `viewer` sollte fehlschlagen. (Manueller Test im Supabase Dashboard mit zwei Test-Usern.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_rls_v2.sql
git commit -m "feat(db): add RLS policies for warenwirtschaft v2 tables"
```

---

## Phase 2: TypeScript Types & Data Access

### Task 7: lib/types.ts aktualisieren

**Files:**
- Modify: `lib/types.ts` (komplett ersetzen)

- [ ] **Step 1: Datei neu schreiben**

```ts
// lib/types.ts
export type UserRole = 'admin' | 'mitarbeiter' | 'viewer'
export type DeviceStatus = 'lager' | 'reserviert' | 'verkauft' | 'defekt' | 'ausgemustert'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  created_at: string
}

export interface Category {
  id: string
  name: string
  icon: string | null
  created_at: string
}

export interface CategoryWithCount extends Category {
  device_count: number
}

export interface Manufacturer {
  id: string
  name: string
  created_at: string
}

export interface Model {
  id: string
  manufacturer_id: string
  category_id: string
  modellname: string
  variante: string | null
  version: string | null
  created_at: string
  manufacturer?: Manufacturer
  category?: Category
}

export interface Supplier {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export interface KassenDetails {
  device_id: string
  fiskal_2020: boolean
  zvt: boolean
  hw_serial: string | null
  sw_serial: string | null
  tse_serial: string | null
  tse_valid_until: string | null
}

export interface Device {
  id: string
  model_id: string
  serial_number: string | null
  status: DeviceStatus
  location: string | null
  photo_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  model?: Model
  kassen_details?: KassenDetails | null
  purchase_item?: PurchaseItem | null
  sale_item?: SaleItem | null
}

export interface Purchase {
  id: string
  supplier_id: string
  rechnungsnr: string | null
  datum: string
  notes: string | null
  created_by: string | null
  created_at: string
  supplier?: Supplier
  items?: PurchaseItem[]
}

export interface PurchaseItem {
  id: string
  purchase_id: string
  device_id: string
  ek_preis: number
  purchase?: Purchase
  device?: Device
}

export interface Sale {
  id: string
  customer_id: string
  rechnungsnr: string | null
  datum: string
  notes: string | null
  created_by: string | null
  created_at: string
  customer?: Customer
  items?: SaleItem[]
}

export interface SaleItem {
  id: string
  sale_id: string
  device_id: string
  vk_preis: number
  sale?: Sale
  device?: Device
}

export interface OcrResult {
  name: string | null
  serial_number: string | null
  manufacturer: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /c/Users/ekara/warenwirtschaft && npx tsc --noEmit 2>&1 | head -60
```

Erwartet: Viele Typfehler in bestehenden Dateien (die nutzen noch `condition`, `quantity`, etc.). Diese Fehler werden in den Folge-Tasks behoben.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): replace inventory types with v2 schema"
```

---

### Task 8: lib/utils.ts — Labels für neue Status/keine condition mehr

**Files:**
- Modify: `lib/utils.ts`

- [ ] **Step 1: Datei lesen und aktualisieren**

Datei erstmal lesen:
```bash
cat /c/Users/ekara/warenwirtschaft/lib/utils.ts
```

Dann anpassen:
- `getConditionLabel` entfernen (condition existiert nicht mehr)
- `getStatusLabel` erweitern um `'verkauft' → 'Verkauft'` und `'reserviert' → 'Reserviert'`
- `formatDate` bleibt
- Neu: `formatCurrency(n: number) => '€ ' + n.toFixed(2).replace('.', ',')`

Konkreter Patch (Platzhalter — genauer Inhalt hängt vom aktuellen Code ab; sofern `getConditionLabel` vorhanden ist, entfernen und `getStatusLabel` anpassen):

```ts
// lib/utils.ts — vollständige relevante Funktionen
import type { DeviceStatus } from '@/lib/types'

export function getStatusLabel(s: DeviceStatus): string {
  const map: Record<DeviceStatus, string> = {
    lager: 'Im Lager',
    reserviert: 'Reserviert',
    verkauft: 'Verkauft',
    defekt: 'Defekt',
    ausgemustert: 'Ausgemustert',
  }
  return map[s]
}

export function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('de-DE')
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
}
```

Die bereits vorhandene `cn`-Funktion aus `clsx`/`tailwind-merge` NICHT entfernen.

- [ ] **Step 2: Test schreiben**

```ts
// __tests__/lib/utils.test.ts
import { getStatusLabel, formatCurrency } from '@/lib/utils'

describe('getStatusLabel', () => {
  it('returns German labels for all statuses', () => {
    expect(getStatusLabel('lager')).toBe('Im Lager')
    expect(getStatusLabel('verkauft')).toBe('Verkauft')
    expect(getStatusLabel('reserviert')).toBe('Reserviert')
    expect(getStatusLabel('defekt')).toBe('Defekt')
    expect(getStatusLabel('ausgemustert')).toBe('Ausgemustert')
  })
})

describe('formatCurrency', () => {
  it('formats numbers as German EUR', () => {
    expect(formatCurrency(1234.5)).toMatch(/1\.234,50/)
    expect(formatCurrency(0)).toMatch(/0,00/)
  })
})
```

- [ ] **Step 3: Tests laufen lassen**

```bash
cd /c/Users/ekara/warenwirtschaft && npx jest __tests__/lib/utils.test.ts
```

Erwartet: 2 passing suites, 5 passing tests.

- [ ] **Step 4: Commit**

```bash
git add lib/utils.ts __tests__/lib/utils.test.ts
git commit -m "refactor(utils): update labels for v2 status enum + add formatCurrency"
```

---

### Task 9: lib/category-columns.ts — Spalten-Schema je Kategorie

**Files:**
- Create: `lib/category-columns.ts`
- Create: `__tests__/lib/category-columns.test.ts`

- [ ] **Step 1: Failing test schreiben**

```ts
// __tests__/lib/category-columns.test.ts
import { getColumnsForCategory, COLUMN_KEY } from '@/lib/category-columns'

describe('getColumnsForCategory', () => {
  it('returns Kassen columns for Registrierkasse', () => {
    const cols = getColumnsForCategory('Registrierkasse')
    const keys = cols.map(c => c.key)
    expect(keys).toContain(COLUMN_KEY.HW_SERIAL)
    expect(keys).toContain(COLUMN_KEY.SW_SERIAL)
    expect(keys).toContain(COLUMN_KEY.TSE_VALID)
    expect(keys).toContain(COLUMN_KEY.FISKAL_2020)
    expect(keys).toContain(COLUMN_KEY.ZVT)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).toContain(COLUMN_KEY.VK)
  })

  it('returns generic columns for Drucker', () => {
    const cols = getColumnsForCategory('Drucker')
    const keys = cols.map(c => c.key)
    expect(keys).toContain(COLUMN_KEY.SERIAL)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).not.toContain(COLUMN_KEY.HW_SERIAL)
    expect(keys).not.toContain(COLUMN_KEY.FISKAL_2020)
  })

  it('returns simple columns for Kabel', () => {
    const cols = getColumnsForCategory('Kabel')
    const keys = cols.map(c => c.key)
    expect(keys).not.toContain(COLUMN_KEY.SERIAL)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).toContain(COLUMN_KEY.VK)
    expect(keys).toContain(COLUMN_KEY.LOCATION)
  })

  it('falls back to generic for unknown categories', () => {
    const cols = getColumnsForCategory('Unbekannt')
    expect(cols.map(c => c.key)).toContain(COLUMN_KEY.SERIAL)
  })
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

```bash
cd /c/Users/ekara/warenwirtschaft && npx jest __tests__/lib/category-columns.test.ts
```

Erwartet: FAIL — "Cannot find module '@/lib/category-columns'".

- [ ] **Step 3: Implementation**

```ts
// lib/category-columns.ts
export const COLUMN_KEY = {
  MODEL: 'model',
  MANUFACTURER: 'manufacturer',
  SERIAL: 'serial',
  HW_SERIAL: 'hw_serial',
  SW_SERIAL: 'sw_serial',
  TSE_SERIAL: 'tse_serial',
  TSE_VALID: 'tse_valid',
  FISKAL_2020: 'fiskal_2020',
  ZVT: 'zvt',
  EK: 'ek',
  VK: 'vk',
  STATUS: 'status',
  LOCATION: 'location',
  NAME: 'name',
} as const

export type ColumnKey = (typeof COLUMN_KEY)[keyof typeof COLUMN_KEY]

export interface ColumnDef {
  key: ColumnKey
  label: string
  align?: 'left' | 'right'
}

const KASSEN_COLUMNS: ColumnDef[] = [
  { key: COLUMN_KEY.MODEL,       label: 'Modell' },
  { key: COLUMN_KEY.MANUFACTURER,label: 'Hersteller' },
  { key: COLUMN_KEY.HW_SERIAL,   label: 'HW-SN' },
  { key: COLUMN_KEY.SW_SERIAL,   label: 'SW-SN' },
  { key: COLUMN_KEY.TSE_VALID,   label: 'TSE gültig bis' },
  { key: COLUMN_KEY.FISKAL_2020, label: 'Fiskal 2020' },
  { key: COLUMN_KEY.ZVT,         label: 'ZVT' },
  { key: COLUMN_KEY.EK,          label: 'EK', align: 'right' },
  { key: COLUMN_KEY.VK,          label: 'VK', align: 'right' },
  { key: COLUMN_KEY.STATUS,      label: 'Status' },
]

const GENERIC_DEVICE_COLUMNS: ColumnDef[] = [
  { key: COLUMN_KEY.MODEL,       label: 'Modell' },
  { key: COLUMN_KEY.MANUFACTURER,label: 'Hersteller' },
  { key: COLUMN_KEY.SERIAL,      label: 'Seriennummer' },
  { key: COLUMN_KEY.EK,          label: 'EK', align: 'right' },
  { key: COLUMN_KEY.VK,          label: 'VK', align: 'right' },
  { key: COLUMN_KEY.STATUS,      label: 'Status' },
]

const SIMPLE_COLUMNS: ColumnDef[] = [
  { key: COLUMN_KEY.NAME,        label: 'Name' },
  { key: COLUMN_KEY.EK,          label: 'EK', align: 'right' },
  { key: COLUMN_KEY.VK,          label: 'VK', align: 'right' },
  { key: COLUMN_KEY.LOCATION,    label: 'Standort' },
  { key: COLUMN_KEY.STATUS,      label: 'Status' },
]

export function getColumnsForCategory(categoryName: string): ColumnDef[] {
  const simple = new Set(['Kabel', 'Sonstiges'])
  if (categoryName === 'Registrierkasse') return KASSEN_COLUMNS
  if (simple.has(categoryName)) return SIMPLE_COLUMNS
  return GENERIC_DEVICE_COLUMNS
}
```

- [ ] **Step 4: Test erneut**

```bash
cd /c/Users/ekara/warenwirtschaft && npx jest __tests__/lib/category-columns.test.ts
```

Erwartet: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/category-columns.ts __tests__/lib/category-columns.test.ts
git commit -m "feat(inventory): category-specific column schema"
```

---

### Task 10: lib/inventory/derive-status.ts — abgeleiteter Status

**Files:**
- Create: `lib/inventory/derive-status.ts`
- Create: `__tests__/lib/derive-status.test.ts`

- [ ] **Step 1: Test schreiben**

```ts
// __tests__/lib/derive-status.test.ts
import { deriveDisplayStatus } from '@/lib/inventory/derive-status'
import type { Device } from '@/lib/types'

const base: Device = {
  id: 'd1', model_id: 'm1', serial_number: null, status: 'lager',
  location: null, photo_url: null, notes: null,
  created_at: '', updated_at: '',
}

describe('deriveDisplayStatus', () => {
  it('returns "verkauft" if sale_item exists, regardless of status', () => {
    const d: Device = { ...base, status: 'lager', sale_item: { id: 's', sale_id: 'x', device_id: 'd1', vk_preis: 100 } }
    expect(deriveDisplayStatus(d)).toBe('verkauft')
  })

  it('returns device.status when no sale_item', () => {
    expect(deriveDisplayStatus({ ...base, status: 'defekt' })).toBe('defekt')
    expect(deriveDisplayStatus({ ...base, status: 'lager' })).toBe('lager')
  })
})
```

- [ ] **Step 2: Test fail verifizieren**

```bash
npx jest __tests__/lib/derive-status.test.ts
```

Erwartet: FAIL — Modul nicht gefunden.

- [ ] **Step 3: Implementation**

```ts
// lib/inventory/derive-status.ts
import type { Device, DeviceStatus } from '@/lib/types'

export function deriveDisplayStatus(device: Device): DeviceStatus {
  if (device.sale_item) return 'verkauft'
  return device.status
}
```

- [ ] **Step 4: Tests passen**

```bash
npx jest __tests__/lib/derive-status.test.ts
```

Erwartet: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/inventory/derive-status.ts __tests__/lib/derive-status.test.ts
git commit -m "feat(inventory): derive display status from device+sale_item"
```

---

### Task 11: lib/inventory/queries.ts — Supabase-Query-Helper

**Files:**
- Create: `lib/inventory/queries.ts`

- [ ] **Step 1: Query-Helper schreiben**

```ts
// lib/inventory/queries.ts
import { SupabaseClient } from '@supabase/supabase-js'
import type { Device } from '@/lib/types'

const DEVICE_SELECT = `
  *,
  model:models(
    *,
    manufacturer:manufacturers(*),
    category:categories(*)
  ),
  kassen_details(*),
  purchase_item:purchase_items(*, purchase:purchases(*, supplier:suppliers(*))),
  sale_item:sale_items(*, sale:sales(*, customer:customers(*)))
`

export async function fetchDevices(
  supabase: SupabaseClient,
  filter?: { categoryId?: string; search?: string }
): Promise<Device[]> {
  let q = supabase.from('devices').select(DEVICE_SELECT).order('created_at', { ascending: false })

  if (filter?.categoryId) {
    // Kategorie-Filter geht über models: nur devices, deren model.category_id = categoryId
    const { data: models } = await supabase.from('models').select('id').eq('category_id', filter.categoryId)
    const modelIds = (models ?? []).map(m => m.id)
    if (modelIds.length === 0) return []
    q = q.in('model_id', modelIds)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as Device[]
}

export async function fetchDevice(supabase: SupabaseClient, id: string): Promise<Device | null> {
  const { data, error } = await supabase.from('devices').select(DEVICE_SELECT).eq('id', id).single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as unknown as Device
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/inventory/queries.ts
git commit -m "feat(inventory): supabase query helpers with full joins"
```

---

## Phase 3: Gerät anlegen mit Einkaufsbeleg

### Task 12: components/inventory/model-picker.tsx

**Files:**
- Create: `components/inventory/model-picker.tsx`

- [ ] **Step 1: Komponente schreiben**

```tsx
// components/inventory/model-picker.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { Manufacturer, Model } from '@/lib/types'

interface ModelPickerProps {
  categoryId: string
  value: string
  onChange: (modelId: string) => void
}

export function ModelPicker({ categoryId, value, onChange }: ModelPickerProps) {
  const supabase = createClient()
  const [models, setModels] = useState<Model[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [showNew, setShowNew] = useState(false)
  const [nm, setNm] = useState({ manufacturer_id: '', modellname: '', variante: '', version: '' })

  async function refresh() {
    const { data: m } = await supabase
      .from('models')
      .select('*, manufacturer:manufacturers(*)')
      .eq('category_id', categoryId)
      .order('modellname')
    setModels((m ?? []) as Model[])
    const { data: mf } = await supabase.from('manufacturers').select('*').order('name')
    setManufacturers(mf ?? [])
  }

  useEffect(() => {
    if (categoryId) refresh()
  }, [categoryId])

  async function createModel() {
    if (!nm.manufacturer_id || !nm.modellname) {
      toast.error('Hersteller und Modellname sind Pflicht')
      return
    }
    const { data, error } = await supabase.from('models').insert({
      manufacturer_id: nm.manufacturer_id,
      category_id: categoryId,
      modellname: nm.modellname,
      variante: nm.variante || null,
      version: nm.version || null,
    }).select('id').single()
    if (error) { toast.error('Modell konnte nicht angelegt werden', { description: error.message }); return }
    await refresh()
    onChange(data.id)
    setShowNew(false)
    setNm({ manufacturer_id: '', modellname: '', variante: '', version: '' })
  }

  return (
    <div className="space-y-2">
      <Label>Modell *</Label>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Modell wählen..." /></SelectTrigger>
          <SelectContent>
            {models.map(m => (
              <SelectItem key={m.id} value={m.id}>
                {m.manufacturer?.name} {m.modellname}
                {m.variante ? ` ${m.variante}` : ''}
                {m.version ? ` v${m.version}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={() => setShowNew(v => !v)}>
          {showNew ? 'Abbrechen' : '+ Neu'}
        </Button>
      </div>

      {showNew && (
        <div className="border rounded p-3 space-y-2 bg-slate-50">
          <div>
            <Label>Hersteller *</Label>
            <Select value={nm.manufacturer_id} onValueChange={v => setNm(p => ({ ...p, manufacturer_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Hersteller wählen..." /></SelectTrigger>
              <SelectContent>
                {manufacturers.map(mf => <SelectItem key={mf.id} value={mf.id}>{mf.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Modellname *</Label><Input value={nm.modellname} onChange={e => setNm(p => ({ ...p, modellname: e.target.value }))} /></div>
          <div><Label>Variante (Full/Light)</Label><Input value={nm.variante} onChange={e => setNm(p => ({ ...p, variante: e.target.value }))} /></div>
          <div><Label>Version</Label><Input value={nm.version} onChange={e => setNm(p => ({ ...p, version: e.target.value }))} /></div>
          <Button type="button" onClick={createModel}>Anlegen</Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/inventory/model-picker.tsx
git commit -m "feat(inventory): model-picker with inline 'neues Modell' flow"
```

---

### Task 13: components/inventory/entity-picker.tsx (Lieferant & Kunde generisch)

**Files:**
- Create: `components/inventory/entity-picker.tsx`

- [ ] **Step 1: Wiederverwendbare Picker-Komponente**

```tsx
// components/inventory/entity-picker.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

type EntityTable = 'suppliers' | 'customers'

interface Entity { id: string; name: string; email?: string | null; phone?: string | null; address?: string | null }

interface EntityPickerProps {
  table: EntityTable
  label: string
  value: string
  onChange: (id: string) => void
}

export function EntityPicker({ table, label, value, onChange }: EntityPickerProps) {
  const supabase = createClient()
  const [items, setItems] = useState<Entity[]>([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' })

  async function refresh() {
    const { data } = await supabase.from(table).select('id, name, email, phone, address').order('name')
    setItems((data ?? []) as Entity[])
  }

  useEffect(() => { refresh() }, [])

  async function create() {
    if (!form.name) { toast.error('Name ist Pflicht'); return }
    const { data, error } = await supabase.from(table).insert({
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
    }).select('id').single()
    if (error) { toast.error('Konnte nicht angelegt werden', { description: error.message }); return }
    await refresh()
    onChange(data.id)
    setShowNew(false)
    setForm({ name: '', email: '', phone: '', address: '' })
  }

  return (
    <div className="space-y-2">
      <Label>{label} *</Label>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder={`${label} wählen...`} /></SelectTrigger>
          <SelectContent>
            {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={() => setShowNew(v => !v)}>
          {showNew ? 'Abbrechen' : '+ Neu'}
        </Button>
      </div>

      {showNew && (
        <div className="border rounded p-3 space-y-2 bg-slate-50">
          <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div><Label>Telefon</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
          <div><Label>Adresse</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
          <Button type="button" onClick={create}>Anlegen</Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/inventory/entity-picker.tsx
git commit -m "feat(inventory): generic entity picker for suppliers/customers"
```

---

### Task 14: components/inventory/kassen-fields.tsx

**Files:**
- Create: `components/inventory/kassen-fields.tsx`

- [ ] **Step 1: Kassen-spezifische Formularsektion**

```tsx
// components/inventory/kassen-fields.tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface KassenFormState {
  fiskal_2020: boolean
  zvt: boolean
  hw_serial: string
  sw_serial: string
  tse_serial: string
  tse_valid_until: string   // ISO-Date-String ('' = leer)
}

export const INITIAL_KASSEN: KassenFormState = {
  fiskal_2020: false, zvt: false,
  hw_serial: '', sw_serial: '', tse_serial: '', tse_valid_until: '',
}

interface Props {
  value: KassenFormState
  onChange: (v: KassenFormState) => void
}

export function KassenFields({ value, onChange }: Props) {
  function set<K extends keyof KassenFormState>(k: K, v: KassenFormState[K]) {
    onChange({ ...value, [k]: v })
  }
  return (
    <fieldset className="border rounded p-4 space-y-3">
      <legend className="px-2 text-sm font-medium">Kassen-Details</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>HW-Seriennummer</Label><Input value={value.hw_serial} onChange={e => set('hw_serial', e.target.value)} className="font-mono" /></div>
        <div><Label>SW-Seriennummer</Label><Input value={value.sw_serial} onChange={e => set('sw_serial', e.target.value)} className="font-mono" /></div>
        <div><Label>TSE-Seriennummer</Label><Input value={value.tse_serial} onChange={e => set('tse_serial', e.target.value)} className="font-mono" /></div>
        <div><Label>TSE gültig bis</Label><Input type="date" value={value.tse_valid_until} onChange={e => set('tse_valid_until', e.target.value)} /></div>
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.fiskal_2020} onChange={e => set('fiskal_2020', e.target.checked)} /> Fiskal 2020</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.zvt} onChange={e => set('zvt', e.target.checked)} /> ZVT-Schnittstelle</label>
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/inventory/kassen-fields.tsx
git commit -m "feat(inventory): kassen-specific form fields"
```

---

### Task 15: device-form.tsx umschreiben (zentrale Änderung)

**Files:**
- Modify: `components/inventory/device-form.tsx` (komplett ersetzen)

- [ ] **Step 1: Alte Datei komplett ersetzen**

```tsx
// components/inventory/device-form.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ModelPicker } from '@/components/inventory/model-picker'
import { EntityPicker } from '@/components/inventory/entity-picker'
import { KassenFields, INITIAL_KASSEN, KassenFormState } from '@/components/inventory/kassen-fields'
import type { Category } from '@/lib/types'

interface DeviceFormProps {
  categories: Category[]
  prefill?: { serial_number?: string }
}

export function DeviceForm({ categories, prefill }: DeviceFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)

  const [category_id, setCategoryId] = useState('')
  const category = categories.find(c => c.id === category_id)
  const isKassen = category?.name === 'Registrierkasse'

  const [core, setCore] = useState({
    model_id: '',
    serial_number: prefill?.serial_number ?? '',
    location: '',
    notes: '',
  })
  const [kassen, setKassen] = useState<KassenFormState>(INITIAL_KASSEN)

  // Einkauf
  const [purchase, setPurchase] = useState({
    supplier_id: '',
    rechnungsnr: '',
    datum: new Date().toISOString().slice(0, 10),
    ek_preis: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category_id) { toast.error('Kategorie wählen'); return }
    if (!core.model_id) { toast.error('Modell wählen'); return }
    if (!purchase.supplier_id) { toast.error('Lieferant wählen'); return }
    if (!purchase.ek_preis) { toast.error('Einkaufspreis ist Pflicht'); return }

    setIsLoading(true)

    // 1. device insert
    const { data: device, error: devErr } = await supabase.from('devices').insert({
      model_id: core.model_id,
      serial_number: core.serial_number || null,
      status: 'lager',
      location: core.location || null,
      notes: core.notes || null,
    }).select('id').single()

    if (devErr) { toast.error('Gerät konnte nicht angelegt werden', { description: devErr.message }); setIsLoading(false); return }

    // 2. kassen_details insert (falls Kassen)
    if (isKassen) {
      const { error: kErr } = await supabase.from('kassen_details').insert({
        device_id: device.id,
        fiskal_2020: kassen.fiskal_2020,
        zvt: kassen.zvt,
        hw_serial: kassen.hw_serial || null,
        sw_serial: kassen.sw_serial || null,
        tse_serial: kassen.tse_serial || null,
        tse_valid_until: kassen.tse_valid_until || null,
      })
      if (kErr) { toast.error('Kassen-Details fehlgeschlagen', { description: kErr.message }); setIsLoading(false); return }
    }

    // 3. purchase: bestehenden Beleg suchen (gleicher Lieferant+Datum+Rechnungsnr) oder neu anlegen
    let purchase_id: string | null = null
    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('supplier_id', purchase.supplier_id)
      .eq('datum', purchase.datum)
      .eq('rechnungsnr', purchase.rechnungsnr || '')
      .maybeSingle()

    if (existing?.id) {
      purchase_id = existing.id
    } else {
      const { data: newP, error: pErr } = await supabase.from('purchases').insert({
        supplier_id: purchase.supplier_id,
        rechnungsnr: purchase.rechnungsnr || null,
        datum: purchase.datum,
      }).select('id').single()
      if (pErr) { toast.error('Einkaufsbeleg fehlgeschlagen', { description: pErr.message }); setIsLoading(false); return }
      purchase_id = newP.id
    }

    // 4. purchase_item
    const { error: piErr } = await supabase.from('purchase_items').insert({
      purchase_id,
      device_id: device.id,
      ek_preis: Number(purchase.ek_preis),
    })
    if (piErr) { toast.error('Beleg-Position fehlgeschlagen', { description: piErr.message }); setIsLoading(false); return }

    toast.success('Gerät hinzugefügt')
    router.push(`/inventory?category=${category_id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div className="space-y-2">
        <Label>Kategorie *</Label>
        <Select value={category_id} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="Kategorie wählen..." /></SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {category_id && (
        <>
          <ModelPicker categoryId={category_id} value={core.model_id} onChange={v => setCore(p => ({ ...p, model_id: v }))} />

          {!isKassen && (
            <div className="space-y-2">
              <Label>Seriennummer</Label>
              <Input value={core.serial_number} onChange={e => setCore(p => ({ ...p, serial_number: e.target.value }))} className="font-mono" />
            </div>
          )}

          {isKassen && <KassenFields value={kassen} onChange={setKassen} />}

          <div className="space-y-2">
            <Label>Standort</Label>
            <Input value={core.location} onChange={e => setCore(p => ({ ...p, location: e.target.value }))} placeholder="z.B. Lager Raum 2, Regal B3" />
          </div>

          <div className="space-y-2">
            <Label>Notizen</Label>
            <Textarea rows={3} value={core.notes} onChange={e => setCore(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <fieldset className="border rounded p-4 space-y-3">
            <legend className="px-2 text-sm font-medium">Einkauf</legend>
            <EntityPicker table="suppliers" label="Lieferant" value={purchase.supplier_id} onChange={v => setPurchase(p => ({ ...p, supplier_id: v }))} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>Rechnungsnr</Label><Input value={purchase.rechnungsnr} onChange={e => setPurchase(p => ({ ...p, rechnungsnr: e.target.value }))} /></div>
              <div><Label>Datum *</Label><Input type="date" value={purchase.datum} onChange={e => setPurchase(p => ({ ...p, datum: e.target.value }))} required /></div>
              <div><Label>Einkaufspreis (€) *</Label><Input type="number" step="0.01" min="0" value={purchase.ek_preis} onChange={e => setPurchase(p => ({ ...p, ek_preis: e.target.value }))} required /></div>
            </div>
          </fieldset>

          <div className="flex gap-3">
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Speichern...' : 'Hinzufügen'}</Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Abbrechen</Button>
          </div>
        </>
      )}
    </form>
  )
}
```

- [ ] **Step 2: page app/(protected)/inventory/new/page.tsx anpassen**

Die Datei lesen und alles an `DeviceForm` weitergeleitete Prop, das es nicht mehr gibt (`isAdmin`, `device`), entfernen. Anpassung:

```tsx
// app/(protected)/inventory/new/page.tsx (nur die relevanten Zeilen)
// Statt <DeviceForm categories={...} isAdmin={...} /> einfach:
<DeviceForm categories={categories} />
```

- [ ] **Step 3: Manueller Smoke-Test**

```bash
npm run dev
```

Im Browser: `/inventory/new` → Kategorie "Registrierkasse" wählen → Modell-Picker zeigt sich → "Neues Modell" → Hersteller "Vectron", Modellname "POS", Variante "Full" → Anlegen → Kassen-Felder + Einkauf-Sektion sichtbar → Lieferant "Test-Lieferant" anlegen → Preis 800 → Hinzufügen.

Erwartet: Redirect zu `/inventory?category=<uuid>`, Toast "Gerät hinzugefügt".

DB-Check:
```sql
SELECT d.id, m.modellname, pi.ek_preis FROM devices d
JOIN models m ON m.id = d.model_id
LEFT JOIN purchase_items pi ON pi.device_id = d.id;
```

- [ ] **Step 4: Commit**

```bash
git add components/inventory/device-form.tsx app/\(protected\)/inventory/new/page.tsx
git commit -m "feat(inventory): rewrite device-form for single-unit + purchase flow"
```

---

## Phase 4: Inventar-Liste mit kategorie-spezifischen Spalten

### Task 16: DeviceList umbauen auf dynamische Spalten

**Files:**
- Modify: `components/inventory/device-list.tsx`
- Modify: `components/inventory/device-card.tsx` (falls nötig — Quantity/Condition entfernen)

- [ ] **Step 1: device-card.tsx anpassen (read-only check + remove quantity/condition refs)**

Die Datei lesen:
```bash
cat components/inventory/device-card.tsx
```
Alle Referenzen auf `device.quantity`, `device.condition`, `device.name`, `device.category` durch `device.model?.modellname`, `device.model?.category?.name` ersetzen. Status-Anzeige durch `deriveDisplayStatus(device)` ersetzen.

- [ ] **Step 2: device-list.tsx komplett neu schreiben**

```tsx
// components/inventory/device-list.tsx
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DeviceCard } from '@/components/inventory/device-card'
import { getStatusLabel, formatDate, formatCurrency } from '@/lib/utils'
import { getColumnsForCategory, COLUMN_KEY, ColumnKey } from '@/lib/category-columns'
import { deriveDisplayStatus } from '@/lib/inventory/derive-status'
import type { Device, Category, DeviceStatus } from '@/lib/types'

const STATUS_COLORS: Record<DeviceStatus, string> = {
  lager:       'bg-green-100 text-green-800',
  reserviert:  'bg-yellow-100 text-yellow-800',
  verkauft:    'bg-blue-100 text-blue-800',
  defekt:      'bg-red-100 text-red-800',
  ausgemustert:'bg-slate-100 text-slate-800',
}

interface DeviceListProps {
  devices: Device[]
  categories: Category[]
  canAdd: boolean
  activeCategoryName?: string   // wenn gesetzt → kategorie-spezifisches Schema
  hideCategoryFilter?: boolean
  hideHeading?: boolean
  emptyMessage?: string
}

export function DeviceList({
  devices, categories, canAdd,
  activeCategoryName, hideCategoryFilter, hideHeading,
  emptyMessage = 'Keine Geräte gefunden.',
}: DeviceListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const columns = useMemo(() => getColumnsForCategory(activeCategoryName ?? 'Unbekannt'), [activeCategoryName])

  const filtered = devices.filter(d => {
    const s = search.toLowerCase()
    const name = (d.model?.modellname ?? '').toLowerCase()
    const ms = (d.serial_number ?? '').toLowerCase()
    const hw = (d.kassen_details?.hw_serial ?? '').toLowerCase()
    const matchesSearch = !s || name.includes(s) || ms.includes(s) || hw.includes(s)
    const display = deriveDisplayStatus(d)
    const matchesStatus = statusFilter === 'all' || display === statusFilter
    return matchesSearch && matchesStatus
  })

  function cellValue(d: Device, key: ColumnKey): React.ReactNode {
    switch (key) {
      case COLUMN_KEY.MODEL:        return <Link href={`/inventory/${d.id}`} className="font-medium hover:underline">{d.model?.modellname ?? '—'}</Link>
      case COLUMN_KEY.MANUFACTURER: return d.model?.manufacturer?.name ?? '—'
      case COLUMN_KEY.SERIAL:       return <span className="font-mono text-sm">{d.serial_number ?? '—'}</span>
      case COLUMN_KEY.HW_SERIAL:    return <span className="font-mono text-sm">{d.kassen_details?.hw_serial ?? '—'}</span>
      case COLUMN_KEY.SW_SERIAL:    return <span className="font-mono text-sm">{d.kassen_details?.sw_serial ?? '—'}</span>
      case COLUMN_KEY.TSE_SERIAL:   return <span className="font-mono text-sm">{d.kassen_details?.tse_serial ?? '—'}</span>
      case COLUMN_KEY.TSE_VALID:    return d.kassen_details?.tse_valid_until ? formatDate(d.kassen_details.tse_valid_until) : '—'
      case COLUMN_KEY.FISKAL_2020:  return d.kassen_details?.fiskal_2020 ? 'Ja' : 'Nein'
      case COLUMN_KEY.ZVT:          return d.kassen_details?.zvt ? 'Ja' : 'Nein'
      case COLUMN_KEY.EK:           return d.purchase_item ? formatCurrency(Number(d.purchase_item.ek_preis)) : '—'
      case COLUMN_KEY.VK:           return d.sale_item ? formatCurrency(Number(d.sale_item.vk_preis)) : '—'
      case COLUMN_KEY.STATUS:       { const st = deriveDisplayStatus(d); return <Badge className={STATUS_COLORS[st]}>{getStatusLabel(st)}</Badge> }
      case COLUMN_KEY.LOCATION:     return d.location ?? '—'
      case COLUMN_KEY.NAME:         return <Link href={`/inventory/${d.id}`} className="font-medium hover:underline">{d.model?.modellname ?? '—'}</Link>
      default: return '—'
    }
  }

  return (
    <div className="space-y-4">
      {!hideHeading && (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{activeCategoryName ?? 'Inventar'}</h1>
          {canAdd && <Link href="/inventory/new"><Button>Gerät hinzufügen</Button></Link>}
        </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:gap-3">
        <Input placeholder="Suchen (Name, Seriennr, HW-SN)..." value={search} onChange={e => setSearch(e.target.value)} className="w-full md:max-w-sm" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="lager">Im Lager</SelectItem>
            <SelectItem value="reserviert">Reserviert</SelectItem>
            <SelectItem value="verkauft">Verkauft</SelectItem>
            <SelectItem value="defekt">Defekt</SelectItem>
            <SelectItem value="ausgemustert">Ausgemustert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {filtered.length === 0 && <p className="text-slate-500 text-sm py-8 text-center">{emptyMessage}</p>}
        {filtered.map(device => <DeviceCard key={device.id} device={device} />)}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead key={col.key} className={col.align === 'right' ? 'text-right' : ''}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-slate-500 py-8">{emptyMessage}</TableCell>
              </TableRow>
            )}
            {filtered.map(device => (
              <TableRow key={device.id} className="cursor-pointer hover:bg-slate-50">
                {columns.map(col => (
                  <TableCell key={col.key} className={col.align === 'right' ? 'text-right' : ''}>
                    {cellValue(device, col.key)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: app/(protected)/inventory/page.tsx anpassen**

Die Kategorie-Filterung läuft jetzt über `models`. Die Server-Component muss:
1. Kategorie-ID aus searchParams lesen
2. Geräte über `fetchDevices(supabase, { categoryId })` laden
3. `activeCategoryName` an DeviceList übergeben

```tsx
// app/(protected)/inventory/page.tsx — relevante Teile
import { fetchDevices } from '@/lib/inventory/queries'

// (in der Server Component:)
const categoryId = searchParams.category
const devices = categoryId && categoryId !== 'all'
  ? await fetchDevices(supabase, { categoryId })
  : await fetchDevices(supabase)

const activeCategory = categories.find(c => c.id === categoryId)

return <DeviceList
  devices={devices}
  categories={categories}
  canAdd={canAdd}
  activeCategoryName={activeCategory?.name}
  hideCategoryFilter
/>
```

Details: die Datei erst lesen und gezielt patchen.

- [ ] **Step 4: app/(protected)/inventory/[id]/page.tsx anpassen**

`fetchDevice(supabase, id)` statt bestehender direkter Query. Felder anpassen (Modell/Hersteller statt Name/Category, EK/VK statt Quantity).

- [ ] **Step 5: Manueller Test**

```bash
npm run dev
```

`/inventory` → Kategorie "Registrierkasse" → Tabelle zeigt HW-SN, SW-SN, TSE, Fiskal 2020, ZVT, EK, VK, Status. Das in Task 15 angelegte Gerät sollte erscheinen.

- [ ] **Step 6: Commit**

```bash
git add components/inventory/device-list.tsx components/inventory/device-card.tsx \
        app/\(protected\)/inventory/page.tsx app/\(protected\)/inventory/\[id\]/page.tsx
git commit -m "feat(inventory): category-specific columns + joined device queries"
```

---

## Phase 5: Verkauf-Flow

### Task 17: components/inventory/sell-dialog.tsx

**Files:**
- Create: `components/inventory/sell-dialog.tsx`

- [ ] **Step 1: Sell-Dialog-Komponente**

```tsx
// components/inventory/sell-dialog.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { EntityPicker } from '@/components/inventory/entity-picker'

interface SellDialogProps { deviceId: string }

export function SellDialog({ deviceId }: SellDialogProps) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    customer_id: '',
    rechnungsnr: '',
    datum: new Date().toISOString().slice(0, 10),
    vk_preis: '',
  })

  async function sell() {
    if (!form.customer_id || !form.vk_preis) { toast.error('Kunde und Preis pflichtfeld'); return }
    setLoading(true)

    // bestehenden sales-Beleg suchen
    const { data: existing } = await supabase
      .from('sales')
      .select('id')
      .eq('customer_id', form.customer_id)
      .eq('datum', form.datum)
      .eq('rechnungsnr', form.rechnungsnr || '')
      .maybeSingle()

    let sale_id = existing?.id
    if (!sale_id) {
      const { data: newS, error } = await supabase.from('sales').insert({
        customer_id: form.customer_id,
        rechnungsnr: form.rechnungsnr || null,
        datum: form.datum,
      }).select('id').single()
      if (error) { toast.error('Verkaufsbeleg fehlgeschlagen', { description: error.message }); setLoading(false); return }
      sale_id = newS.id
    }

    const { error: siErr } = await supabase.from('sale_items').insert({
      sale_id, device_id: deviceId, vk_preis: Number(form.vk_preis),
    })
    if (siErr) { toast.error('Position fehlgeschlagen', { description: siErr.message }); setLoading(false); return }

    const { error: dErr } = await supabase.from('devices').update({ status: 'verkauft' }).eq('id', deviceId)
    if (dErr) { toast.error('Status-Update fehlgeschlagen', { description: dErr.message }); setLoading(false); return }

    toast.success('Gerät verkauft')
    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Verkaufen</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Gerät verkaufen</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <EntityPicker table="customers" label="Kunde" value={form.customer_id} onChange={v => setForm(p => ({ ...p, customer_id: v }))} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label>Rechnungsnr</Label><Input value={form.rechnungsnr} onChange={e => setForm(p => ({ ...p, rechnungsnr: e.target.value }))} /></div>
            <div><Label>Datum</Label><Input type="date" value={form.datum} onChange={e => setForm(p => ({ ...p, datum: e.target.value }))} /></div>
            <div><Label>VK (€) *</Label><Input type="number" step="0.01" min="0" value={form.vk_preis} onChange={e => setForm(p => ({ ...p, vk_preis: e.target.value }))} /></div>
          </div>
          <Button onClick={sell} disabled={loading}>{loading ? 'Speichern...' : 'Verkauf abschließen'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: In Detail-Seite einbinden**

`app/(protected)/inventory/[id]/page.tsx` ergänzen: Wenn `device.sale_item == null && device.status === 'lager'`, `<SellDialog deviceId={device.id} />` anzeigen.

- [ ] **Step 3: Manueller Test**

Gerät aus Task 15 auswählen → "Verkaufen" → Kunde "Test-Kunde" anlegen → VK 1200 → abschließen. Erwartet: Liste zeigt Gerät als "Verkauft", VK-Spalte mit 1.200 €.

- [ ] **Step 4: Commit**

```bash
git add components/inventory/sell-dialog.tsx app/\(protected\)/inventory/\[id\]/page.tsx
git commit -m "feat(inventory): sell-dialog with customer+invoice flow"
```

---

## Phase 6: Dashboard v2

### Task 18: components/dashboard/kpi-cards.tsx

**Files:**
- Create: `components/dashboard/kpi-cards.tsx`

- [ ] **Step 1: Komponente**

```tsx
// components/dashboard/kpi-cards.tsx
import { formatCurrency } from '@/lib/utils'

interface KpiRow {
  geraete_im_lager: number
  bestandswert_ek: number
  umsatz_mtd: number
  marge_mtd: number
}

export function KpiCards({ data }: { data: KpiRow }) {
  const cards = [
    { label: 'Geräte im Lager', value: String(data.geraete_im_lager) },
    { label: 'Bestandswert (EK)', value: formatCurrency(Number(data.bestandswert_ek)) },
    { label: 'Umsatz MTD',       value: formatCurrency(Number(data.umsatz_mtd)) },
    { label: 'Marge MTD',        value: formatCurrency(Number(data.marge_mtd)) },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="rounded-lg border bg-white p-4">
          <div className="text-sm text-slate-500">{c.label}</div>
          <div className="text-2xl font-semibold mt-1">{c.value}</div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/kpi-cards.tsx
git commit -m "feat(dashboard): KPI cards component"
```

---

### Task 19: components/dashboard/stock-by-category.tsx

**Files:**
- Create: `components/dashboard/stock-by-category.tsx`

- [ ] **Step 1: Einfache Bar-Darstellung ohne Chart-Library (CSS-only)**

```tsx
// components/dashboard/stock-by-category.tsx
import { formatCurrency } from '@/lib/utils'

interface Row { category_name: string; anzahl_im_lager: number; bestandswert_ek: number }

export function StockByCategory({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map(r => r.anzahl_im_lager))
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="font-medium mb-3">Bestand nach Kategorie</h3>
      <ul className="space-y-2">
        {rows.map(r => (
          <li key={r.category_name} className="grid grid-cols-[1fr_4fr_auto] gap-3 items-center text-sm">
            <span>{r.category_name}</span>
            <div className="h-4 bg-slate-100 rounded overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${(r.anzahl_im_lager / max) * 100}%` }} />
            </div>
            <span className="text-right tabular-nums">{r.anzahl_im_lager} · {formatCurrency(Number(r.bestandswert_ek))}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/stock-by-category.tsx
git commit -m "feat(dashboard): stock-by-category bar list"
```

---

### Task 20: Weitere Dashboard-Widgets

**Files:**
- Create: `components/dashboard/recent-sales.tsx`
- Create: `components/dashboard/top-models.tsx`
- Create: `components/dashboard/tse-warnings.tsx`

- [ ] **Step 1: recent-sales**

```tsx
// components/dashboard/recent-sales.tsx
import { formatCurrency, formatDate } from '@/lib/utils'

interface Row { sale_id: string; datum: string; kunde: string; model_label: string; vk_preis: number }

export function RecentSales({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="font-medium mb-3">Letzte Verkäufe</h3>
      {rows.length === 0 ? <p className="text-slate-500 text-sm">Noch keine Verkäufe.</p> : (
        <ul className="divide-y text-sm">
          {rows.map(r => (
            <li key={r.sale_id} className="py-2 grid grid-cols-[auto_1fr_1fr_auto] gap-3">
              <span className="text-slate-500">{formatDate(r.datum)}</span>
              <span>{r.model_label}</span>
              <span className="text-slate-600">{r.kunde}</span>
              <span className="tabular-nums text-right">{formatCurrency(Number(r.vk_preis))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: top-models**

```tsx
// components/dashboard/top-models.tsx
import { formatCurrency } from '@/lib/utils'

interface Row { model_id: string; model_label: string; stueckzahl_verkauft: number; umsatz_ytd: number }

export function TopModels({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="font-medium mb-3">Top-Modelle (Umsatz YTD)</h3>
      {rows.length === 0 ? <p className="text-slate-500 text-sm">Keine Verkäufe dieses Jahr.</p> : (
        <ul className="divide-y text-sm">
          {rows.map(r => (
            <li key={r.model_id} className="py-2 grid grid-cols-[1fr_auto_auto] gap-3">
              <span>{r.model_label}</span>
              <span className="text-slate-500">{r.stueckzahl_verkauft}×</span>
              <span className="tabular-nums text-right">{formatCurrency(Number(r.umsatz_ytd))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: tse-warnings**

```tsx
// components/dashboard/tse-warnings.tsx
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface Row { device_id: string; model_label: string; hw_serial: string | null; tse_valid_until: string; tage_verbleibend: number }

export function TseWarnings({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 className="font-medium mb-3 text-amber-900">⚠ TSE-Ablauf in &lt; 90 Tagen ({rows.length})</h3>
      <ul className="divide-y divide-amber-200 text-sm">
        {rows.map(r => (
          <li key={r.device_id} className="py-2 grid grid-cols-[1fr_auto_auto] gap-3">
            <Link href={`/inventory/${r.device_id}`} className="hover:underline">
              {r.model_label} {r.hw_serial && <span className="font-mono text-xs text-slate-500">({r.hw_serial})</span>}
            </Link>
            <span>{formatDate(r.tse_valid_until)}</span>
            <span className="tabular-nums">{r.tage_verbleibend} Tage</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/recent-sales.tsx components/dashboard/top-models.tsx components/dashboard/tse-warnings.tsx
git commit -m "feat(dashboard): recent-sales, top-models, tse-warnings widgets"
```

---

### Task 21: app/(protected)/dashboard/page.tsx umschreiben

**Files:**
- Modify: `app/(protected)/dashboard/page.tsx`

- [ ] **Step 1: Server Component lädt die Views**

```tsx
// app/(protected)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { StockByCategory } from '@/components/dashboard/stock-by-category'
import { RecentSales } from '@/components/dashboard/recent-sales'
import { TopModels } from '@/components/dashboard/top-models'
import { TseWarnings } from '@/components/dashboard/tse-warnings'

export default async function DashboardPage() {
  const supabase = createClient()

  const [kpi, stock, recent, top, tse] = await Promise.all([
    supabase.from('v_dashboard_kpis').select('*').single(),
    supabase.from('v_stock_by_category').select('*'),
    supabase.from('v_recent_sales').select('*'),
    supabase.from('v_top_models_revenue').select('*'),
    supabase.from('v_tse_expiring').select('*'),
  ])

  const kpiData = kpi.data ?? { geraete_im_lager: 0, bestandswert_ek: 0, umsatz_mtd: 0, marge_mtd: 0 }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <KpiCards data={kpiData} />
      <TseWarnings rows={tse.data ?? []} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StockByCategory rows={stock.data ?? []} />
        <TopModels rows={top.data ?? []} />
      </div>
      <RecentSales rows={recent.data ?? []} />
    </div>
  )
}
```

Wenn die alte `stats-cards.tsx` nicht mehr verwendet wird, kann sie gelöscht werden:

```bash
git rm components/dashboard/stats-cards.tsx
```

(Vorher prüfen, ob sie anderswo importiert wird: `grep -r stats-cards app components lib`)

- [ ] **Step 2: Manueller Test**

`npm run dev` → `/dashboard`. Erwartet: KPI-Kacheln mit Werten (1 Gerät im Lager falls nur Task-15-Gerät existiert und Task 17 nicht ausgeführt; oder 0 wenn verkauft), Bestand-nach-Kategorie zeigt Registrierkasse 0 oder 1, letzte Verkäufe zeigt 1 Eintrag (falls Task 17 ausgeführt).

- [ ] **Step 3: Commit**

```bash
git add app/\(protected\)/dashboard/page.tsx
# falls stats-cards gelöscht:
git add components/dashboard/stats-cards.tsx
git commit -m "feat(dashboard): rebuild with v2 KPI/widgets"
```

---

## Phase 7: Admin-Seiten

### Task 22: /admin/manufacturers

**Files:**
- Create: `app/(protected)/admin/manufacturers/page.tsx`
- Create: `components/admin/crud-table.tsx` (generisch, wiederverwendet)

- [ ] **Step 1: Generische CrudTable schreiben**

```tsx
// components/admin/crud-table.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

interface FieldDef { key: string; label: string; type?: 'text' | 'email' }

interface Props {
  tableName: string
  title: string
  fields: FieldDef[]   // erste Feld wird als "Name" in Zeile genutzt
}

export function CrudTable({ tableName, title, fields }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<Record<string, string | null>[]>([])
  const [form, setForm] = useState<Record<string, string>>(() =>
    fields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})
  )

  async function refresh() {
    const { data } = await supabase.from(tableName).select('*').order(fields[0].key)
    setRows(data ?? [])
  }
  useEffect(() => { refresh() }, [])

  async function add() {
    if (!form[fields[0].key]) { toast.error(`${fields[0].label} ist Pflicht`); return }
    const payload = fields.reduce((acc, f) => ({ ...acc, [f.key]: form[f.key] || null }), {} as Record<string, string | null>)
    const { error } = await supabase.from(tableName).insert(payload)
    if (error) { toast.error('Fehler', { description: error.message }); return }
    setForm(fields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {}))
    await refresh()
    toast.success(`${title.slice(0, -1)} angelegt`)
  }

  async function remove(id: string) {
    if (!confirm('Wirklich löschen?')) return
    const { error } = await supabase.from(tableName).delete().eq('id', id)
    if (error) { toast.error('Löschen fehlgeschlagen', { description: error.message }); return }
    await refresh()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>

      <div className="border rounded p-4 grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50">
        {fields.map(f => (
          <div key={f.key} className="space-y-1">
            <Label>{f.label}</Label>
            <Input type={f.type ?? 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
          </div>
        ))}
        <div className="flex items-end"><Button onClick={add}>Anlegen</Button></div>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              {fields.map(f => <TableHead key={f.key}>{f.label}</TableHead>)}
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                {fields.map(f => <TableCell key={f.key}>{r[f.key] ?? '—'}</TableCell>)}
                <TableCell><Button variant="outline" size="sm" onClick={() => remove(r.id as string)}>Löschen</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: /admin/manufacturers Seite**

```tsx
// app/(protected)/admin/manufacturers/page.tsx
import { CrudTable } from '@/components/admin/crud-table'

export default function Page() {
  return <CrudTable tableName="manufacturers" title="Hersteller" fields={[
    { key: 'name', label: 'Name' },
  ]} />
}
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/crud-table.tsx app/\(protected\)/admin/manufacturers/page.tsx
git commit -m "feat(admin): manufacturers CRUD via generic crud-table"
```

---

### Task 23: /admin/suppliers + /admin/customers

**Files:**
- Create: `app/(protected)/admin/suppliers/page.tsx`
- Create: `app/(protected)/admin/customers/page.tsx`

- [ ] **Step 1: Beide Seiten**

```tsx
// app/(protected)/admin/suppliers/page.tsx
import { CrudTable } from '@/components/admin/crud-table'

export default function Page() {
  return <CrudTable tableName="suppliers" title="Lieferanten" fields={[
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'E-Mail', type: 'email' },
    { key: 'phone', label: 'Telefon' },
    { key: 'address', label: 'Adresse' },
  ]} />
}
```

```tsx
// app/(protected)/admin/customers/page.tsx
import { CrudTable } from '@/components/admin/crud-table'

export default function Page() {
  return <CrudTable tableName="customers" title="Kunden" fields={[
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'E-Mail', type: 'email' },
    { key: 'phone', label: 'Telefon' },
    { key: 'address', label: 'Adresse' },
  ]} />
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(protected\)/admin/suppliers/page.tsx app/\(protected\)/admin/customers/page.tsx
git commit -m "feat(admin): suppliers and customers CRUD"
```

---

### Task 24: /admin/models

**Files:**
- Create: `app/(protected)/admin/models/page.tsx`
- Create: `components/admin/models-table.tsx` (braucht category+manufacturer Selects statt plain Text)

- [ ] **Step 1: Models-Tabelle (nicht generisch wegen FK-Dropdowns)**

```tsx
// components/admin/models-table.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import type { Manufacturer, Category, Model } from '@/lib/types'

export function ModelsTable() {
  const supabase = createClient()
  const [models, setModels] = useState<Model[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({ manufacturer_id: '', category_id: '', modellname: '', variante: '', version: '' })

  async function refresh() {
    const { data: m } = await supabase.from('models').select('*, manufacturer:manufacturers(*), category:categories(*)').order('modellname')
    setModels((m ?? []) as Model[])
    const { data: mf } = await supabase.from('manufacturers').select('*').order('name'); setManufacturers(mf ?? [])
    const { data: c } = await supabase.from('categories').select('*').order('name');    setCategories(c ?? [])
  }
  useEffect(() => { refresh() }, [])

  async function add() {
    if (!form.manufacturer_id || !form.category_id || !form.modellname) { toast.error('Pflichtfelder fehlen'); return }
    const { error } = await supabase.from('models').insert({
      manufacturer_id: form.manufacturer_id,
      category_id: form.category_id,
      modellname: form.modellname,
      variante: form.variante || null,
      version: form.version || null,
    })
    if (error) { toast.error('Fehler', { description: error.message }); return }
    setForm({ manufacturer_id: '', category_id: '', modellname: '', variante: '', version: '' })
    await refresh()
  }

  async function remove(id: string) {
    if (!confirm('Wirklich löschen?')) return
    const { error } = await supabase.from('models').delete().eq('id', id)
    if (error) { toast.error('Löschen fehlgeschlagen', { description: error.message }); return }
    await refresh()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Modelle</h1>

      <div className="border rounded p-4 grid grid-cols-1 md:grid-cols-6 gap-3 bg-slate-50">
        <div><Label>Hersteller *</Label>
          <Select value={form.manufacturer_id} onValueChange={v => setForm(p => ({ ...p, manufacturer_id: v }))}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Kategorie *</Label>
          <Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v }))}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Modellname *</Label><Input value={form.modellname} onChange={e => setForm(p => ({ ...p, modellname: e.target.value }))} /></div>
        <div><Label>Variante</Label><Input value={form.variante} onChange={e => setForm(p => ({ ...p, variante: e.target.value }))} /></div>
        <div><Label>Version</Label><Input value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} /></div>
        <div className="flex items-end"><Button onClick={add}>Anlegen</Button></div>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Hersteller</TableHead><TableHead>Kategorie</TableHead>
            <TableHead>Modell</TableHead><TableHead>Variante</TableHead><TableHead>Version</TableHead>
            <TableHead className="w-20" />
          </TableRow></TableHeader>
          <TableBody>
            {models.map(m => (
              <TableRow key={m.id}>
                <TableCell>{m.manufacturer?.name ?? '—'}</TableCell>
                <TableCell>{m.category?.name ?? '—'}</TableCell>
                <TableCell>{m.modellname}</TableCell>
                <TableCell>{m.variante ?? '—'}</TableCell>
                <TableCell>{m.version ?? '—'}</TableCell>
                <TableCell><Button variant="outline" size="sm" onClick={() => remove(m.id)}>Löschen</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Seite**

```tsx
// app/(protected)/admin/models/page.tsx
import { ModelsTable } from '@/components/admin/models-table'
export default function Page() { return <ModelsTable /> }
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/models-table.tsx app/\(protected\)/admin/models/page.tsx
git commit -m "feat(admin): models CRUD"
```

---

### Task 25: /admin/purchases und /admin/sales (Read-only)

**Files:**
- Create: `app/(protected)/admin/purchases/page.tsx`
- Create: `app/(protected)/admin/sales/page.tsx`

- [ ] **Step 1: Einkaufsbelege-Übersicht**

```tsx
// app/(protected)/admin/purchases/page.tsx
import { createClient } from '@/lib/supabase/server'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'

export default async function Page() {
  const supabase = createClient()
  const { data } = await supabase.from('purchases')
    .select('id, rechnungsnr, datum, supplier:suppliers(name), items:purchase_items(ek_preis)')
    .order('datum', { ascending: false })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Einkaufsbelege</h1>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Datum</TableHead><TableHead>Rechnungsnr</TableHead>
            <TableHead>Lieferant</TableHead><TableHead>Positionen</TableHead>
            <TableHead className="text-right">Summe</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((p: any) => {
              const total = (p.items ?? []).reduce((s: number, i: any) => s + Number(i.ek_preis), 0)
              return (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.datum)}</TableCell>
                  <TableCell>{p.rechnungsnr ?? '—'}</TableCell>
                  <TableCell>{p.supplier?.name ?? '—'}</TableCell>
                  <TableCell>{(p.items ?? []).length}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(total)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verkaufsbelege-Übersicht analog**

```tsx
// app/(protected)/admin/sales/page.tsx
import { createClient } from '@/lib/supabase/server'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'

export default async function Page() {
  const supabase = createClient()
  const { data } = await supabase.from('sales')
    .select('id, rechnungsnr, datum, customer:customers(name), items:sale_items(vk_preis)')
    .order('datum', { ascending: false })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Verkaufsbelege</h1>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Datum</TableHead><TableHead>Rechnungsnr</TableHead>
            <TableHead>Kunde</TableHead><TableHead>Positionen</TableHead>
            <TableHead className="text-right">Summe</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((s: any) => {
              const total = (s.items ?? []).reduce((sum: number, i: any) => sum + Number(i.vk_preis), 0)
              return (
                <TableRow key={s.id}>
                  <TableCell>{formatDate(s.datum)}</TableCell>
                  <TableCell>{s.rechnungsnr ?? '—'}</TableCell>
                  <TableCell>{s.customer?.name ?? '—'}</TableCell>
                  <TableCell>{(s.items ?? []).length}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(total)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(protected\)/admin/purchases/page.tsx app/\(protected\)/admin/sales/page.tsx
git commit -m "feat(admin): purchases and sales read-only listings"
```

---

### Task 26: Sidebar-Navigation erweitern

**Files:**
- Modify: layout-Component mit Navigation (vermutlich `components/layout/*` oder `app/(protected)/layout.tsx`)

- [ ] **Step 1: Aktuelle Navigation suchen**

```bash
grep -r "admin/users\|admin/categories" app components lib
```

- [ ] **Step 2: Links hinzufügen**

In der identifizierten Navigation-Komponente die bestehenden Admin-Links um folgende erweitern (nur für `role === 'admin'`):

```tsx
<Link href="/admin/manufacturers">Hersteller</Link>
<Link href="/admin/models">Modelle</Link>
<Link href="/admin/suppliers">Lieferanten</Link>
<Link href="/admin/customers">Kunden</Link>
<Link href="/admin/purchases">Einkäufe</Link>
<Link href="/admin/sales">Verkäufe</Link>
```

- [ ] **Step 3: Commit**

```bash
git add <betroffene Dateien>
git commit -m "feat(admin): navigation links for new admin pages"
```

---

## Phase 8: Cleanup

### Task 27: /movements Seite entfernen (device_movements wurde gedropt)

**Files:**
- Delete: `app/(protected)/movements/page.tsx`
- Modify: Navigation (falls Link auf /movements existiert)

- [ ] **Step 1: Datei löschen**

```bash
rm app/\(protected\)/movements/page.tsx
# auf Windows: Remove-Item oder einfach git rm
git rm app/\(protected\)/movements/page.tsx
```

- [ ] **Step 2: Navigation-Link entfernen**

```bash
grep -r "/movements" app components lib --include="*.tsx" --include="*.ts"
```

Alle Treffer auflösen: Link entfernen.

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "chore: remove movements page (replaced by purchase/sale history)"
```

---

### Task 28: Chat-API prüfen (verwendet evtl. alte devices-Felder)

**Files:**
- Modify: `app/api/chat/route.ts` (falls dort Supabase-Queries mit alten Feldern)

- [ ] **Step 1: Chat-API-Code lesen und prüfen**

```bash
cat app/api/chat/route.ts
```

Wenn `quantity`, `condition`, `name` auf `devices` abgefragt werden: anpassen auf `model.modellname`, Status-Check auf `'verkauft'`-Zustand.

- [ ] **Step 2: Manueller Test**

`/chat` öffnen → "Wie viele Geräte im Lager?" fragen. Erwartet: Antwort mit sinnvollem Wert.

- [ ] **Step 3: Commit (falls Änderungen)**

```bash
git add app/api/chat/route.ts
git commit -m "fix(chat): adapt queries to v2 devices schema"
```

---

### Task 29: End-to-End Manueller Durchlauf

**Files:**
- Keine

- [ ] **Step 1: Full-Flow-Test**

```bash
npm run dev
```

Schritte:
1. Login als Admin
2. `/admin/manufacturers` → "Vectron" anlegen
3. `/admin/suppliers` → "Test-Lieferant" anlegen
4. `/admin/customers` → "Test-Kunde" anlegen
5. `/inventory/new` → Kategorie "Registrierkasse" → "Neues Modell" → Vectron/POS/Full/6.5 → anlegen → Modell wählen → Kassen-Felder (Fiskal ✓, ZVT ✓, HW-SN "HW-001", SW-SN "SW-001", TSE-SN "TSE-001", TSE-Datum in 60 Tagen) → Einkauf: Test-Lieferant, RE-001, heute, 800 → Hinzufügen
6. `/inventory?category=<registrierkasse>` → Gerät erscheint mit allen Kassen-Spalten, EK 800 €, Status "Im Lager"
7. `/inventory/<id>` → "Verkaufen" → Test-Kunde, RE-V-001, heute, 1200 → abschließen
8. `/inventory?category=<registrierkasse>` → Gerät zeigt VK 1.200 €, Status "Verkauft"
9. `/dashboard` → KPIs: 0 Geräte im Lager, 0 € Bestandswert, 1.200 € Umsatz MTD, 400 € Marge MTD. TSE-Warnung zeigt das Gerät (60 Tage)
10. `/admin/purchases` + `/admin/sales` → je 1 Eintrag
11. 2. Gerät anlegen (nicht verkaufen) → Dashboard KPIs passen neu

- [ ] **Step 2: TypeScript-Build + Lint**

```bash
cd /c/Users/ekara/warenwirtschaft
npx tsc --noEmit
npm run lint
```

Erwartet: Keine Fehler.

- [ ] **Step 3: Tests laufen lassen**

```bash
npx jest
```

Erwartet: Alle Tests grün.

- [ ] **Step 4: Finalen Commit machen, falls Änderungen aus Tests**

```bash
git status
# falls Änderungen: commit
```

---

## Out of Scope für diesen Plan

(siehe Spec, Abschnitt "Out of Scope"):
- MwSt, Buchhaltung, Gutschriften
- Detail-Tabellen für andere Kategorien (Drucker, Scanner etc.)
- Materialized Views
- Bulk-CSV-Import
- Preishistorie

Diese werden in Folgeplänen behandelt, wenn benötigt.
