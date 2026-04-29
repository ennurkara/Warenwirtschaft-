# Portal-Sync Automation — Vectron + APRO

## Ziel
Wöchentlicher Headless-Sync (Mo + Do) beider Portale. Cron erstellt Diff-Report als GH Issue. Import läuft erst nach manueller Freigabe.

## Entscheidungen
- **Approval-Mechanik:** Variante 1 — GH Environment Protection. Issue enthält Approval-Link → ein Klick im Run (Desktop ODER GH Mobile App) → Job B startet
- **Approval-Timeout:** 30 Tage (GH-Default, max. konfigurierbar)
- **Cron:** `0 6 * * 1` UTC = Montag 8 Uhr lokal Sommer / 7 Uhr lokal Winter
- **Tool:** Playwright (nicht Firecrawl — wegen Token-Interception, In-Browser-API-Calls, kostenfrei in Actions)
- **Issue-Repo:** dieses Repo (`warenwirtschaft`), Label `sync-pending`

## Datenfluss
```
Cron / workflow_dispatch
  │
  ▼
Job A: scrape-and-report (auto)
  ├─ scripts/scrape-vectron.mjs  → data/vectron-operators/cash_registers_full.csv
  ├─ scripts/scrape-apro.mjs     → data/apro-licenses/apro_full.json
  ├─ scripts/sync-report.mjs     → report.md (Diff gegen Prod-DB read-only)
  ├─ Diff > 0 → gh issue create (Body = report.md, Label = sync-pending)
  └─ Upload Artifact "scraped-data" (90 Tage)
  │
  ▼ (User klickt Approval-Link im Issue)
Job B: import (gated by environment `portal-imports`)
  ├─ Download Artifact
  ├─ scripts/import-vectron.mjs  (existiert)
  ├─ scripts/import-apro.mjs     (existiert)
  ├─ gh issue comment (Import-Stats)
  └─ gh issue close
```

## Phase 1 — Scrape-Skripte produktionsfähig machen

Die Scrape-Logik existiert nur als Ad-hoc-Sessions aus der Vergangenheit. Das ist die echte Arbeit dieses Projekts.

### 1.1 `scripts/scrape-vectron.mjs`
- [ ] Headless Playwright (Chromium), Login mit `VECTRON_USER` / `VECTRON_PASS`
- [ ] `x-api-token` aus Network-Response der Login-Sequenz extrahieren
- [ ] Operator-Liste via Authenticated API (alle, nicht nur active)
- [ ] Pro Operator: `POST /login-api/grant` für per-Operator `x-authorization-token`
- [ ] Status-Monitor: `/partner-api/v1/service-partner/<UUID>/cash-register-states?pageSize=10000` (Brand/Type/Version/OS)
- [ ] Pro Operator: Filialen + Cash Registers via `page.request.get()` (Browser-Context wegen Thrift-Sequence-IDs)
- [ ] Robust gegen 401 / Token-Expiry (re-grab on retry)
- [ ] Output: `data/vectron-operators/cash_registers_full.csv` + `vectron_export/<operator-id>.json`
- [ ] Stats: N Operator / N Sites / N Devices

### 1.2 `scripts/scrape-apro.mjs`
- [ ] Headless Playwright, Login auf `liveupdate.apro.at` mit `APRO_USER` / `APRO_PASS`
- [ ] Customer-Liste extrahieren
- [ ] Pro Customer: `?userId=X` navigieren, DOMParser-Extraktion im Page-Context
- [ ] Output: `data/apro-licenses/apro_full.json` (Schema kompatibel zu existierendem Format — `{ customers: [{ userId, name, email, street, zip, city, country, licenseKey, licenses: [...] }] }`)
- [ ] Stats: N Customers / N Licenses

### 1.3 Lokal-Verifikation
- [ ] Beide Skripte einmal lokal mit echten Credentials laufen lassen
- [ ] Output-Schema vergleichen mit existierenden Files in `data/`
- [ ] `tsc --noEmit` grün (falls Skripte in TS-Projekt referenziert werden)

## Phase 2 — Diff-Report

### 2.1 `scripts/sync-report.mjs`
- [ ] Liest beide Scrape-Outputs
- [ ] Querteit Prod-DB read-only (Service-Role Key, nur SELECT)
- [ ] **Vectron-Diff:**
  - 🆕 Operator: `vectron_operator_id` im Scrape, nicht in DB
  - 🆕 Sites: `vectron_site_id` im Scrape, nicht in DB
  - 🆕 Devices: `vectron_cash_register_id` im Scrape, nicht in DB
  - ✏️ Status-Wechsel: `operatorContractStillActive` geändert
  - ⚠️ Verschwunden: in DB, nicht mehr im Scrape (Account gelöscht?)
- [ ] **APRO-Diff:**
  - 🆕 Kunden: `apro_customer_id` im Scrape, nicht in DB
  - 🆕 Lizenzen: `(customer_id, model_id)` im Scrape, nicht in DB
  - ✏️ Mengen-Änderung: `quantity` differiert
- [ ] Output: `report.md`. Falls Diff = 0 → Exit-Code so dass Workflow das Issue-Erstellen skippt

### 2.2 Report-Format
```markdown
## Portal-Sync 2026-04-29 06:00 UTC

### Vectron
- 🆕 3 neue Operator
  - Bäckerei Müller (`abc-123`)
  - …
- 🆕 5 neue Filialen · 🆕 12 neue Kassen
- ⚠️ 1 Operator verschwunden: Café X

### APRO
- 🆕 1 neuer Kunde: Müller GmbH (`apro-id 1234`)
- 🆕 8 neue Lizenzen · ✏️ 3 Kunden mit Mengen-Änderung

---
**Approval:** Run #4711 → [Review pending deployments](LINK) → Approve
```

## Phase 3 — GH Actions

### 3.1 `.github/workflows/sync-portals.yml`
- [ ] Trigger: `schedule: cron '0 6 * * 1'` + `workflow_dispatch`
- [ ] **Job A `scrape-and-report`:**
  - Checkout, Node 20, `npm ci`, `npx playwright install chromium`
  - Run scrape-vectron, scrape-apro (Secrets als Env)
  - Run sync-report
  - If diff: `gh issue create --title "Portal-Sync $(date +%Y-%m-%d)" --body-file report.md --label sync-pending`
  - Upload artifact `scraped-data` (retention-days: 90)
- [ ] **Job B `import`:**
  - `needs: scrape-and-report`
  - `environment: portal-imports` (Required Reviewer in GH UI)
  - Download artifact, run import-vectron + import-apro
  - `gh issue comment` mit Import-Stats, `gh issue close`

### 3.2 GH-Repo Setup (manuell)
- [ ] Secrets: `VECTRON_USER`, `VECTRON_PASS`, `APRO_USER`, `APRO_PASS`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Environment `portal-imports` mit Required Reviewer = ennurkara
- [ ] Label `sync-pending` erstellen

## Phase 4 — Verification
- [ ] Workflow manuell via `workflow_dispatch` triggern
- [ ] Issue erscheint mit sinnvollem Diff-Body
- [ ] Approval-Link → Job B startet → Import läuft
- [ ] Stats-Comment auf Issue, Issue closed
- [ ] DB-Stand entspricht Scrape

## Aufwand
- Phase 1: ~1–2 Tage (Auth-Flows sind die Knochenarbeit)
- Phase 2: ~½ Tag
- Phase 3: ~½ Tag
- **Total: ~2–3 Tage**, verteilt über mehrere Sessions

## Open Issues / Risiken
- **Token-Erneuerung in Vectron:** 5min Keycloak-Bearer kann während eines 300-Operator-Loops expiren. Lösung: Re-Auth-Trigger bei 401, sonst alle 4 min proaktiv refreshen
- **APRO Multi-Tab:** Scraper aus alter Session öffnete neue Tabs auf Klick — robuster ist direkte URL-Navigation mit `?userId=` Query-Param ohne Klicks
- **Idempotenz beim Issue-Erstellen:** falls schon ein offenes `sync-pending` Issue existiert, sollte das neue Run das alte ersetzen oder daran kommentieren — nicht anhäufen
