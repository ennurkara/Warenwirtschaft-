# Kundenkartei + Vectron/Apro-Datenmodell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine Kundenkartei-Detailseite mit zwei Hauptkundenklassen (Vectron, Apro). TSE wird als eigenes Inventar-Item geführt und via Arbeitsbericht in eine Kasse installiert. Verträge (MyVectron, Smart 4 Pay, Apro-Update-Service) und Apro-Lizenzen werden strukturiert verwaltet. EC-Geräte (A35, A800) gehen in die Inventur unter Hersteller "Vectron".

**Scope (in):**
- Migrations 029–033 (idempotent, manuell via Supabase SQL Editor)
- Detail-Seite `app/(protected)/customers/[id]/page.tsx` mit Sektionen Stammdaten / Kassen + TSE / Vertrag / Lizenzen / Arbeitsberichte
- Filter-Tabs in der Kunden-Liste
- TSE-Detail-Block im Device-Form bei Kategorie "TSE Swissbit"
- Cross-App: TSE-Mapping-Step im Arbeitsbericht-Wizard (`../arbeitsbericht/components/arbeitsberichte/wizard.tsx`)

**Scope (out):**
- PDF-Export der Kundenkartei
- Vertragsverlängerung-Workflow / Mahnungen
- Automatische Lizenz-Provisionierung

**Spec:** dieser Plan ist gleichzeitig die Spec — Single-Source-of-Truth für die Implementation. Keine separate Spec-Datei.

**Active branch:** `feat/customer-cards` (vom aktuellen `feat/warenwirtschaft-v2` abzweigen).

---

## Datenmodell-Übersicht

```
customers (customer_kind: vectron | apro | sonstige)
  ├─< contracts          (≤1 aktiv pro customer; kind: myvectron|smart4pay|apro_updates;
  │                       monthly_fee; ec_device_id FK; status: aktiv|gekuendigt|beendet)
  ├─< licenses           (Apro: name, license_key, monthly_update_fee, status)
  ├─< devices            (current_customer_id) ─┐
  │                                              ▼
  │                                        tse_details (1:1 für TSE-Devices:
  │                                        kind usb|sd, bsi_k_tr_number,
  │                                        expires_at, installed_in_device → device.id)
  └─< work_reports
```

**Wichtig:** TSE-Devices und Kassen-Devices liegen in derselben Tabelle `devices`. Unterscheidung über `models.category_id` → Kategorie "TSE Swissbit" vs. "Kassenhardware". `tse_details.installed_in_device` verlinkt eine TSE auf eine Kasse (beide sind devices).

---

## File Structure

**New:**
- `supabase/migrations/029_customer_kind.sql`
- `supabase/migrations/030_seed_ec_models.sql`
- `supabase/migrations/031_tse_details.sql`
- `supabase/migrations/032_contracts.sql`
- `supabase/migrations/033_licenses.sql`
- `app/(protected)/customers/[id]/page.tsx`
- `components/customers/customer-detail.tsx`
- `components/customers/customer-stammdaten-card.tsx`
- `components/customers/customer-devices-card.tsx`         — Kassen + TSE-Ampel
- `components/customers/customer-contract-card.tsx`        — Vectron- vs. Apro-Layout
- `components/customers/customer-licenses-card.tsx`        — nur Apro
- `components/customers/customer-work-reports-card.tsx`
- `components/customers/customer-kind-tabs.tsx`            — Filter-Tabs in Liste
- `components/inventory/tse-detail-block.tsx`              — Sub-Block in device-form
- `lib/customers/queries.ts`                                — CUSTOMER_DETAIL_SELECT
- `lib/tse/expiry.ts`                                       — Ampel-Helper (rot/gelb/grün)
- `__tests__/lib/tse-expiry.test.ts`
- `__tests__/components/customer-devices-card.test.tsx`
- `__tests__/components/customer-contract-card.test.tsx`

**Modified:**
- `lib/types.ts`                                            — neue Typen (Customer mit kind, Contract, License, TseDetails)
- `lib/inventory/queries.ts`                                — `DEVICE_SELECT` um `tse_details(*)` erweitern
- `app/(protected)/customers/page.tsx`                      — Filter-Tabs + Spalte "Gruppe"
- `components/inventory/device-form.tsx`                    — TSE-Block conditional einbauen
- `components/layout/sidebar.tsx`                           — kein Eintrag nötig (Kunde-Detail ist nur per Klick aus Liste erreichbar)
- `../arbeitsbericht/components/arbeitsberichte/wizard.tsx` — TSE-Mapping-Step
- `../arbeitsbericht/components/arbeitsberichte/step-geraete.tsx` — TSEs separat anzeigen + selektierbar machen

---

## Migration-Konventionen (Erinnerung)

- Numeriert, append-only, idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`)
- Anwendung: **manuell via Supabase SQL Editor** auf `https://supabase.kassen-buch.cloud`
- RLS auf jeder neuen Tabelle, Pattern aus `016_work_reports_rls.sql` (`get_my_role()`-Helper, SELECT für authenticated, INSERT/UPDATE für admin+mitarbeiter, DELETE für admin)
- `update_updated_at()` Trigger auf jeder neuen Tabelle mit `updated_at`-Spalte

---

## Task 1: Migration 029 — `customer_kind`

**File:** `supabase/migrations/029_customer_kind.sql`

- [ ] **Step 1: ENUM und Spalte anlegen, idempotent**

```sql
-- supabase/migrations/029_customer_kind.sql
-- Klassifiziert Kunden in Vectron, Apro oder Sonstige.

DO $$ BEGIN
  CREATE TYPE customer_kind_enum AS ENUM ('vectron', 'apro', 'sonstige');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_kind customer_kind_enum NOT NULL DEFAULT 'sonstige';

CREATE INDEX IF NOT EXISTS customers_kind_idx ON customers(customer_kind);

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Manuell im SQL Editor anwenden**, danach `SELECT customer_kind, count(*) FROM customers GROUP BY 1;` als Smoke-Test.

---

## Task 2: Migration 030 — Kategorie "EC-Gerät" + Modelle A35, A800

**File:** `supabase/migrations/030_seed_ec_models.sql`

- [ ] **Step 1: Kategorie und Modelle seeden, ON CONFLICT DO NOTHING.**

```sql
-- supabase/migrations/030_seed_ec_models.sql
-- EC-Geräte als Vectron-Modelle in eigener Kategorie.

INSERT INTO categories (name, icon, kind, cluster)
VALUES ('EC-Gerät', 'credit-card', 'generic', 'kassen')
ON CONFLICT (name) DO NOTHING;

-- Vectron muss als Hersteller existieren (siehe 008_kassenhardware_vectron.sql).
INSERT INTO models (manufacturer_id, category_id, modellname, variante)
SELECT m.id, c.id, 'A35',  'kabelgebunden'
FROM manufacturers m
JOIN categories c ON c.name = 'EC-Gerät'
WHERE m.name = 'Vectron'
ON CONFLICT (manufacturer_id, modellname, variante, version) DO NOTHING;

INSERT INTO models (manufacturer_id, category_id, modellname, variante)
SELECT m.id, c.id, 'A800', 'mobil'
FROM manufacturers m
JOIN categories c ON c.name = 'EC-Gerät'
WHERE m.name = 'Vectron'
ON CONFLICT (manufacturer_id, modellname, variante, version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2:** Smoke-Test: `SELECT * FROM models JOIN categories c ON c.id = category_id WHERE c.name='EC-Gerät';` → 2 Zeilen.

---

## Task 3: Migration 031 — `tse_details`

**File:** `supabase/migrations/031_tse_details.sql`

- [ ] **Step 1: ENUM, Tabelle, Indexe, RLS.**

```sql
-- supabase/migrations/031_tse_details.sql
-- 1:1-Detail-Tabelle für TSE-Devices (Kategorie "TSE Swissbit").
-- installed_in_device verlinkt die TSE auf eine Kasse, sobald installiert.

DO $$ BEGIN
  CREATE TYPE tse_kind_enum AS ENUM ('usb', 'sd');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tse_details (
  device_id            uuid PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  kind                 tse_kind_enum NOT NULL,
  bsi_k_tr_number      text,
  expires_at           date,
  installed_in_device  uuid REFERENCES devices(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tse_details_installed_idx
  ON tse_details(installed_in_device) WHERE installed_in_device IS NOT NULL;
CREATE INDEX IF NOT EXISTS tse_details_expires_idx
  ON tse_details(expires_at) WHERE expires_at IS NOT NULL;

DROP TRIGGER IF EXISTS tse_details_updated_at ON tse_details;
CREATE TRIGGER tse_details_updated_at
  BEFORE UPDATE ON tse_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tse_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tse_select" ON tse_details;
CREATE POLICY "tse_select" ON tse_details
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tse_insert" ON tse_details;
CREATE POLICY "tse_insert" ON tse_details
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'mitarbeiter'));

DROP POLICY IF EXISTS "tse_update" ON tse_details;
CREATE POLICY "tse_update" ON tse_details
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'mitarbeiter'));

DROP POLICY IF EXISTS "tse_delete" ON tse_details;
CREATE POLICY "tse_delete" ON tse_details
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2:** Smoke: `SELECT * FROM tse_details;` → leer.

---

## Task 4: Migration 032 — `contracts`

**File:** `supabase/migrations/032_contracts.sql`

- [ ] **Step 1: ENUMs, Tabelle, Partial-Unique, RLS.**

```sql
-- supabase/migrations/032_contracts.sql
-- Vertrags-Tabelle: max. 1 aktiver Vertrag pro Kunde.

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

-- Höchstens ein aktiver Vertrag pro Kunde
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
```

- [ ] **Step 2:** Constraint-Test: 2 contracts mit `status='aktiv'` für denselben Kunden → 2. Insert muss mit `unique constraint violation` scheitern. Anschließend Cleanup.

---

## Task 5: Migration 033 — `licenses`

**File:** `supabase/migrations/033_licenses.sql`

- [ ] **Step 1: Tabelle + RLS.**

```sql
-- supabase/migrations/033_licenses.sql
-- Apro-Lizenzen: einzelne Module/Lizenzen mit monatlicher Update-Gebühr.

DO $$ BEGIN
  CREATE TYPE license_status_enum AS ENUM ('aktiv', 'gekuendigt', 'abgelaufen');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS licenses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  name                text NOT NULL,
  license_key         text,
  purchased_at        date,
  monthly_update_fee  numeric(10,2),
  status              license_status_enum NOT NULL DEFAULT 'aktiv',
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS licenses_customer_idx ON licenses(customer_id);
CREATE INDEX IF NOT EXISTS licenses_status_idx   ON licenses(status);

DROP TRIGGER IF EXISTS licenses_updated_at ON licenses;
CREATE TRIGGER licenses_updated_at
  BEFORE UPDATE ON licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "licenses_select" ON licenses;
CREATE POLICY "licenses_select" ON licenses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "licenses_insert" ON licenses;
CREATE POLICY "licenses_insert" ON licenses
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'mitarbeiter'));

DROP POLICY IF EXISTS "licenses_update" ON licenses;
CREATE POLICY "licenses_update" ON licenses
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'mitarbeiter'));

DROP POLICY IF EXISTS "licenses_delete" ON licenses;
CREATE POLICY "licenses_delete" ON licenses
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

NOTIFY pgrst, 'reload schema';
```

---

## Task 6: TypeScript-Typen + Query-Helper

**Files:**
- Modify: `lib/types.ts`
- New: `lib/customers/queries.ts`
- Modify: `lib/inventory/queries.ts`

- [ ] **Step 1:** In `lib/types.ts` erweitern:
  - `Customer` bekommt `customer_kind: 'vectron' | 'apro' | 'sonstige'`
  - Neuer Typ `Contract { id, customer_id, kind, start_date, end_date, monthly_fee, status, ec_device_id, notes }`
  - Neuer Typ `License { id, customer_id, name, license_key, purchased_at, monthly_update_fee, status }`
  - Neuer Typ `TseDetails { device_id, kind: 'usb' | 'sd', bsi_k_tr_number, expires_at, installed_in_device }`
  - `Device` bekommt optionale `tse_details: TseDetails | null`

- [ ] **Step 2:** `lib/inventory/queries.ts` — `DEVICE_SELECT` um `tse_details(*)` erweitern.

- [ ] **Step 3:** `lib/customers/queries.ts` — neuer Konstanten-Export `CUSTOMER_DETAIL_SELECT`:

```ts
export const CUSTOMER_DETAIL_SELECT = `
  *,
  devices:devices!current_customer_id(${DEVICE_SELECT}),
  contracts(*, ec_device:devices!ec_device_id(${DEVICE_SELECT})),
  licenses(*),
  work_reports(id, report_number, start_time, status)
`
```

(Reihenfolge der Joins egal; PGRST200 möglich falls FK fehlt → Migration prüfen.)

---

## Task 7: Detail-Seite + Karten-Komponenten

**Files:**
- New: `app/(protected)/customers/[id]/page.tsx`
- New: `components/customers/customer-detail.tsx`
- New: `components/customers/customer-stammdaten-card.tsx`
- New: `components/customers/customer-devices-card.tsx`
- New: `components/customers/customer-contract-card.tsx`
- New: `components/customers/customer-licenses-card.tsx`
- New: `components/customers/customer-work-reports-card.tsx`
- New: `lib/tse/expiry.ts`

- [ ] **Step 1:** `app/(protected)/customers/[id]/page.tsx` als Server-Komponente mit `createClient()` aus `lib/supabase/server.ts`. Lädt customer per `CUSTOMER_DETAIL_SELECT`. Rendert `<CustomerDetail customer={...} />`.

- [ ] **Step 2:** `customer-detail.tsx` als Client-Komponente nur falls Edit-Aktionen nötig — sonst Server. Layout: 2-Spalten-Grid auf Desktop (Stammdaten | Vertrag), darunter volle Breite (Kassen+TSE), darunter (Lizenzen — nur bei Apro), darunter (Arbeitsberichte).

- [ ] **Step 3:** `customer-devices-card.tsx`:
  - Zeigt alle Kassen des Kunden (devices wo Modell-Kategorie = "Kassenhardware" UND `current_customer_id = customer.id`)
  - Pro Kasse: Zeile mit Modell, Seriennummer, daneben TSE-Block: serial + expires_at + Ampel (rot <60d, gelb <180d, grün ≥180d, grau wenn keine TSE installiert)
  - Helper `lib/tse/expiry.ts` exportiert `getTseAmpel(expires_at: string | null): 'rot' | 'gelb' | 'gruen' | 'grau'`

- [ ] **Step 4:** `customer-contract-card.tsx`:
  - Bei `customer_kind='vectron'`: aktiver Vertrag (myvectron oder smart4pay), Felder Laufzeit + monatliche Gebühr; bei smart4pay zusätzlich verknüpftes EC-Gerät (Modell + Seriennummer)
  - Bei `customer_kind='apro'`: aktiver Vertrag (apro_updates), Laufzeit + monatliche Gebühr
  - Bei `sonstige`: Karte ausblenden
  - Falls kein aktiver Vertrag: Hinweis "Kein aktiver Vertrag" + Button "Neu" (Edit kommt in späterer Iteration — vorerst nur Anzeige)

- [ ] **Step 5:** `customer-licenses-card.tsx`: nur sichtbar bei `customer_kind='apro'`. Tabelle der Lizenzen mit Name, License-Key, Status, monatliche Gebühr.

- [ ] **Step 6:** `customer-work-reports-card.tsx`: Liste mit Berichtsnummer, Datum, Status; Link zu `/arbeitsberichte/[id]` (read-only Detail in dieser App).

- [ ] **Step 7:** Tests:
  - `__tests__/lib/tse-expiry.test.ts` — Grenzwerte 0/59/60/179/180 Tage + null
  - `__tests__/components/customer-devices-card.test.tsx` — Snapshot mit 2 Kassen, eine mit TSE rot, eine ohne
  - `__tests__/components/customer-contract-card.test.tsx` — drei Cases: vectron+aktiv, apro+aktiv, sonstige

---

## Task 8: Filter-Tabs in der Kunden-Liste

**Files:**
- Modify: `app/(protected)/customers/page.tsx`
- New: `components/customers/customer-kind-tabs.tsx`

- [ ] **Step 1:** `customer-kind-tabs.tsx` — Tabs `Alle | Vectron | Apro | Sonstige` (shadcn Tabs). Steuert per URL-Query `?kind=...` (kein State). Server-Page liest `searchParams.kind` und filtert die Supabase-Query mit `.eq('customer_kind', kind)`.

- [ ] **Step 2:** Spalte "Gruppe" mit Badge in der Liste hinzufügen.

- [ ] **Step 3:** Test: `__tests__/components/customer-kind-tabs.test.tsx` — Klick auf Tab ändert URL.

---

## Task 9: Device-Form: TSE-Detail-Block

**Files:**
- Modify: `components/inventory/device-form.tsx`
- New: `components/inventory/tse-detail-block.tsx`

- [ ] **Step 1:** `tse-detail-block.tsx`: Felder `kind` (Radio: USB / SD), `bsi_k_tr_number` (text), `expires_at` (date). Nimmt `value` + `onChange` Props.

- [ ] **Step 2:** In `device-form.tsx`: analog zu Vectron-Block, gate auf `selectedModel?.category?.name === 'TSE Swissbit'`. Block sichtbar = TSE-Felder Pflicht. Save-Action schreibt in `tse_details` (UPSERT auf `device_id`).

- [ ] **Step 3:** Beim Reset (Kategorie-Wechsel) `tse_details` State auch resetten.

- [ ] **Step 4:** Test: `__tests__/components/tse-detail-block.test.tsx` — Felder rendern, onChange feuert.

---

## Task 10: Cross-App — Arbeitsbericht-Wizard TSE-Mapping

**Files (in `../arbeitsbericht/`):**
- Modify: `components/arbeitsberichte/wizard.tsx`
- Modify: `components/arbeitsberichte/step-geraete.tsx`
- New: `components/arbeitsberichte/step-tse-mapping.tsx`

> **Hinweis:** Dieses Repo (`warenwirtschaft`) hat keine Schreibrechte auf `../arbeitsbericht/`. Der Plan wird hier dokumentiert; die Umsetzung erfolgt in der Schwester-App. Beide Apps teilen sich dieselbe DB.

- [ ] **Step 1:** `step-geraete.tsx`: Devices-Liste in zwei Sektionen splitten — "Kassen" (Kategorie `Kassenhardware`) und "TSE-Module" (Kategorie `TSE Swissbit`). Beide separat selektierbar.

- [ ] **Step 2:** Neuer `step-tse-mapping.tsx` (Step zwischen Geräte und Unterschrift):
  - Wird übersprungen, wenn keine TSE oder keine Kasse ausgewählt
  - Bei genau 1 TSE + 1 Kasse → Auto-Mapping ohne UI
  - Bei mehreren → für jede ausgewählte TSE Dropdown "in welche Kasse installieren?"
  - Skip-Option falls TSE im AB ist, aber doch nicht installiert wird

- [ ] **Step 3:** `wizard.tsx` `handleFinish()`:
  - Schreibt `tse_details.installed_in_device = kasse.id` für gemappte TSEs (UPSERT)
  - Setzt `devices.status = 'im_einsatz'` für Kassen UND `'im_einsatz'` für TSEs (oder `'installiert'` falls eigener Status gewünscht — siehe offene Frage unten)
  - Bestehende `work_report_devices`-Inserts unverändert

- [ ] **Step 4:** Tests in der Schwester-App: `__tests__/components/step-tse-mapping.test.tsx`.

---

## Task 11: Smoke- und Akzeptanztests am Ende

- [ ] Migrationen 029–033 manuell im Supabase SQL Editor angewendet, alle ohne Fehler.
- [ ] `npx tsc --noEmit` grün.
- [ ] `npx jest` grün (oder begründet skipped).
- [ ] Manuell im Browser:
  - [ ] Kunde anlegen, `customer_kind` setzen.
  - [ ] TSE-Device anlegen mit Kategorie "TSE Swissbit", Felder werden gespeichert.
  - [ ] Vertrag manuell per SQL anlegen, Detail-Seite zeigt ihn.
  - [ ] Zweiten aktiven Vertrag versuchen → DB blockt mit Unique-Violation.
  - [ ] Ampel-Logik: TSE mit Ablauf in 30 Tagen → rot; in 100 → gelb; in 365 → grün.
  - [ ] Filter-Tabs funktionieren (URL ändert sich, Liste filtert).
  - [ ] Apro-Kunde: Lizenz-Karte sichtbar; Vectron: ausgeblendet.

---

## Akzeptanzkriterien

1. **Datenmodell** — `customers.customer_kind`, `tse_details`, `contracts`, `licenses` existieren in Prod, RLS aktiv, Partial-Unique greift.
2. **Detail-Seite** — `/customers/[id]` zeigt alle Sektionen sauber, Performance < 500ms (Server-Render, ein Round-Trip).
3. **TSE-Ampel** — Farbe stimmt mit den Grenzwerten überein, kein TSE → grau (nicht rot).
4. **Liste-Filter** — Tabs filtern korrekt, URL persistiert (`?kind=vectron`).
5. **Device-Form** — TSE-Block nur bei Kategorie "TSE Swissbit"; UPSERT klappt; Reset bei Kategoriewechsel.
6. **Cross-App** — Im Arbeitsbericht: Auto-Zuordnung 1:1; Mapping-Step bei N:M; nach Finish steht `tse_details.installed_in_device` korrekt.
7. **Backwards-Compat** — Bestehende Kunden bekommen Default `'sonstige'`, kein bisheriger Workflow bricht.

---

## Offene Punkte (für spätere Iterationen, nicht in diesem Plan)

- Edit-UI für Contracts und Licenses (vorerst nur SQL-Inserts oder Admin-Detail-Form)
- TSE-Status-Enum erweitern? (z.B. eigener Status `installiert` statt `im_einsatz`?) — heute reicht `im_einsatz` + `installed_in_device IS NOT NULL`
- PDF-Export der Kundenkartei
- Vertragsverlängerung-Workflow + Erinnerung 60 Tage vor Ablauf
- Apro-Hardware (Windows-PCs) — Image-Profile als eigenes Modell?

---

## Reihenfolge der Ausführung

```
029 → 030 → 031 → 032 → 033   (Migrationen)
   ↓
Task 6  (Types + Queries)
   ↓
Task 7  (Detail-Seite + Karten)        ──┐
Task 8  (Filter-Tabs in Liste)         ──┤── parallel möglich
Task 9  (Device-Form TSE-Block)        ──┘
   ↓
Task 10 (Cross-App Wizard, separates Repo)
   ↓
Task 11 (Smoke + Akzeptanz)
```

---

## Out-of-Band: Cleanup-Hinweis

Nach Plan-Abschluss prüfen, ob `tasks/lessons.md` Einträge zu Vectron/Apro-Klassifikation oder TSE-Modellierung bekommt — falls die Implementierung Korrekturen am Plan auslöst, dort dokumentieren.
