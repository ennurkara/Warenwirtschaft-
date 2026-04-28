# Vectron-Daten Import ins Warenwirtschaftssystem

## Entscheidungen (geklärt)
- Inaktive Operatoren (≥90 Tage offline, 85 Stück) → komplett weglassen
- `vectron_details.license_type` → NULLABLE, manuell pflegbar
- Plattform → separat in `vectron_details.platform` (nicht in `models.variante`)

## Datenquelle
`data/vectron-operators/cash_registers_full.csv` — gefiltert auf `operatorContractStillActive=true`. Erwartet: ~221 Kunden, ~ Filialen, ~660 Kassen.

## Phase 1 — Schema-Migrationen
- [x] **M043** `customers` Vectron-Felder
  - `country text DEFAULT 'DE'`
  - `vat_id text` (USt-IdNr)
  - `tax_number text`
  - `customer_number text` (Vectron-Kundennr)
  - `vectron_operator_id uuid UNIQUE` (Re-Sync-Anker)
  - `last_heartbeat_at timestamptz`
  - Index auf `vectron_operator_id`
- [x] **M044** `customer_sites` (Filialen)
  - `id uuid PK`
  - `customer_id uuid → customers ON DELETE CASCADE`
  - `vectron_site_id uuid UNIQUE`
  - `site_no text` (z.B. "GHO13760-014")
  - `name text`
  - `street, postal_code, city, country`
  - `email, phone`
  - `created_at, updated_at`
  - RLS analog `customers`
- [x] **M045** `devices.site_id` + `vectron_details` erweitern
  - `devices.site_id → customer_sites ON DELETE SET NULL`
  - `vectron_details.license_type` NULLABLE machen
  - `vectron_details` neue Spalten: `sw_version, os_version, platform, login, connect_id, fiscal_identifier, last_heartbeat_at, vectron_cash_register_id uuid UNIQUE`
- [x] **M046** Models seeden (17 fehlende Vectron-Typen)
  - POS Touch 15 II Wide, POS Touch 14 Wide, POS Touch 12, POS Touch 12 II
  - POS MobilePro III, POS Mobile XL, POS Life
  - POS SteelTouch II (15 inch), POS SteelTouch II (17 inch)
  - POS M4, POS M4 Pay, POS Mini II, POS 7 Mini, POS Vario II, POS PC

- [x] **M047** Hotfix: Partial Unique Indexes durch echte UNIQUE-Constraints ersetzt (PostgREST onConflict-Anforderung)

## Phase 2 — Import-Skript
- [x] `scripts/import-vectron.mjs`
  - Liest `cash_registers_full.csv`
  - Filter `operatorContractStillActive === "true"`
  - UPSERT customers auf `vectron_operator_id`
  - UPSERT customer_sites auf `vectron_site_id`
  - UPSERT devices auf `serial_number` (status=`im_einsatz`, current_customer_id, site_id)
  - UPSERT vectron_details auf `vectron_cash_register_id`
  - Dry-Run-Modus + Stats-Report
- [x] Dry-Run, Spot-Check der Output-Stats
- [x] Echter Lauf — 221 customers / 486 sites / 808 devices / 808 vectron_details geschrieben, 0 Fehler

## Phase 3 — UI
- [ ] Kundenkartei `app/(protected)/kundenkartei/[id]/page.tsx`
  - Filialen-Block mit aufklappbarer Kassen-Tabelle pro Filiale
  - Status-Badge online / ≥30d offline
  - Hardware-Spalten: Modell, Plattform, SW, OS, S/N
- [ ] Inventory-Liste: keine Änderung nötig (Kassen erscheinen automatisch via category=Kassenhardware)
- [ ] Customer-Suche: nach `customer_number` und `vectron_operator_id` erweitern

## Phase 4 — Verification
- [ ] Colosseum Herrsching auffindbar, 2 Operator-Konten getrennt
- [ ] Bäckerei Betz mit 3 Filialen sichtbar
- [ ] Ziegler Tegernseer Platz mit beiden Kassen (POS Touch 15 II + POS Touch 15)
- [ ] tsc --noEmit grün
- [ ] manueller Browser-Test
