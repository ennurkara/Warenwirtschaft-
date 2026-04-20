# Arbeitsbericht App — Design Spec
**Datum:** 2026-04-20  
**Status:** Approved  
**Domain:** arbeitsbericht.ennurkara.cloud

---

## Überblick

Separate Next.js-Webanwendung für die digitale Erstellung und Verwaltung von Arbeitsberichten. Techniker füllen den Bericht auf dem Tablet beim Kunden aus, beide Parteien unterschreiben digital, und das System generiert automatisch ein PDF.

Die App teilt sich die Supabase-Instanz mit der Warenwirtschaft (gleiche DB, gleiche Auth-Benutzer), ist aber eine eigenständige Deployment-Einheit auf einer separaten Domain.

---

## Architektur

### Stack
- **Next.js 14** App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Supabase** (gleiche Instanz wie Warenwirtschaft): Auth + PostgreSQL
- **html2canvas + jsPDF**: Client-seitige PDF-Generierung
- **react-signature-canvas**: Unterschriften-Pads

### Deployment
- **Lokal:** `/Users/ennurkara/Projekte/arbeitsbericht/`
- **VPS:** `/docker/arbeitsbericht/`
- **Domain:** `arbeitsbericht.ennurkara.cloud` via Traefik
- **Docker-Netzwerk:** `n8n_web` (geteilt mit Warenwirtschaft + Supabase)
- **Env-Vars:** gleiche `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Supabase-Zugriff
- `devices`-Tabelle: read-only (aus Warenwirtschaft)
- `profiles`-Tabelle: read-only (bestehende Auth-Benutzer)
- `customers`, `work_reports`, `work_report_devices`: neue Tabellen, in gleicher DB

---

## Datenbankschema

### Neue Tabellen

#### `customers`
```sql
CREATE TABLE customers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  address     text,
  city        text,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

#### `work_reports`
```sql
CREATE TYPE work_report_status AS ENUM ('entwurf', 'abgeschlossen');

CREATE TABLE work_reports (
  id                    uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number         text                UNIQUE, -- auto: "AB-2026-0001"
  customer_id           uuid                NOT NULL REFERENCES customers(id),
  technician_id         uuid                NOT NULL REFERENCES profiles(id),
  description           text                NOT NULL,       -- Ausgeführte Tätigkeit
  work_hours            numeric(5,2)        NOT NULL,       -- Arbeitsaufwand
  travel_from           text,                               -- Anfahrt von
  travel_to             text,                               -- Anfahrt bis
  start_time            timestamptz         NOT NULL,
  end_time              timestamptz,
  status                work_report_status  NOT NULL DEFAULT 'entwurf',
  technician_signature  text,                               -- base64 data URL
  customer_signature    text,                               -- base64 data URL
  completed_at          timestamptz,
  created_at            timestamptz         NOT NULL DEFAULT now(),
  updated_at            timestamptz         NOT NULL DEFAULT now()
);
```

#### `work_report_devices` (Junction)
```sql
CREATE TABLE work_report_devices (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_report_id  uuid        NOT NULL REFERENCES work_reports(id) ON DELETE CASCADE,
  device_id       uuid        NOT NULL REFERENCES devices(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(work_report_id, device_id)
);
```

### Automatik beim Abschließen
Wenn `status` auf `abgeschlossen` gesetzt wird:
1. Alle verknüpften Geräte (`work_report_devices`) → `devices.status = 'im_einsatz'`
2. Je Gerät: neuer Eintrag in `device_movements` mit `action = 'entnahme'`, `user_id = technician_id`
3. `work_reports.completed_at = now()`
4. Fortlaufende `report_number` generieren (Datenbankfunktion)

### RLS-Policies
- `customers`: Alle authentifizierten Benutzer lesen; `mitarbeiter` + `admin` erstellen/bearbeiten
- `work_reports`: Techniker sieht nur eigene Berichte (`technician_id = auth.uid()`); Admin sieht alle; `viewer` read-only
- `work_report_devices`: Folgt den Rechten des zugehörigen `work_report`

### Migrations
```
supabase/migrations/003_work_reports.sql      — Tabellen, Enums, Trigger, Funktion für report_number
supabase/migrations/004_work_reports_rls.sql  — RLS-Policies
```

---

## Wizard-Formular (5 Schritte)

Tablet-optimierter Schritt-für-Schritt-Ablauf. Jeder Schritt wird beim Verlassen automatisch als Entwurf gespeichert.

### Schritt 1 — Kundendaten
- Suchfeld + Dropdown: Kunde aus `customers`-Tabelle auswählen
- Button „Neuen Kunden anlegen" → Inline-Mini-Form: Name (Pflicht), Adresse, PLZ/Ort, Telefon

### Schritt 2 — Ausgeführte Tätigkeit
- Großes Textarea-Feld (Pflichtfeld)

### Schritt 3 — Installierte Geräte
- Suchfeld: Geräte nach Name oder Seriennummer filtern
- Geräteliste aus Inventar (nur `status = 'lager'`)
- Mehrfachauswahl, Anzeige: Kategorie-Icon + Name + Seriennummer
- Ausgewählte Geräte als Badges angezeigt

### Schritt 4 — Aufwand & Anfahrt
- Startdatum + Uhrzeit (vorausgefüllt: aktueller Zeitpunkt)
- Enduhrzeit
- Arbeitsstunden (auto-berechnet aus Start/Ende, manuell überschreibbar)
- Anfahrt von (Freitext)
- Anfahrt bis (Freitext)

### Schritt 5 — Unterschriften
- Signature-Pad: Techniker unterschreibt (Name vorgeblendet)
- Signature-Pad: Kunde unterschreibt
- Button „**Fertigstellen & PDF erstellen**"
  - Speichert Bericht als `abgeschlossen`
  - Bucht Geräte aus (Status + Bewegungen)
  - Generiert PDF → automatischer Download

### Entwurf-Verhalten
- Bericht wird beim Anlegen sofort mit `status = 'entwurf'` gespeichert
- Jeder Schritt speichert Änderungen beim Weiterklicken
- Entwürfe erscheinen in der Berichtsliste als „In Bearbeitung"
- Entwurf kann zu einem späteren Zeitpunkt weiterbearbeitet werden

---

## PDF-Layout (Option B: Modern mit Tabelle)

Client-seitige Generierung via `html2canvas` + `jsPDF`.

### Aufbau
```
┌─────────────────────────────────────────────────────┐
│ [Blauer Header]  ARBEITSBERICHT    Nr. AB-2026-0001  │
│                                    20.04.2026         │
├──────────────────────┬──────────────────────────────┤
│ KUNDE                │ TECHNIKER                     │
│ Max Mustermann       │ Klaus Weber                   │
│ Musterstr. 12        │ 9,5h | Berlin → München       │
│ 12345 Berlin         │ 08:00 – 17:30 Uhr             │
├─────────────────────────────────────────────────────┤
│ AUSGEFÜHRTE TÄTIGKEIT                               │
│ Installation und Konfiguration der Kassensysteme... │
├─────────────────────────────────────────────────────┤
│ INSTALLIERTE GERÄTE                                 │
│ Gerät              │ Seriennummer                   │
│ Registrierkasse    │ ABC123                         │
│ Drucker            │ XYZ789                         │
├─────────────────────────────────────────────────────┤
│ [Unterschrift Techniker] │ [Unterschrift Kunde]      │
│ Klaus Weber              │ Max Mustermann            │
└─────────────────────────────────────────────────────┘
```

- Firmenlogo + Name: Placeholder, wird später aus Konfigurationsdatei geladen
- Unterschriften werden als base64-Canvas-Bild direkt ins Template eingebettet
- Versteckte `pdf-template`-Komponente im DOM, nicht sichtbar für Benutzer

---

## Dateistruktur

```
arbeitsbericht/
├── app/
│   ├── (auth)/login/page.tsx
│   └── (protected)/
│       ├── layout.tsx
│       ├── dashboard/page.tsx         — Eigene Berichte, Schnellzugriff
│       └── arbeitsberichte/
│           ├── page.tsx               — Berichtsliste
│           ├── neu/page.tsx           — Neuer Bericht (Wizard)
│           └── [id]/page.tsx          — Ansicht / Weiterbearbeiten
├── components/
│   ├── ui/                            — shadcn/ui (kopiert von Warenwirtschaft)
│   ├── layout/
│   │   └── navbar.tsx
│   └── arbeitsberichte/
│       ├── wizard.tsx                 — Wizard-Container + Navigation
│       ├── step-kunde.tsx
│       ├── step-taetigkeit.tsx
│       ├── step-geraete.tsx
│       ├── step-aufwand.tsx
│       ├── step-unterschriften.tsx
│       ├── pdf-template.tsx           — Verstecktes PDF-HTML-Template
│       ├── pdf-export.ts              — html2canvas + jsPDF Logik
│       └── report-list.tsx
├── lib/
│   ├── types.ts
│   ├── utils.ts
│   └── supabase/
│       ├── server.ts
│       └── client.ts
├── supabase/
│   └── migrations/
│       ├── 003_work_reports.sql
│       └── 004_work_reports_rls.sql
└── middleware.ts
```

---

## Navigation & Rollen

| Feature                        | Admin | Mitarbeiter | Viewer |
|-------------------------------|-------|-------------|--------|
| Berichte lesen (eigene)       | ✓     | ✓           | ✓      |
| Alle Berichte lesen           | ✓     | ✗           | ✗      |
| Bericht erstellen             | ✓     | ✓           | ✗      |
| Bericht abschließen           | ✓     | ✓           | ✗      |
| Kunden anlegen                | ✓     | ✓           | ✗      |

---

## Neue Dependencies

```json
"react-signature-canvas": "^1.0.6",
"html2canvas": "^1.4.1",
"jspdf": "^2.5.1"
```

---

## Offene Punkte

- Firmenlogo + Name: Wird nachträglich über eine Konfigurationsdatei oder Env-Variable eingebunden
- E-Mail-Versand des PDFs an Kunden: Out of scope für Phase 1
