# Warenwirtschaftssystem — Design Spec
**Datum:** 2026-04-19  
**Status:** Approved  
**Autor:** ennurkara

---

## Überblick

Ein internes Warenwirtschaftssystem zur Verwaltung von Firmen-Endgeräten (Registrierkassen, Drucker, Scanner, Kabel, etc.). Mitarbeiter können Geräte per Foto-OCR erfassen, Entnahmen und Einlagerungen protokollieren, und einen KI-Chatbot befragen, um jederzeit den aktuellen Lagerstand zu kennen.

**Nutzer:** 1 Admin + 5 Mitarbeiter  
**Zugang:** Cloud (Browser, responsive, von überall)

---

## Architektur

```
┌─────────────────────────────────────────────────────────┐
│                    BENUTZER (Browser)                    │
│              Next.js App (Netlify)                       │
│   Inventar-Liste │ Gerät hinzufügen │ Chatbot │ Auth     │
└──────────┬───────────────┬──────────────┬───────────────┘
           │               │              │
           ▼               ▼              ▼
    ┌─────────────┐  ┌──────────┐  ┌──────────────────┐
    │  Supabase   │  │  n8n     │  │  n8n             │
    │  Datenbank  │  │  OCR     │  │  Chatbot         │
    │  + Auth     │  │  Workflow│  │  Workflow        │
    │  + Storage  │  │          │  │  (GPT-4o)        │
    └─────────────┘  └──────────┘  └──────────────────┘
                          │
                    OpenAI Vision API
                    (Foto → Seriennummer)
```

### Komponenten

| Komponente | Zweck | Hosting |
|---|---|---|
| Next.js | Web-Frontend (UI, Routing, API calls) | Netlify |
| Supabase | PostgreSQL Datenbank, Auth, Dateispeicher | Supabase Cloud |
| n8n | OCR-Workflow + Chatbot-Workflow | Self-hosted (bestehend) |
| OpenAI | Vision API (OCR) + GPT-4o (Chatbot) | OpenAI Cloud |

---

## Datenbankschema (Supabase / PostgreSQL)

```sql
-- Benutzerprofile (Erweiterung von Supabase Auth)
profiles
  id          uuid PRIMARY KEY (FK → auth.users)
  full_name   text NOT NULL
  role        enum('admin', 'mitarbeiter', 'viewer') DEFAULT 'viewer'
  created_at  timestamptz DEFAULT now()

-- Gerätekategorien
categories
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
  name        text NOT NULL UNIQUE   -- z.B. "Registrierkasse", "Drucker"
  icon        text                   -- Icon-Name für UI
  created_at  timestamptz DEFAULT now()

-- Endgeräte / Inventar
devices
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  name          text NOT NULL
  category_id   uuid NOT NULL REFERENCES categories(id)
  serial_number text
  condition     enum('neu', 'gebraucht') NOT NULL
  status        enum('lager', 'im_einsatz', 'defekt', 'ausgemustert') DEFAULT 'lager'
  quantity      integer NOT NULL DEFAULT 1
  location      text                   -- z.B. "Lager Raum 2, Regal B3"
  photo_url     text                   -- Supabase Storage URL
  notes         text
  created_at    timestamptz DEFAULT now()
  updated_at    timestamptz DEFAULT now()

-- Bewegungshistorie
device_movements
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
  device_id   uuid NOT NULL REFERENCES devices(id)
  user_id     uuid NOT NULL REFERENCES profiles(id)
  action      enum('entnahme', 'einlagerung', 'defekt_gemeldet') NOT NULL
  quantity    integer NOT NULL DEFAULT 1
  note        text
  created_at  timestamptz DEFAULT now()
```

**Designentscheidungen:**
- `devices.quantity` spiegelt immer den aktuellen Lagerbestand wider
- Jede Bewegung wird in `device_movements` geloggt — ermöglicht Chatbot-Antworten wie "Wer hat letzte Woche was entnommen?"
- `condition` trennt Neu- und Gebrauchtware
- `status` trackt den Gerätelebenszyklus von Lager bis Ausmusterung

---

## n8n Workflows

### Workflow 1: Foto-OCR

**Trigger:** `POST /webhook/ocr`  
**Input:** `{ image: "<base64>" }`  
**Output:** `{ name, serial_number, manufacturer }`

```
Webhook → OpenAI Vision API → JSON parsen → Response
```

**System-Prompt für Vision API:**
> "Analysiere dieses Bild eines Geräts oder Etiketts. Extrahiere: Produktname, Seriennummer, Hersteller. Antworte ausschließlich als JSON: { name, serial_number, manufacturer }. Falls ein Feld nicht erkennbar ist, setze null."

**Verhalten im Frontend:** Formular wird mit extrahierten Werten vorausgefüllt. Nutzer prüft, korrigiert bei Bedarf, und bestätigt. Erst dann wird in Supabase gespeichert.

---

### Workflow 2: Chatbot

**Trigger:** `POST /webhook/chat`  
**Input:** `{ message: "Wie viele Drucker haben wir?" }`  
**Output:** `{ reply: "Ihr habt aktuell 3 Drucker im Lager..." }`

```
Webhook → Supabase Query → GPT-4o mit Kontext → Response
```

**Ablauf:**
1. n8n empfängt die Nutzerfrage
2. Supabase-Node lädt aktuellen Inventarstand (devices + categories + letzte Bewegungen)
3. GPT-4o erhält Inventardaten als Kontext + die Nutzerfrage
4. Antwort wird zurückgegeben

**Beispiel-Fragen:**
- "Wie viele Geräte haben wir insgesamt?"
- "Zeig mir alle gebrauchten Scanner im Lager"
- "Was wurde diese Woche entnommen?"
- "Haben wir noch Kabel auf Lager?"
- "Welche Geräte sind defekt?"

---

## Frontend (Next.js auf Netlify)

### Seiten

| Route | Beschreibung | Rollen |
|---|---|---|
| `/login` | Email/Passwort Login via Supabase Auth | alle |
| `/dashboard` | Übersicht: Gesamtbestand, letzte Bewegungen | alle |
| `/inventory` | Inventarliste mit Filter & Suche | alle |
| `/inventory/[id]` | Gerätedetail: Foto, Historie, Bearbeiten | alle (Bearbeiten: Admin) |
| `/inventory/new` | Neues Gerät hinzufügen (manuell oder Foto-OCR) | Admin, Mitarbeiter |
| `/movements` | Bewegungshistorie (Entnahmen, Einlagerungen) | alle |
| `/chat` | Chatbot-Interface | alle |
| `/admin/users` | Benutzerverwaltung | Admin |
| `/admin/categories` | Kategorien verwalten | Admin |

### Rollen & Berechtigungen

| Aktion | Admin | Mitarbeiter | Viewer |
|---|---|---|---|
| Geräte ansehen | ✅ | ✅ | ✅ |
| Chatbot nutzen | ✅ | ✅ | ✅ |
| Gerät hinzufügen | ✅ | ✅ | ❌ |
| Entnahme/Einlagerung buchen | ✅ | ✅ | ❌ |
| Gerät bearbeiten | ✅ | ❌ | ❌ |
| Gerät löschen | ✅ | ❌ | ❌ |
| Benutzer verwalten | ✅ | ❌ | ❌ |

### Key UI-Features
- **Foto-OCR Upload** auf `/inventory/new`: Kamera oder Datei → OCR füllt Formular vor
- **Schnell-Entnahme**: Gerät suchen → Menge eingeben → 1 Klick entnehmen
- **Live-Suche** in der Inventarliste (nach Name, Seriennummer, Kategorie)
- **Chatbot-Button** als floating Element auf jeder Seite verfügbar
- **Responsive Design** — vollständig mobil nutzbar (Smartphone im Lager)

---

## Technologie-Stack

| Layer | Technologie |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| UI-Komponenten | shadcn/ui |
| Auth | Supabase Auth (Email/Passwort) |
| Datenbank | Supabase (PostgreSQL) |
| Datei-Storage | Supabase Storage |
| Hosting | Netlify |
| Automation | n8n (self-hosted) |
| KI/OCR | OpenAI Vision API (gpt-4o) |
| Chatbot | OpenAI GPT-4o via n8n |

---

## Datenschutz & Sicherheit
- Alle Daten bleiben in Supabase (EU-Region wählbar)
- Supabase Row Level Security (RLS) erzwingt Rollen auf Datenbankebene
- API-Keys (OpenAI, Supabase) nur als Umgebungsvariablen in n8n und Netlify
- Fotos werden in privatem Supabase Storage Bucket gespeichert (kein öffentlicher Zugriff)
- n8n Webhooks mit Secret-Token absichern
