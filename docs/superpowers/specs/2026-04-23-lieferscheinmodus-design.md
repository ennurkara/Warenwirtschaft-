# Lieferscheinmodus — Design

**Status:** Draft, awaiting user review
**Date:** 2026-04-23
**Branch:** `feat/warenwirtschaft-v2`
**Companion plan:** TBD (`docs/superpowers/plans/2026-04-23-lieferscheinmodus-plan.md`)

## Goal

Erweiterung des Warenwirtschaftssystems um einen **Lieferscheinmodus**: Ein Nutzer lädt ein Foto oder PDF eines eingegangenen Lieferscheins hoch und erhält eine vorausgefüllte Review-Tabelle mit allen Positionen. Nach Korrektur/Ergänzung werden die Geräte samt Einkaufsbeleg atomar angelegt — ein Lieferschein = 1 `purchase` + N `devices` + N `purchase_items`.

Bestehender Einzelgeräte-Flow (`/inventory/new` mit Einzel-Etikett-OCR via Mistral) bleibt unverändert.

## Current State

Heute existiert:
- `POST /api/ocr` — Mistral OCR + GPT-4o-mini Structuring, extrahiert **ein** Gerät (`name`, `serial_number`, `manufacturer`) aus einem Einzel-Etikett-Foto.
- `components/inventory/ocr-upload.tsx` — Foto-/Kamera-Upload, callback mit dem Einzel-Ergebnis.
- `app/(protected)/inventory/new/page.tsx` — nutzt das OCR-Ergebnis nur für `serial_number`-Prefill eines manuellen `DeviceForm`-Dialogs (name + manufacturer werden verworfen).
- `device-form.tsx` — führt clientseitige Sequenz aus: `devices.insert` → `vectron_details.insert` (falls Kassenhardware+Vectron) → `purchases`-Dedup per `(supplier_id, datum, rechnungsnr)` → `purchase_items.insert`. Keine Transaktion, keine Rollback-Semantik.

**Was fehlt für den Lieferschein-Use-Case:**
- Mehrere Geräte pro OCR-Call (API-Schema ist singular).
- Kein Lieferant-Extract im OCR.
- Kein Bulk-Review-UI.
- Kein atomares Bulk-Insert.
- Kein persistierter Original-Lieferschein für den Audit-Trail.

## Scope & Non-Goals

### In Scope
- Upload von Bild (`image/jpeg`, `image/png`) oder PDF (`application/pdf`) für Lieferscheine bis 10 MB, PDF bis 5 Seiten.
- GPT-4o-mini Vision Call mit Structured Output (JSON Schema, `strict: true`) extrahiert Supplier + Rechnungsnr + Datum + Items-Array.
- Split-View Review-UI mit Original-Preview links und editierbarer Item-Tabelle rechts.
- Inline-„Neu anlegen" für Supplier, Manufacturer, Model (Pattern aus `EntityPicker`).
- Quantity-Expansion: OCR-Item mit `quantity > 1` und leerer SN wird clientseitig in N Zeilen expandiert.
- Atomares Save via Postgres RPC `create_lieferschein(payload jsonb) returns uuid`.
- Persistenter Storage des Original-Dokuments in Supabase Storage Bucket `lieferscheine`, Referenz via neue Spalte `purchases.source_document_path`.
- Cancel-Endpoint, der Storage-File bei nicht abgeschlossener Session löscht.

### Out of Scope (explicit)
- Kein neuer Status-Enum-Wert für SN-lose Geräte — `serial_number` NULL reicht; Dashboard-Filter „Geräte ohne SN" ist Folge-Ticket.
- Keine „SN nachtragen"-UI für bereits angelegte stubless Geräte — Folge-Ticket.
- Keine Purchase-Dedup auf `(supplier_id, datum, rechnungsnr)` im Lieferscheinmodus — jeder Scan = neuer Purchase. Rechtfertigung: YAGNI und vermeidet Fehl-Merges bei zwei echten Lieferungen am selben Tag.
- Keine automatische Kategorie-Erkennung durch OCR. Kategorie kommt entweder aus existierendem Model-Match oder wird pro Zeile vom User gewählt. Rechtfertigung: 21 feste Kategorien mit feinen Unterschieden (Bondrucker vs Kassendrucker) sind unzuverlässig aus Text ableitbar; Model-Match ist deterministisch.
- Keine nightly Storage-Garbage-Collection — Cancel-Endpoint reicht für v1.
- Keine Playwright-E2E-Tests — manuelle Smoke-Checkliste reicht für v1.

## Architecture

```
┌──────────────────────┐
│ /inventory/delivery/ │  Next.js page (protected, role ≠ viewer)
│       new            │
└──────────┬───────────┘
           │ File upload (img or PDF)
           ▼
┌──────────────────────┐
│ /api/lieferschein/ocr│  Server Route (Next.js API)
│                      │
│  1. Upload file →    │  → Supabase Storage bucket `lieferscheine/<uuid>.<ext>`
│  2. GPT-4o-mini      │  → OpenAI (Vision, Structured Output, strict schema)
│     Vision           │
│  3. Return payload   │  → { supplier, rechnungsnr, datum, items[], source_path }
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Review Component    │  Split-View:
│  ┌────────┬───────┐  │    - links: Original-Preview (<img> oder <iframe>)
│  │Original│Review │  │    - rechts: Items-Tabelle + globale Felder (Supplier,
│  └────────┴───────┘  │              Rechnungsnr, Datum)
└──────────┬───────────┘
           │ "Alle speichern"
           ▼
┌──────────────────────┐
│  RPC                 │  Postgres Function (single transaction):
│  create_lieferschein │    1 × purchases, N × devices, N × purchase_items.
│    (payload jsonb)   │  Fehler → komplettes Rollback.
└──────────────────────┘
```

## Components & Files

### New
| Pfad | Aufgabe |
|---|---|
| `app/(protected)/inventory/delivery/new/page.tsx` | Route-Shell, Viewer-Block, State-Machine upload → review → saving |
| `components/delivery/delivery-upload.tsx` | Upload für Bild + PDF, POST zu `/api/lieferschein/ocr` |
| `components/delivery/delivery-review.tsx` | Split-View mit Original-Preview + Items-Tabelle + globalen Feldern |
| `components/delivery/delivery-item-row.tsx` | Eine Tabellen-Zeile: Manufacturer · Model · Category · SN · Standort · EK · Notizen · Löschen |
| `app/api/lieferschein/ocr/route.ts` | POST (Multipart): Upload → Vision → JSON-Response |
| `app/api/lieferschein/ocr/cancel/route.ts` | POST: Storage-File bei abgebrochener Session löschen |
| `supabase/migrations/013_lieferschein.sql` | Migration (siehe unten) |
| `__tests__/api/lieferschein-ocr.test.ts` | Route-Unit-Test mit gemocktem OpenAI + Supabase-Client |
| `__tests__/api/lieferschein-ocr-cancel.test.ts` | Cancel-Endpoint Test |
| `__tests__/components/delivery-item-row.test.tsx` | Row-Edit-Logik-Test |
| `__tests__/components/delivery-review.test.tsx` | Review-UI Test (Quantity-Expansion, Save-Validation, + Zeile, Löschen) |
| `__tests__/db/create_lieferschein.sql` | SQL-Integrationstest für RPC |
| `scripts/test-rpc.sh` | psql-Runner für DB-Tests |

### Modified
| Pfad | Änderung |
|---|---|
| `components/layout/sidebar.tsx` (oder äquivalent) | Menü-Eintrag „Lieferschein scannen" unter Wareneingang |
| `lib/types.ts` | `LieferscheinOcrResponse`, `LieferscheinItem`, `LieferscheinPayload` Types |
| `.env.local.example` | Kommentar: `LIEFERSCHEIN_OCR_MODEL` (default `gpt-4o-mini`, override z.B. `gpt-4o`) |

### Reused / Extended
- `EntityPicker` für Supplier und Manufacturer — erweitert um inline „neu anlegen"-Fallback (falls noch nicht vorhanden). Der Plan-Task prüft den Ist-Zustand und fügt die Fähigkeit ggf. hinzu.
- `ModelPicker` — erweitert um inline „neu anlegen" (gleiche Mechanik wie `EntityPicker`). Scoped bleibt auf Manufacturer+Category.
- `CategoryPicker` — falls keine eigenständige Komponente existiert, wird sie aus `device-form.tsx` extrahiert und wiederverwendet.

## Data Flow

### OCR Request (`POST /api/lieferschein/ocr`)

Request: `multipart/form-data` mit Feld `file` (Blob). Max 10 MB. PDFs werden serverseitig mit `pdfjs-dist` seitenweise zu PNGs gerendert; verarbeitet werden maximal die ersten 5 Seiten (restliche Seiten ignoriert, UI-Warnung).

Server-Ablauf:
1. Auth-Check: Session muss existieren, Role ≠ `viewer`.
2. File-Validation: MIME-Type ∈ {`image/jpeg`, `image/png`, `application/pdf`}, Größe ≤ 10 MB.
3. Upload der Original-Datei in Storage: Pfad `lieferscheine/<iso-date>-<uuid>.<ext>` → `source_document_path`.
4. Build Vision-Payload:
   - Für Bilder: ein `image_url` Message-Part mit signierter Storage-URL (oder data-URL bei kleineren Files).
   - Für PDFs: jede der (max 5) Seiten via `pdfjs-dist` zu PNG gerendert und als separater `image_url` Part angehängt — ein einziger OpenAI-Call mit mehreren Bildern.
5. OpenAI-Call mit JSON-Schema (siehe unten), Structured Output erzwungen.
6. Return:
   ```ts
   {
     supplier: string | null,
     rechnungsnr: string | null,
     datum: string | null,          // ISO YYYY-MM-DD
     source_path: string,
     items: Array<{
       manufacturer: string | null,
       name: string | null,
       serial_number: string | null,
       quantity: number,             // >= 1
       ek_preis: number | null
     }>
   }
   ```

### JSON Schema (OpenAI `response_format`)

```json
{
  "type": "json_schema",
  "json_schema": {
    "name": "Lieferschein",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "supplier":    { "type": ["string","null"] },
        "rechnungsnr": { "type": ["string","null"] },
        "datum":       { "type": ["string","null"], "description": "ISO YYYY-MM-DD" },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "manufacturer":  { "type": ["string","null"] },
              "name":          { "type": ["string","null"] },
              "serial_number": { "type": ["string","null"] },
              "quantity":      { "type": "integer", "minimum": 1 },
              "ek_preis":      { "type": ["number","null"] }
            },
            "required": ["manufacturer","name","serial_number","quantity","ek_preis"],
            "additionalProperties": false
          }
        }
      },
      "required": ["supplier","rechnungsnr","datum","items"],
      "additionalProperties": false
    }
  }
}
```

### System Prompt (Vision)

Der Systemprompt erzwingt:
- Kanonische Hersteller-Namen ohne Rechtsform (wie im bestehenden `/api/ocr` Prompt).
- Modellbezeichnung ohne Hersteller-Präfix.
- `serial_number` nur aus Geräte-SNs, nicht aus Rechnungsnummern oder Paket-Tracking-Nummern.
- `quantity`: Anzahl des gleichen Artikels auf der Zeile (Default 1).
- `ek_preis`: Netto-Stückpreis wenn erkennbar, sonst null.
- `datum`: Lieferdatum oder Rechnungsdatum (bevorzugt Rechnungsdatum wenn beide vorhanden).
- Alle Werte strikt aus dem Dokument, keine Ratungen.

Konkrete Prompt-Wortlaute werden beim Implementieren finalisiert und durchlaufen dieselbe Überarbeitung wie die aktuellen Chatbot-/OCR-Prompts.

### Quantity-Expansion im Client

```
item: { manufacturer: "Epson", name: "TM-T88VI", serial_number: null, quantity: 5 }
  → [Row, Row, Row, Row, Row] (jede leer SN, gleicher Rest)

item: { manufacturer: "Epson", name: "TM-T88VI", serial_number: "SN12345", quantity: 1 }
  → [Row] (unverändert)

item: { ..., serial_number: "SN12345", quantity: 3 }
  → [Row] (nur eine Zeile; quantity>1 mit SN ist unplausibel, wird nicht gesplittet)
```

### Model-Match Heuristik (clientseitig, bei Review-Render)

Für jedes OCR-Item:
1. Wenn `manufacturer` + `name` gesetzt: suche `models` mit exaktem Match auf (`manufacturer.name`, `modellname`), case-insensitive.
2. Bei Treffer: `model_id` vorgewählt, `category_id` aus dem Model übernommen, beide Pickers locked-in aber editierbar.
3. Bei keinem Treffer: Manufacturer-Picker zeigt OCR-Value als Hint + „neu anlegen"-Button, Model + Category bleiben leer.

Die Query läuft einmal beim Mounten des Review-Components (`select id, modellname, category_id, manufacturer:manufacturers(name) from models`) — es gibt keine hohen Volumen, kein Perf-Problem.

### Save Flow

1. Client validiert pro Zeile: `model_id` required, sonst Row rot und Save blockiert.
2. Client validiert global: `supplier_id` required.
3. `supabase.rpc('create_lieferschein', { payload })` mit:
   ```ts
   {
     supplier_id: uuid,
     rechnungsnr: string | null,
     datum: 'YYYY-MM-DD',
     source_document_path: string,
     items: Array<{
       model_id: uuid,
       serial_number: string | null,
       location: string | null,
       notes: string | null,
       ek_preis: number | null
     }>
   }
   ```
4. Bei Erfolg: Toast + Redirect `/inventory?purchase=<id>`.
5. Bei Postgres-Error `23505` (unique violation auf `devices.serial_number`): parse constraint-name, markiere betroffene Row rot, Toast „SN X existiert bereits", Transaktion ist schon rolled back.

## DB Migration (`013_lieferschein.sql`)

```sql
-- 1. Source-Doc-Reference auf purchases
alter table purchases add column source_document_path text;

-- 2. Storage Bucket (private)
insert into storage.buckets (id, name, public)
values ('lieferscheine', 'lieferscheine', false)
on conflict (id) do nothing;

-- 3. RLS auf Storage: authenticated non-viewer darf read + write
create policy "lieferscheine_read_nonviewer"
  on storage.objects for select
  using (bucket_id = 'lieferscheine' and exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role <> 'viewer'
  ));

create policy "lieferscheine_write_nonviewer"
  on storage.objects for insert
  with check (bucket_id = 'lieferscheine' and exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role <> 'viewer'
  ));

create policy "lieferscheine_delete_nonviewer"
  on storage.objects for delete
  using (bucket_id = 'lieferscheine' and exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role <> 'viewer'
  ));

-- 4. RPC für atomares Create
create or replace function create_lieferschein(payload jsonb)
returns uuid
language plpgsql
security invoker  -- respektiert RLS des Aufrufers
as $$
declare
  v_purchase_id uuid;
  v_device_id uuid;
  v_item jsonb;
begin
  insert into purchases (supplier_id, rechnungsnr, datum, source_document_path)
  values (
    (payload->>'supplier_id')::uuid,
    payload->>'rechnungsnr',
    (payload->>'datum')::date,
    payload->>'source_document_path'
  )
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(payload->'items')
  loop
    insert into devices (model_id, serial_number, status, location, notes)
    values (
      (v_item->>'model_id')::uuid,
      nullif(v_item->>'serial_number',''),
      'lager',
      nullif(v_item->>'location',''),
      nullif(v_item->>'notes','')
    )
    returning id into v_device_id;

    if (v_item->>'ek_preis') is not null and (v_item->>'ek_preis') <> '' then
      insert into purchase_items (purchase_id, device_id, ek_preis)
      values (v_purchase_id, v_device_id, (v_item->>'ek_preis')::numeric);
    end if;
  end loop;

  return v_purchase_id;
end;
$$;
```

**Hinweis:** Die RPC nimmt bewusst keine Dedup auf `purchases` vor. Unique-Violation auf `devices.serial_number` rollbackt die gesamte Transaktion (erwartetes Verhalten — siehe Error Handling).

## Error Handling

### OCR-Stufe
| Fehlerfall | Verhalten |
|---|---|
| Upload fails (Netzwerk, >10 MB) | HTTP 4xx mit klarer Message, kein Storage-Leak (Upload erst bei validiertem Call) |
| OpenAI 429/500/timeout | HTTP 502, Toast „OCR-Service nicht erreichbar" + Link „Ohne OCR eingeben" (→ bestehende `/inventory/new`) |
| Schema-Parse fail (dürfte bei `strict: true` nicht passieren) | Treat as `items: []`, leere Review-UI mit manuellem `+ Zeile`-Button |
| `items: []` | Leere Review-Tabelle + Hinweis „Keine Positionen erkannt. Manuell hinzufügen oder Original prüfen." |
| PDF > 5 Seiten | Server verarbeitet nur erste 5, UI-Warnung im Review-Header |

### Review-Stufe (Client)
| Fehlerfall | Verhalten |
|---|---|
| Save ohne `model_id` in Zeile | Row rot, Toast „Zeile N: Modell fehlt", kein RPC-Call |
| Save ohne globalen `supplier_id` | Toast „Lieferant wählen", kein RPC-Call |
| OCR-Supplier nicht in DB | EntityPicker zeigt OCR-Value als gelben Hint + „'Quad GmbH' neu anlegen"; inline-Create via bestehende Mutation, Picker selected neu angelegten Eintrag |
| User schließt Tab nach OCR ohne Save | `beforeunload` + `navigator.sendBeacon('/api/lieferschein/ocr/cancel', { source_path })` → Server löscht Storage-File. Best-effort, kein Hard Fail |

### Save-Stufe (RPC)
| Fehlerfall | Verhalten |
|---|---|
| Unique-Violation SN (`23505`) | Rollback, Client parsed Error, markiert Row rot, Toast „SN X existiert bereits" |
| FK-Violation (model_id) | Rollback, generischer Toast |
| Network-Fail mid-call | Kein automatisches Retry (Idempotency-Key nicht implementiert — YAGNI). Toast + manuelles Retry durch User |

### Logging
Nur `console.error` in API-Route bei OpenAI-Fehlern (mit `source_path` + User-ID, **ohne** Bildinhalt oder PII).

## Testing

### Jest
- `lieferschein-ocr.test.ts` — Mock OpenAI + Mock Supabase Storage. Cases: valides Bild → korrekte Response, OpenAI-Fehler → 502, keine Datei → 400, Datei >10 MB → 413.
- `lieferschein-ocr-cancel.test.ts` — Cancel-Endpoint löscht Storage-File.
- `delivery-item-row.test.tsx` — Manufacturer-Change resettet Model; Model-Select füllt Category; SN-Input.
- `delivery-review.test.tsx` — Quantity-Expansion, `+ Zeile`/Löschen, Save-Validation.

### SQL (`__tests__/db/create_lieferschein.sql`)
- Setup: test supplier, test manufacturer, test model, test category.
- Happy path: 2 items → 1 purchase + 2 devices + 2 purchase_items.
- Rollback path: Duplikat-SN → keine Datensätze entstanden (alles rolled back).
- Partial-price: 2 items, eins ohne `ek_preis` → nur 1 purchase_item.

Runner: `scripts/test-rpc.sh` gegen lokale DB; optional in CI; dokumentiert im README.

### Manuelle Smoke-Checkliste (Pre-Deploy)
- [ ] JPG mit klaren Items → alle Picker vorbelegbar
- [ ] PDF 1-seitig → korrekt erkannt
- [ ] PDF 3-seitig → Items aller Seiten extrahiert
- [ ] Item mit `quantity: 3` ohne SN → 3 Zeilen expandiert
- [ ] Neuer Lieferant inline anlegen
- [ ] Neues Modell inline anlegen
- [ ] SN-Duplikat → Row markiert, keine Purchase entstanden
- [ ] Original-Preview funktioniert für Bild + PDF
- [ ] Save-Erfolg: Redirect nach `/inventory?purchase=<id>` zeigt neue Geräte

### Bewusst nicht getestet
- GPT-4o-mini Output-Qualität (nicht deterministisch; Acceptance: „korrekt bei 80% typischer Slips", manuell validiert)
- Storage-RLS im Unit-Test (einmal manuell via `curl` verifiziert)
- Playwright-E2E (Plugin vorhanden, aber Setup-Overhead zu hoch für v1)

## Acceptance Criteria

1. `/inventory/delivery/new` ist erreichbar für authenticated non-viewer.
2. Upload eines Bildes oder PDFs führt zu einer Review-Tabelle mit mindestens den erkannten Items.
3. OCR-Felder (`supplier`, `rechnungsnr`, `datum`, pro Item `manufacturer`, `name`, `serial_number`, `ek_preis`) werden als Prefill übernommen.
4. Modelle, die per `(manufacturer.name, modellname)` Match existieren, füllen automatisch `model_id` und `category_id`.
5. Zeilen ohne gefundenes Model zeigen inline „neu anlegen"-Option für Manufacturer und Model.
6. Klick „Alle speichern" führt zu genau einem `purchases`-Insert, N `devices`-Inserts, K `purchase_items`-Inserts (K = Anzahl Items mit `ek_preis`), in einer einzelnen Postgres-Transaktion.
7. Bei Fehler (z.B. Duplikat-SN) wird **kein** Datensatz persistiert und der User sieht eine klare Fehlermeldung inklusive der betroffenen Zeile.
8. Original-Dokument ist nach Save im Storage abrufbar und in `purchases.source_document_path` verlinkt.
9. Abbruch (Tab schließen) löscht die Upload-Datei aus dem Storage (best-effort).

## Open Questions

Keine offenen Fragen — alle Architektur-Entscheidungen im Brainstorming geklärt. Details zu Prompt-Wortlaut, Picker-Inline-Create-Mechanik und PDF-Page-Extraction werden im Implementierungsplan pro Task präzisiert.
