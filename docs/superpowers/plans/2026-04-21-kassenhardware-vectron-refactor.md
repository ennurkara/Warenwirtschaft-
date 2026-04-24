# Kassenhardware + Vectron Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the "Registrierkasse" category into "Kassenhardware" with a hardware-first data model, and isolate Vectron-specific fields (Software-Seriennummer + Lizenzen) into their own table that only applies when the device's manufacturer is Vectron.

**Architecture:**
- Category rename `Registrierkasse` → `Kassenhardware`.
- `kassen_details` table is dropped and replaced by `vectron_details` (1:1 with `devices`, populated only for Vectron devices).
- Common hardware serial lives on `devices.serial_number` for every Kassenhardware device (no separate table).
- Pre-seeded manufacturers (Vectron, Orderman, Aures) and models (POS Touch 15, POS Touch 15 II, POS Touch 14, POS 7 / Magellan / Yuno B, Yuno 2) so model selection automatically determines manufacturer.
- Form and list UI derive "is Vectron?" from the selected model's manufacturer, not from the category.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), TypeScript, Tailwind/shadcn, Jest (limited — known-flaky in this env, rely on tsc + manual browser test).

**Branch:** `feat/warenwirtschaft-v2` (already active)

**Data note (destructive):** Migration 008 drops `kassen_details`. Any test data in that table will be lost. Device rows remain. After migration the user will re-enter Vectron details via the form.

---

## File Structure

**Create:**
- `supabase/migrations/008_kassenhardware_vectron.sql` — schema refactor + seed + RLS
- `components/inventory/vectron-fields.tsx` — Vectron-only form section

**Modify:**
- `lib/types.ts` — `KassenDetails` → `VectronDetails`, update `Device`
- `lib/category-columns.ts` — key `Registrierkasse` → `Kassenhardware`, drop TSE columns, add LICENSE_TYPE
- `lib/inventory/queries.ts` — `kassen_details(*)` → `vectron_details(*)` in select
- `components/inventory/device-form.tsx` — gate Vectron section by `model.manufacturer.name === 'Vectron'`, insert into `vectron_details`
- `components/inventory/device-list.tsx` — column renderers: `kassen_details` → `vectron_details`, drop TSE, add license_type
- `components/inventory/device-card.tsx` — `kassen_details.hw_serial` fallback → plain `serial_number` (hw serial now always on device)
- `components/inventory/model-picker.tsx` — remove "Variante (Full/Light)" hint (license now per-device, not per-model)
- `app/(protected)/inventory/[id]/page.tsx` — drop TSE fields, rename "Kassen-Details" → "Vectron-Details", show only if manufacturer = Vectron

**Delete:**
- `components/inventory/kassen-fields.tsx` (replaced by `vectron-fields.tsx`)

---

## Task 1: Migration 008 — Rename category, seed catalog, vectron_details table

**Files:**
- Create: `supabase/migrations/008_kassenhardware_vectron.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- supabase/migrations/008_kassenhardware_vectron.sql

-- 1. Kategorie umbenennen
UPDATE categories SET name = 'Kassenhardware' WHERE name = 'Registrierkasse';

-- 2. Alte kassen_details verwerfen (vectron_details ersetzt sie)
DROP TABLE IF EXISTS kassen_details CASCADE;

-- 3. Hersteller seeden (idempotent)
INSERT INTO manufacturers (name) VALUES
  ('Vectron'), ('Orderman'), ('Aures')
ON CONFLICT (name) DO NOTHING;

-- 4. Modelle seeden (idempotent via UNIQUE(manufacturer_id, modellname, variante, version))
WITH cat AS (SELECT id FROM categories WHERE name = 'Kassenhardware'),
     mv  AS (SELECT id FROM manufacturers WHERE name = 'Vectron'),
     mo  AS (SELECT id FROM manufacturers WHERE name = 'Orderman'),
     ma  AS (SELECT id FROM manufacturers WHERE name = 'Aures')
INSERT INTO models (manufacturer_id, category_id, modellname, variante, version)
SELECT mv.id, cat.id, 'POS Touch 15',    NULL, NULL FROM mv, cat UNION ALL
SELECT mv.id, cat.id, 'POS Touch 15 II', NULL, NULL FROM mv, cat UNION ALL
SELECT mv.id, cat.id, 'POS Touch 14',    NULL, NULL FROM mv, cat UNION ALL
SELECT mv.id, cat.id, 'POS 7',           NULL, NULL FROM mv, cat UNION ALL
SELECT mo.id, cat.id, 'Magellan',        NULL, NULL FROM mo, cat UNION ALL
SELECT ma.id, cat.id, 'Yuno B',          NULL, NULL FROM ma, cat UNION ALL
SELECT ma.id, cat.id, 'Yuno 2',          NULL, NULL FROM ma, cat
ON CONFLICT (manufacturer_id, modellname, variante, version) DO NOTHING;

-- 5. vectron_details Tabelle (1:1 mit devices, nur für Vectron-Geräte)
CREATE TYPE vectron_license_type AS ENUM ('full', 'light');

CREATE TABLE vectron_details (
  device_id   uuid PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  sw_serial   text,
  fiskal_2020 boolean NOT NULL DEFAULT false,
  zvt         boolean NOT NULL DEFAULT false,
  license_type vectron_license_type NOT NULL
);

-- 6. RLS für vectron_details
ALTER TABLE vectron_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vectron_details_select_all"
  ON vectron_details FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "vectron_details_insert_admin_staff"
  ON vectron_details FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin','mitarbeiter'))
  );

CREATE POLICY "vectron_details_update_admin_staff"
  ON vectron_details FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin','mitarbeiter'))
  );

CREATE POLICY "vectron_details_delete_admin"
  ON vectron_details FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin')
  );
```

- [ ] **Step 2: Apply migration via Supabase SQL Editor**

Paste the SQL into Supabase SQL Editor, run, confirm success. Verify:
```sql
SELECT name FROM categories WHERE name IN ('Kassenhardware','Registrierkasse');
-- expect one row: 'Kassenhardware'

SELECT mf.name, m.modellname FROM models m JOIN manufacturers mf ON mf.id = m.manufacturer_id
WHERE m.category_id = (SELECT id FROM categories WHERE name = 'Kassenhardware')
ORDER BY mf.name, m.modellname;
-- expect 7 rows (Aures Yuno 2, Aures Yuno B, Orderman Magellan, Vectron POS 7, Vectron POS Touch 14, Vectron POS Touch 15, Vectron POS Touch 15 II)

SELECT to_regclass('public.vectron_details');   -- expect: vectron_details
SELECT to_regclass('public.kassen_details');    -- expect: NULL
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/008_kassenhardware_vectron.sql
git commit -m "feat(db): rename Registrierkasse→Kassenhardware, seed catalog, add vectron_details"
```

---

## Task 2: Update TypeScript types

**Files:**
- Modify: `lib/types.ts:61-85`

- [ ] **Step 1: Replace `KassenDetails` with `VectronDetails`**

Replace lines 61-69 (the `KassenDetails` block) with:
```typescript
export type VectronLicenseType = 'full' | 'light'

export interface VectronDetails {
  device_id: string
  sw_serial: string | null
  fiskal_2020: boolean
  zvt: boolean
  license_type: VectronLicenseType
}
```

And update the `Device` interface (line 82): rename `kassen_details?: KassenDetails | null` to `vectron_details?: VectronDetails | null`.

- [ ] **Step 2: Verify tsc**

```bash
node node_modules/typescript/bin/tsc --noEmit
```
Expected: errors in every file that uses `kassen_details` or `KassenDetails` (those get fixed in later tasks). No syntax errors in `types.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "refactor(types): KassenDetails → VectronDetails with license_type"
```

---

## Task 3: Create VectronFields component

**Files:**
- Create: `components/inventory/vectron-fields.tsx`
- Delete: `components/inventory/kassen-fields.tsx`

- [ ] **Step 1: Write vectron-fields.tsx**

```tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { VectronLicenseType } from '@/lib/types'

export interface VectronFormState {
  sw_serial: string
  fiskal_2020: boolean
  zvt: boolean
  license_type: VectronLicenseType
}

export const INITIAL_VECTRON: VectronFormState = {
  sw_serial: '',
  fiskal_2020: false,
  zvt: false,
  license_type: 'full',
}

interface Props {
  value: VectronFormState
  onChange: (v: VectronFormState) => void
}

export function VectronFields({ value, onChange }: Props) {
  function set<K extends keyof VectronFormState>(k: K, v: VectronFormState[K]) {
    onChange({ ...value, [k]: v })
  }
  return (
    <fieldset className="border rounded p-4 space-y-3">
      <legend className="px-2 text-sm font-medium">Vectron-Details</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Software-Seriennummer</Label>
          <Input
            value={value.sw_serial}
            onChange={e => set('sw_serial', e.target.value)}
            className="font-mono"
            placeholder="z.B. VEC-12345"
          />
        </div>
        <div>
          <Label>Lizenzstufe *</Label>
          <Select value={value.license_type} onValueChange={v => set('license_type', v as VectronLicenseType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full (Verbund-fähig)</SelectItem>
              <SelectItem value="light">Light (Standalone)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-6 pt-1">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={value.fiskal_2020} onChange={e => set('fiskal_2020', e.target.checked)} />
          Fiskal-2020-Lizenz
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={value.zvt} onChange={e => set('zvt', e.target.checked)} />
          ZVT-Lizenz
        </label>
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 2: Delete kassen-fields.tsx**

```bash
rm components/inventory/kassen-fields.tsx
```

- [ ] **Step 3: Commit**

```bash
git add components/inventory/vectron-fields.tsx components/inventory/kassen-fields.tsx
git commit -m "feat(inventory): add VectronFields, remove KassenFields"
```

---

## Task 4: Update category-columns.ts

**Files:**
- Modify: `lib/category-columns.ts`

- [ ] **Step 1: Rewrite the file**

Replace the entire file with:
```typescript
export const COLUMN_KEY = {
  MODEL: 'model',
  MANUFACTURER: 'manufacturer',
  SERIAL: 'serial',           // = devices.serial_number (HW-SN for Kassenhardware)
  SW_SERIAL: 'sw_serial',     // Vectron-only
  FISKAL_2020: 'fiskal_2020', // Vectron-only
  ZVT: 'zvt',                 // Vectron-only
  LICENSE_TYPE: 'license_type', // Vectron-only
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

export function getColumnsForCategory(categoryName: string): ColumnDef[] {
  const simple = new Set(['Kabel', 'Sonstiges'])
  if (categoryName === 'Kassenhardware') return KASSENHARDWARE_COLUMNS
  if (simple.has(categoryName)) return SIMPLE_COLUMNS
  return GENERIC_DEVICE_COLUMNS
}
```

- [ ] **Step 2: Update the existing test (if present)**

Check `__tests__/category-columns.test.ts` — rename any `'Registrierkasse'` string literals to `'Kassenhardware'`, remove TSE-related assertions, add a `LICENSE_TYPE` column check.

- [ ] **Step 3: Run tsc**

```bash
node node_modules/typescript/bin/tsc --noEmit
```
Expected: `device-form.tsx` / `device-list.tsx` still fail (fixed in later tasks). `category-columns.ts` itself clean.

- [ ] **Step 4: Commit**

```bash
git add lib/category-columns.ts __tests__/category-columns.test.ts
git commit -m "refactor(columns): Kassenhardware key, drop TSE, add LICENSE_TYPE"
```

---

## Task 5: Update queries.ts

**Files:**
- Modify: `lib/inventory/queries.ts:4-14`

- [ ] **Step 1: Rename nested select**

Change line 11 `kassen_details(*),` → `vectron_details(*),`

- [ ] **Step 2: Commit**

```bash
git add lib/inventory/queries.ts
git commit -m "refactor(queries): select vectron_details instead of kassen_details"
```

---

## Task 6: Update device-form.tsx

**Files:**
- Modify: `components/inventory/device-form.tsx`

- [ ] **Step 1: Swap import + state + insert logic**

Changes:
1. Import `VectronFields, INITIAL_VECTRON, VectronFormState` from `@/components/inventory/vectron-fields` (replace the kassen-fields import, line 14).
2. Replace `const isKassen = category?.name === 'Registrierkasse'` (line 29) with:
   ```tsx
   const isKassenhardware = category?.name === 'Kassenhardware'
   const [models, setModels] = useState<Model[]>([])   // needs to be lifted from ModelPicker OR fetched here
   ```
   **Simpler:** expose the selected model via ModelPicker callback. Change `ModelPicker` `onChange` signature to pass both `modelId` and the full `Model` object so the form can read `model.manufacturer?.name`. Extend the prop: `onChange: (modelId: string, model: Model | null) => void`. Update `model-picker.tsx` accordingly to call `onChange(id, models.find(m => m.id === id) ?? null)`.
3. Add state:
   ```tsx
   const [selectedModel, setSelectedModel] = useState<Model | null>(null)
   const isVectron = selectedModel?.manufacturer?.name === 'Vectron'
   const [vectron, setVectron] = useState<VectronFormState>(INITIAL_VECTRON)
   ```
4. The form now **always** shows `serial_number` input for Kassenhardware too (it's the HW-SN). Remove the `{!isKassen && (...)}` wrapper — `Seriennummer` is unconditional.
5. Replace `{isKassen && <KassenFields ... />}` with `{isKassenhardware && isVectron && <VectronFields value={vectron} onChange={setVectron} />}`.
6. Replace the kassen_details insert block (lines 67-78) with:
   ```tsx
   if (isKassenhardware && isVectron) {
     const { error: vErr } = await supabase.from('vectron_details').insert({
       device_id: device.id,
       sw_serial: vectron.sw_serial || null,
       fiskal_2020: vectron.fiskal_2020,
       zvt: vectron.zvt,
       license_type: vectron.license_type,
     })
     if (vErr) { toast.error('Vectron-Details fehlgeschlagen', { description: vErr.message }); setIsLoading(false); return }
   }
   ```
7. Add `import type { Model } from '@/lib/types'`.

- [ ] **Step 2: Update ModelPicker onChange signature**

In `components/inventory/model-picker.tsx`:
- Change prop type: `onChange: (modelId: string, model: Model | null) => void`
- In the `<Select onValueChange={onChange}>` replace with:
  ```tsx
  <Select value={value} onValueChange={id => onChange(id, models.find(m => m.id === id) ?? null)}>
  ```
- In `createModel`, after successful insert with refresh, call `onChange(data.id, /* fetch fresh */ null)` — the refresh re-populates, but to pass the model object we can read from the refreshed `models` state. Simpler: after `await refresh()`, look up: `onChange(data.id, models.find(m => m.id === data.id) ?? null)` — but `models` may be stale within this render cycle. Do:
  ```tsx
  const { data: fresh } = await supabase
    .from('models')
    .select('*, manufacturer:manufacturers(*)')
    .eq('id', data.id)
    .single()
  await refresh()
  onChange(data.id, (fresh as Model) ?? null)
  ```
- Also: remove the "Variante (Full/Light)" label/placeholder — rename the label to just "Variante".

- [ ] **Step 3: Run tsc**

```bash
node node_modules/typescript/bin/tsc --noEmit
```
Expected: device-list.tsx and device detail page may still fail (next tasks).

- [ ] **Step 4: Commit**

```bash
git add components/inventory/device-form.tsx components/inventory/model-picker.tsx
git commit -m "feat(inventory): form writes vectron_details, gated by model manufacturer"
```

---

## Task 7: Update device-list.tsx

**Files:**
- Modify: `components/inventory/device-list.tsx`

- [ ] **Step 1: Fix search, columns, cell renderers**

1. Line 48: `const hw = (d.kassen_details?.hw_serial ?? '').toLowerCase()` → drop that line; add:
   ```tsx
   const sw = (d.vectron_details?.sw_serial ?? '').toLowerCase()
   ```
   and update the `matchesSearch` to include `sw.includes(s)` alongside name + serial_number.
2. In `cellValue` switch:
   - Remove `COLUMN_KEY.HW_SERIAL` and `COLUMN_KEY.TSE_SERIAL` and `COLUMN_KEY.TSE_VALID` cases.
   - `COLUMN_KEY.SERIAL`: keep as-is (`d.serial_number`) — this is now HW-SN for every Kassenhardware device.
   - `COLUMN_KEY.SW_SERIAL`: `return <span className="font-mono text-sm">{d.vectron_details?.sw_serial ?? '—'}</span>`
   - `COLUMN_KEY.FISKAL_2020`: `return d.vectron_details?.fiskal_2020 ? 'Ja' : d.vectron_details ? 'Nein' : '—'`
   - `COLUMN_KEY.ZVT`: analogous to FISKAL_2020
   - Add `COLUMN_KEY.LICENSE_TYPE`:
     ```tsx
     case COLUMN_KEY.LICENSE_TYPE: {
       const lt = d.vectron_details?.license_type
       if (!lt) return '—'
       return lt === 'full' ? 'Full' : 'Light'
     }
     ```
3. Update placeholder text: `Suchen (Name, Seriennr, SW-SN)...`

- [ ] **Step 2: Run tsc**

```bash
node node_modules/typescript/bin/tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/inventory/device-list.tsx
git commit -m "refactor(list): render vectron_details, add license column, drop TSE"
```

---

## Task 8: Update device-card.tsx + device detail page

**Files:**
- Modify: `components/inventory/device-card.tsx:36`
- Modify: `app/(protected)/inventory/[id]/page.tsx`

- [ ] **Step 1: device-card.tsx**

Line 36: `{device.model?.category?.name ?? '—'} · {device.serial_number ?? device.kassen_details?.hw_serial ?? '—'}`
Change to: `{device.model?.category?.name ?? '—'} · {device.serial_number ?? '—'}` (HW serial now always on device).

- [ ] **Step 2: Device detail page**

In `app/(protected)/inventory/[id]/page.tsx`:
1. Line 37: `const serialDisplay = device.kassen_details?.hw_serial ?? device.serial_number ?? '—'` → `const serialDisplay = device.serial_number ?? '—'`
2. Replace the TSE/SW-SN info-grid block (lines 70-87) with a Vectron section:
   ```tsx
   {device.vectron_details && (
     <>
       {device.vectron_details.sw_serial && (
         <div>
           <p className="text-xs text-slate-500 mb-0.5">SW-SN</p>
           <p className="font-mono">{device.vectron_details.sw_serial}</p>
         </div>
       )}
       <div>
         <p className="text-xs text-slate-500 mb-0.5">Lizenz</p>
         <p>{device.vectron_details.license_type === 'full' ? 'Full' : 'Light'}</p>
       </div>
       <div>
         <p className="text-xs text-slate-500 mb-0.5">Fiskal 2020</p>
         <p>{device.vectron_details.fiskal_2020 ? 'Ja' : 'Nein'}</p>
       </div>
       <div>
         <p className="text-xs text-slate-500 mb-0.5">ZVT</p>
         <p>{device.vectron_details.zvt ? 'Ja' : 'Nein'}</p>
       </div>
     </>
   )}
   ```

- [ ] **Step 3: Run tsc**

```bash
node node_modules/typescript/bin/tsc --noEmit
```
Expected: exit 0, zero errors.

- [ ] **Step 4: Commit**

```bash
git add components/inventory/device-card.tsx "app/(protected)/inventory/[id]/page.tsx"
git commit -m "refactor(detail): vectron_details section, HW serial from devices"
```

---

## Task 9: Manual end-to-end verification

- [ ] **Step 1: Start dev server**

```bash
node node_modules/next/dist/bin/next dev
```

- [ ] **Step 2: Browser smoke test**

1. Log in → `/inventory` → confirm category tile now reads **"Kassenhardware"** (not Registrierkasse).
2. Click Kassenhardware → confirm empty list (old test devices without vectron_details are still listed but with `—` in Vectron columns; that's fine).
3. Click "Gerät hinzufügen" → pick category Kassenhardware.
4. Model dropdown should show: `Aures Yuno 2`, `Aures Yuno B`, `Orderman Magellan`, `Vectron POS 7`, `Vectron POS Touch 14`, `Vectron POS Touch 15`, `Vectron POS Touch 15 II`.
5. Select **Aures Yuno B** → confirm: HW-Seriennummer visible, **NO** Vectron section.
6. Switch model to **Vectron POS Touch 15** → confirm: HW-Seriennummer **and** Vectron-Details section (SW-SN, Lizenz dropdown Full/Light, Fiskal/ZVT checkboxes) visible.
7. Fill all fields, add a supplier, set EK, submit. Expect redirect to inventory list.
8. Open the new device's detail page → confirm SW-SN, Lizenz, Fiskal, ZVT show correctly.
9. Inventory list desktop view: confirm new columns (HW-SN, SW-SN, Lizenz, Fiskal 2020, ZVT, EK, VK, Status) — no TSE.

- [ ] **Step 3: Commit the plan completion**

```bash
git add docs/superpowers/plans/2026-04-21-kassenhardware-vectron-refactor.md
git commit -m "docs: plan for Kassenhardware + Vectron refactor"
```

---

## Self-Review Checklist

- [x] Spec coverage — Kategorie umbenennen (T1), Model-Katalog seed (T1), vectron_details (T1), Lizenz-Dropdown (T3), auto-manufacturer via Modell (T6 via model FK), HW-SN auf devices (T6/T8), Orderman/Aures ohne Lizenz-Felder (T6 `isVectron` gating).
- [x] No placeholders — every step has concrete SQL/TSX.
- [x] Type consistency — `VectronDetails.license_type: VectronLicenseType` used identically in types, form state, query result, renderers.
- [x] Migration safety called out — destructive drop of `kassen_details` noted in header.
