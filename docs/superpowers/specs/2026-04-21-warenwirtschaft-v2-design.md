# Warenwirtschaft v2 — Design Spec

**Datum:** 2026-04-21
**Status:** Approved
**Autor:** ennurkara
**Ersetzt teilweise:** `2026-04-19-warenwirtschaft-design.md` (Datenmodell, Frontend-Inventar, Dashboard)

---

## Überblick

Erweiterung des bestehenden Warenwirtschaftssystems um:

1. **Einzelstück-Tracking** — jedes physische Gerät ist eine eigene Zeile mit eindeutiger Identität (statt Bulk-Mengen)
2. **Einkauf/Verkauf mit Belegen** — Lieferanten, Kunden, Rechnungen inkl. Positionen
3. **Preise** — Einkaufspreis (EK) und Verkaufspreis (VK) leben auf den Beleg-Positionen
4. **Produkt-Katalog** — normalisierte `models`-Tabelle (Hersteller + Modell + Variante)
5. **Kategorie-spezifische Detail-Tabellen** — Kassen bekommen Fiskal-2020, ZVT, HW/SW-SN, TSE; Erweiterbar für andere Kategorien
6. **Dashboard mit KPIs** — Bestandswert, Umsatz, Marge, TSE-Ablauf

Das bisherige Bulk-Modell (`devices.quantity`, `device_movements`) wird aufgegeben.

---

## Datenmodell

### Architektur-Diagramm

```
┌─ categories ─┐     ┌─ manufacturers ─┐
│ id, name,    │     │ id, name        │
│ icon         │     └────────┬────────┘
└──────┬───────┘              │
       │                      │
       │   ┌─ models ─────────▼──────────┐
       └──►│ id, manufacturer_id,        │
           │ category_id, modellname,    │
           │ variante (Full/Light),      │
           │ version                     │
           └──────────────┬──────────────┘
                          │
       ┌─ devices ────────▼───────────────┐
       │ id, model_id, serial_number,     │◄── Basistabelle
       │ status, location,                │    für ALLE Geräte
       │ photo_url, notes                 │
       └─┬──────────────────────────────┬─┘
         │                              │
   ┌─────▼─────────┐            ┌───────▼──────────┐
   │ kassen_details│            │ (künftig:        │
   └───────────────┘            │  drucker_details)│
                                └──────────────────┘

   ┌─ suppliers ─┐   ┌─ customers ─┐
   └──────┬──────┘   └──────┬──────┘
          │                 │
   ┌──────▼──────┐   ┌──────▼──────┐
   │ purchases   │   │ sales       │
   └──────┬──────┘   └──────┬──────┘
          │                 │
   ┌──────▼──────────┐ ┌────▼──────────┐
   │ purchase_items  │ │ sale_items    │
   │ (device_id UQ)  │ │ (device_id UQ)│
   └─────────────────┘ └───────────────┘
```

### Tabellen-Definitionen

```sql
-- Hersteller (eigene Entität für Normalisierung und Autocomplete)
manufacturers
  id          uuid PK DEFAULT gen_random_uuid()
  name        text NOT NULL UNIQUE
  created_at  timestamptz DEFAULT now()

-- Produkt-Katalog (ein Eintrag pro Modell-Variante-Version-Kombi)
models
  id              uuid PK DEFAULT gen_random_uuid()
  manufacturer_id uuid NOT NULL REFERENCES manufacturers(id)
  category_id     uuid NOT NULL REFERENCES categories(id)
  modellname      text NOT NULL
  variante        text          -- z.B. "Full", "Light"
  version         text          -- z.B. "6.5"
  created_at      timestamptz DEFAULT now()
  UNIQUE (manufacturer_id, modellname, variante, version)

-- Physisches Einzelgerät (1 Row = 1 echtes Gerät)
devices  -- ERSETZT das bisherige Schema
  id            uuid PK DEFAULT gen_random_uuid()
  model_id      uuid NOT NULL REFERENCES models(id)
  serial_number text          -- Generische SN für Nicht-Kassen
  status        device_status NOT NULL DEFAULT 'lager'
    -- enum: 'lager', 'reserviert', 'verkauft', 'defekt', 'ausgemustert'
  location      text
  photo_url     text
  notes         text
  created_at    timestamptz DEFAULT now()
  updated_at    timestamptz DEFAULT now()

-- Kassen-spezifische Felder (1:1 zu devices)
kassen_details
  device_id       uuid PK REFERENCES devices(id) ON DELETE CASCADE
  fiskal_2020     boolean NOT NULL DEFAULT false
  zvt             boolean NOT NULL DEFAULT false
  hw_serial       text
  sw_serial       text
  tse_serial      text
  tse_valid_until date

-- Lieferanten
suppliers
  id         uuid PK DEFAULT gen_random_uuid()
  name       text NOT NULL
  email      text
  phone      text
  address    text
  notes      text
  created_at timestamptz DEFAULT now()

-- Kunden
customers
  id         uuid PK DEFAULT gen_random_uuid()
  name       text NOT NULL
  email      text
  phone      text
  address    text
  notes      text
  created_at timestamptz DEFAULT now()

-- Einkaufsbelege (Kopf)
purchases
  id          uuid PK DEFAULT gen_random_uuid()
  supplier_id uuid NOT NULL REFERENCES suppliers(id)
  rechnungsnr text
  datum       date NOT NULL
  notes       text
  created_by  uuid REFERENCES profiles(id)
  created_at  timestamptz DEFAULT now()

-- Einkaufsbeleg-Positionen (jede Position = ein Einzelgerät)
purchase_items
  id          uuid PK DEFAULT gen_random_uuid()
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE
  device_id   uuid NOT NULL UNIQUE REFERENCES devices(id)
  ek_preis    numeric(10,2) NOT NULL
  UNIQUE constraint erzwingt: jedes Gerät hat genau 1 Einkauf

-- Verkaufsbelege (Kopf)
sales
  id          uuid PK DEFAULT gen_random_uuid()
  customer_id uuid NOT NULL REFERENCES customers(id)
  rechnungsnr text
  datum       date NOT NULL
  notes       text
  created_by  uuid REFERENCES profiles(id)
  created_at  timestamptz DEFAULT now()

-- Verkaufsbeleg-Positionen
sale_items
  id         uuid PK DEFAULT gen_random_uuid()
  sale_id    uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE
  device_id  uuid NOT NULL UNIQUE REFERENCES devices(id)
  vk_preis   numeric(10,2) NOT NULL
```

### Designentscheidungen

- **Preise nur auf Beleg-Positionen**, nicht auf `devices` → keine Duplikate, historisch korrekt bei Preisänderungen.
- **`UNIQUE (device_id)` auf `purchase_items` und `sale_items`** → jedes Gerät kann nur einmal gekauft und nur einmal verkauft werden.
- **`devices.status`** wird teilweise aus JOINs abgeleitet: existiert `sale_items`-Eintrag → "Verkauft". Der Status auf `devices` deckt nur die Zustände ab, die nicht aus Belegen folgen: `lager`, `reserviert`, `defekt`, `ausgemustert`. Wenn `sale_items` existiert, wird `verkauft` in der UI gezeigt, unabhängig vom `devices.status` (der beim Verkauf auf `verkauft` gesetzt wird — zur Redundanz und einfacheren Queries).
- **Kassen-Details als eigene 1:1-Tabelle**, PK = FK → keine Waisen, keine NULL-Spalten auf `devices` für Nicht-Kassen.
- **`models` referenziert `category_id`** → verhindert, dass ein Vectron-Modell versehentlich als "Drucker" eingeordnet wird.
- **`manufacturers` als eigene Tabelle** statt Freitext auf `models` → Autocomplete, keine Duplikate durch Tippfehler (Vectron vs. vectron vs. VECTRON).

---

## Frontend

### Inventar-Navigation

```
/inventory                     → Kategorie-Grid (bestehend, unverändert)
/inventory?category=<uuid>     → Gerätetabelle, Spalten kategorie-spezifisch
/inventory?category=all        → Alle Geräte flat
/inventory/device/<id>         → Gerätedetail mit EK-/VK-Beleg, Historie
/inventory/new                 → Gerät anlegen (Kategorie → Formular passt sich an)
```

### Kategorie-abhängige Tabellen-Spalten

Definiert in `lib/category-columns.ts` als Lookup-Map:

| Kategorie | Spalten |
|---|---|
| Registrierkasse | Modell · Hersteller · HW-SN · SW-SN · TSE · Fiskal 2020 · ZVT · EK · VK · Status |
| Drucker / Scanner / Monitor / Tastatur / Maus / Netzwerk | Modell · Hersteller · Seriennr · EK · VK · Status |
| Kabel / Sonstiges | Name · EK · VK · Standort · Status |

**Herleitung der Spalten-Werte:**
- `Modell`, `Hersteller`, `Variante`, `Version` → JOIN über `models` + `manufacturers`
- `EK` → JOIN `purchase_items` auf `device_id`, zeigt `ek_preis`
- `VK` → JOIN `sale_items` auf `device_id`, zeigt `vk_preis` oder "—" wenn nicht verkauft
- `Status` → wenn `sale_items` existiert: "Verkauft" (grün); sonst `devices.status`
- Kassen-Felder → JOIN `kassen_details` auf `device_id`

### Gerät hinzufügen — Flow

1. Kategorie wählen (Dropdown oder Kontext aus `?category=<uuid>`)
2. Formular passt sich an:
   - Kassen → zeigt Kassen-Felder (Fiskal, ZVT, HW/SW/TSE-SN, TSE-Ablauf)
   - Andere → generisches `serial_number` Feld
3. Modell wählen: Autocomplete aus `models` (filtered by category_id) oder Button "Neues Modell" → Inline-Modal mit Hersteller/Modellname/Variante/Version
4. Einkaufs-Sektion (optional aufklappbar, standardmäßig auf):
   - Lieferant (Autocomplete aus `suppliers` oder "Neu anlegen")
   - Rechnungsnr
   - Datum (default: heute)
   - EK-Preis
5. Foto-Upload (bestehendes Feature bleibt)
6. Absenden → Transaktion: INSERT `devices` + INSERT `kassen_details` (falls Kategorie Kassen) + INSERT/UPSERT `purchases` (selber Lieferant+Datum+Rechnungsnr = gleicher Beleg) + INSERT `purchase_items`

### Gerät verkaufen — Flow

1. Auf Gerätedetail-Seite: Button "Verkaufen"
2. Modal:
   - Kunde (Autocomplete aus `customers` oder "Neu anlegen")
   - Rechnungsnr
   - Datum (default: heute)
   - VK-Preis
3. Absenden → Transaktion: INSERT/UPSERT `sales` + INSERT `sale_items` + UPDATE `devices.status = 'verkauft'`

### Admin-Seiten

Neue Admin-Routen:
- `/admin/manufacturers` — CRUD Hersteller
- `/admin/models` — CRUD Modelle (inkl. Zuordnung Hersteller + Kategorie)
- `/admin/suppliers` — CRUD Lieferanten
- `/admin/customers` — CRUD Kunden
- `/admin/purchases` — Einkaufsbelege durchsuchen
- `/admin/sales` — Verkaufsbelege durchsuchen

---

## Dashboard

### Layout

```
┌─ 4 KPI-Kacheln ─────────────────────────────────────────┐
│ Geräte im Lager │ Bestandswert │ Umsatz MTD │ Marge MTD │
└─────────────────────────────────────────────────────────┘
┌─ Bestand nach Kategorie (Bar) ─┐ ┌─ Verkäufe 30d (Line) ─┐
└────────────────────────────────┘ └───────────────────────┘
┌─ Letzte 5 Verkäufe ────────────┐ ┌─ Top-Modelle Umsatz ──┐
└────────────────────────────────┘ └───────────────────────┘
                                   ┌─ TSE-Warnungen ───────┐
                                   └───────────────────────┘
```

### Datenquellen (SQL-Views)

- `v_dashboard_kpis` — eine Row: `geraete_im_lager`, `bestandswert_ek`, `umsatz_mtd`, `marge_mtd`
- `v_stock_by_category` — Rows: `category_name`, `anzahl_im_lager`, `bestandswert_ek`
- `v_sales_last_30d` — Rows: `tag`, `umsatz`
- `v_top_models_revenue` — Rows: `model_label`, `stueckzahl_verkauft`, `umsatz_ytd` (ORDER BY umsatz DESC LIMIT 5)
- `v_recent_sales` — letzte 5 Verkäufe mit JOIN auf Kunde + Modell
- `v_tse_expiring` — Kassen mit `tse_valid_until` ≤ heute + 90 Tage

**Warum Views:** Business-Logik zentral in der DB, Frontend lädt nur `SELECT * FROM v_...`. Performance durch PostgreSQL-Planner; falls zu langsam, später als Materialized View mit Refresh-Job.

---

## Migrations-Strategie

**Annahme:** Bestehende Supabase-DB hat noch keine Produktivdaten (Schema wurde erst kürzlich deployed). **Vor dem Ausführen wird das verifiziert** — Abfrage `SELECT count(*) FROM devices`. Bei >0 Zeilen wird gestoppt und Daten-Migration besprochen.

### Migration 003_warenwirtschaft.sql

Legt neue Strukturen an:
- ENUM `device_status` erweitert (inkl. `verkauft`, `reserviert`) — falls bestehender enum nicht geändert werden kann: neuer Enum-Typ + Spalten-Cast
- Tabellen: `manufacturers`, `models`, `suppliers`, `customers`, `purchases`, `purchase_items`, `sales`, `sale_items`, `kassen_details`
- Alle Views: `v_dashboard_kpis`, `v_stock_by_category`, `v_sales_last_30d`, `v_top_models_revenue`, `v_recent_sales`, `v_tse_expiring`
- Trigger: `updated_at` auf `devices` bleibt

### Migration 004_devices_restructure.sql

Passt `devices` ans neue Modell an:
- DROP `quantity`, `condition` (Bulk-Konzept entfällt)
- DROP `category_id` (Kategorie kommt jetzt über `models.category_id`)
- DROP `name` (Name wird aus `models.modellname` abgeleitet)
- ADD `model_id uuid NOT NULL REFERENCES models(id)`
- `serial_number` bleibt (für Nicht-Kassen)
- DROP TABLE `device_movements` (ersetzt durch `purchases`/`sales`-Historie)

### Migration 005_rls_policies_v2.sql

RLS-Policies auf alle neuen Tabellen analog zum Muster in `002_rls_policies.sql`:
- SELECT für authentifizierte User
- INSERT/UPDATE für Rolle `mitarbeiter` und `admin`
- DELETE nur für `admin`

---

## Technologie-Stack

Unverändert zum v1-Design. Keine neuen Dependencies nötig — Dashboard-Charts mit bestehendem `recharts` (falls im Projekt) oder `chart.js`, je nachdem was schon eingebunden ist. Wird im Implementierungsplan geprüft.

---

## Out of Scope (v2)

- MwSt/Buchhaltung (keine MwSt pro Position, kein Datev-Export)
- Gutschriften, Rabatte, Teilzahlungen
- Detail-Tabellen für andere Kategorien als Kassen (Drucker, Scanner etc. nutzen generisches `serial_number`) — können später als eigene Migration nachgezogen werden
- Materialized Views (erst bei Performance-Problemen)
- Bulk-Import (CSV-Upload von Altdaten)
- Historien-Tracking von Preisänderungen (aktuelle Preise = Beleg-Preise, unveränderlich)
