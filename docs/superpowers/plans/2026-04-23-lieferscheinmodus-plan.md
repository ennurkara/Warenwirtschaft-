# Lieferscheinmodus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Lieferscheinmodus that accepts a photo or PDF of a delivery slip, runs GPT-4o-mini Vision with structured output to extract supplier + items, presents a split-view review UI with inline pickers, and atomically persists one `purchases` + N `devices` + N `purchase_items` via a Postgres RPC.

**Architecture:** Server-only OCR (file upload → Supabase Storage bucket `lieferscheine` → OpenAI Vision with JSON Schema) returns a typed payload; client-side split-view Review UI with per-row pickers (Manufacturer / Model / Category) and inline "neu anlegen"; save goes through Postgres RPC `create_lieferschein` in a single transaction.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Storage + Auth), TypeScript, Jest, Tailwind, shadcn/ui, `openai` SDK (existing), `pdf-img-convert` (new, for PDF → PNG conversion, pure JS, zero native deps).

**Spec:** `docs/superpowers/specs/2026-04-23-lieferscheinmodus-design.md`

---

## File Structure

**New:**
- `lib/types.ts` (modified) — add `LieferscheinOcrResponse`, `LieferscheinItem`, `LieferscheinPayload`
- `lib/pdf/render-pages.ts` — PDF → PNG rendering helper, max 5 pages
- `supabase/migrations/013_lieferschein.sql` — `purchases.source_document_path`, Storage bucket + RLS, `create_lieferschein` RPC
- `supabase/scripts/test_create_lieferschein.sql` — SQL integration test
- `app/api/lieferschein/ocr/route.ts` — POST endpoint, upload + Vision call
- `app/api/lieferschein/ocr/cancel/route.ts` — POST endpoint, delete Storage file
- `components/inventory/manufacturer-picker.tsx` — dropdown + inline „+ Neu"
- `components/delivery/delivery-upload.tsx`
- `components/delivery/delivery-item-row.tsx`
- `components/delivery/delivery-review.tsx`
- `app/(protected)/inventory/delivery/new/page.tsx`
- `__tests__/lib/render-pages.test.ts`
- `__tests__/api/lieferschein-ocr.test.ts`
- `__tests__/api/lieferschein-ocr-cancel.test.ts`
- `__tests__/components/manufacturer-picker.test.tsx`
- `__tests__/components/delivery-item-row.test.tsx`
- `__tests__/components/delivery-review.test.tsx`

**Modified:**
- `components/layout/sidebar.tsx` (or equivalent nav) — add "Lieferschein scannen" link
- `.env.local.example` — comment about `LIEFERSCHEIN_OCR_MODEL` override

---

## Task 1: Types and Shared Payload Shapes

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add types**

Append to `lib/types.ts`:

```typescript
// ---------- Lieferscheinmodus ----------
export interface LieferscheinOcrItem {
  manufacturer: string | null
  name: string | null
  serial_number: string | null
  quantity: number
  ek_preis: number | null
}

export interface LieferscheinOcrResponse {
  supplier: string | null
  rechnungsnr: string | null
  datum: string | null            // ISO YYYY-MM-DD
  source_path: string
  items: LieferscheinOcrItem[]
}

export interface LieferscheinRowDraft {
  client_id: string               // React key, not persisted
  manufacturer_id: string | null
  model_id: string | null
  category_id: string | null      // derived from model when possible
  serial_number: string | null
  location: string | null
  notes: string | null
  ek_preis: number | null
  // Prefilled OCR values kept for UI hints when no DB match exists
  ocr_manufacturer: string | null
  ocr_name: string | null
}

export interface LieferscheinRpcPayload {
  supplier_id: string
  rechnungsnr: string | null
  datum: string                   // ISO YYYY-MM-DD
  source_document_path: string
  items: Array<{
    model_id: string
    serial_number: string | null
    location: string | null
    notes: string | null
    ek_preis: number | null
  }>
}
```

- [ ] **Step 2: Verify TypeScript still compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors (only the pre-existing `__tests__/` jest-type errors).

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): add Lieferscheinmodus payload types"
```

---

## Task 2: DB Migration 013 — Storage Bucket + RPC

**Files:**
- Create: `supabase/migrations/013_lieferschein.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/013_lieferschein.sql`:

```sql
-- supabase/migrations/013_lieferschein.sql
--
-- Lieferscheinmodus (Phase 1):
--  - Add `source_document_path` to purchases (FK to Storage object path).
--  - Create `lieferscheine` Storage bucket with non-viewer RLS.
--  - Add RPC create_lieferschein(payload jsonb) for atomic bulk insert
--    of 1 purchase + N devices + N purchase_items in one transaction.
--
-- Idempotent: safe to re-run.

-- 1. Source-Doc-Reference auf purchases
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS source_document_path text;

-- 2. Storage Bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lieferscheine', 'lieferscheine', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS: non-viewer darf read/write/delete im Bucket
DROP POLICY IF EXISTS "lieferscheine_read_nonviewer" ON storage.objects;
CREATE POLICY "lieferscheine_read_nonviewer"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lieferscheine' AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role <> 'viewer'
  ));

DROP POLICY IF EXISTS "lieferscheine_write_nonviewer" ON storage.objects;
CREATE POLICY "lieferscheine_write_nonviewer"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'lieferscheine' AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role <> 'viewer'
  ));

DROP POLICY IF EXISTS "lieferscheine_delete_nonviewer" ON storage.objects;
CREATE POLICY "lieferscheine_delete_nonviewer"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'lieferscheine' AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role <> 'viewer'
  ));

-- 4. RPC für atomares Create
CREATE OR REPLACE FUNCTION create_lieferschein(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_purchase_id uuid;
  v_device_id uuid;
  v_item jsonb;
  v_ek text;
BEGIN
  INSERT INTO purchases (supplier_id, rechnungsnr, datum, source_document_path)
  VALUES (
    (payload->>'supplier_id')::uuid,
    NULLIF(payload->>'rechnungsnr', ''),
    (payload->>'datum')::date,
    NULLIF(payload->>'source_document_path', '')
  )
  RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    INSERT INTO devices (model_id, serial_number, status, location, notes)
    VALUES (
      (v_item->>'model_id')::uuid,
      NULLIF(v_item->>'serial_number', ''),
      'lager',
      NULLIF(v_item->>'location', ''),
      NULLIF(v_item->>'notes', '')
    )
    RETURNING id INTO v_device_id;

    v_ek := v_item->>'ek_preis';
    IF v_ek IS NOT NULL AND v_ek <> '' THEN
      INSERT INTO purchase_items (purchase_id, device_id, ek_preis)
      VALUES (v_purchase_id, v_device_id, v_ek::numeric);
    END IF;
  END LOOP;

  RETURN v_purchase_id;
END;
$$;

-- Grant to authenticated (role check happens via invoker context + RLS)
GRANT EXECUTE ON FUNCTION create_lieferschein(jsonb) TO authenticated;
```

- [ ] **Step 2: Apply migration to local dev DB**

```bash
cd /c/Users/ekara/warenwirtschaft
npx supabase db push --include-all 2>&1 | tail -20
```

Expected: migration `013_lieferschein.sql` applied, no errors.

If the project uses a different migration runner, invoke it accordingly (check `package.json` `scripts` or `supabase/config.toml`).

- [ ] **Step 3: Smoke-test RPC via psql**

```bash
psql "$SUPABASE_DB_URL" -c "SELECT proname FROM pg_proc WHERE proname = 'create_lieferschein';"
```

Expected output: one row `create_lieferschein`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/013_lieferschein.sql
git commit -m "feat(db): migration 013 — lieferscheine storage bucket + create_lieferschein RPC"
```

---

## Task 3: SQL Integration Test for `create_lieferschein`

**Files:**
- Create: `supabase/scripts/test_create_lieferschein.sql`

- [ ] **Step 1: Write the test script**

Create `supabase/scripts/test_create_lieferschein.sql`:

```sql
-- Manual test for create_lieferschein RPC.
-- Run with: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/scripts/test_create_lieferschein.sql
-- Leaves no data behind (BEGIN / ROLLBACK).

BEGIN;

-- === Setup fixtures ===
INSERT INTO suppliers (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'TEST Supplier');
INSERT INTO manufacturers (id, name) VALUES ('22222222-2222-2222-2222-222222222222', 'TEST Manufacturer');
INSERT INTO categories (id, name, kind, cluster)
  VALUES ('33333333-3333-3333-3333-333333333333', 'TEST Category', 'generic', 'sonstiges');
INSERT INTO models (id, manufacturer_id, category_id, modellname)
  VALUES ('44444444-4444-4444-4444-444444444444',
          '22222222-2222-2222-2222-222222222222',
          '33333333-3333-3333-3333-333333333333',
          'TEST Model');

-- === Happy path: 2 items, 1 with price ===
DO $$
DECLARE
  v_purchase_id uuid;
  v_dev_count int;
  v_item_count int;
BEGIN
  SELECT create_lieferschein(jsonb_build_object(
    'supplier_id', '11111111-1111-1111-1111-111111111111',
    'rechnungsnr', 'LS-TEST-001',
    'datum', '2026-04-23',
    'source_document_path', 'lieferscheine/test.pdf',
    'items', jsonb_build_array(
      jsonb_build_object(
        'model_id', '44444444-4444-4444-4444-444444444444',
        'serial_number', 'TESTSN-001',
        'location', NULL, 'notes', NULL,
        'ek_preis', 199.50
      ),
      jsonb_build_object(
        'model_id', '44444444-4444-4444-4444-444444444444',
        'serial_number', 'TESTSN-002',
        'location', NULL, 'notes', NULL,
        'ek_preis', NULL
      )
    )
  )) INTO v_purchase_id;

  SELECT COUNT(*) INTO v_dev_count
    FROM devices WHERE serial_number IN ('TESTSN-001', 'TESTSN-002');
  SELECT COUNT(*) INTO v_item_count
    FROM purchase_items WHERE purchase_id = v_purchase_id;

  IF v_dev_count <> 2 THEN RAISE EXCEPTION 'Expected 2 devices, got %', v_dev_count; END IF;
  IF v_item_count <> 1 THEN RAISE EXCEPTION 'Expected 1 purchase_item (one has NULL price), got %', v_item_count; END IF;

  RAISE NOTICE 'Happy path OK: purchase_id=%, devices=2, purchase_items=1', v_purchase_id;
END $$;

-- === Rollback path: duplicate SN must rollback the whole call ===
DO $$
DECLARE
  v_before_count int;
  v_after_count int;
  v_caught bool := false;
BEGIN
  SELECT COUNT(*) INTO v_before_count FROM devices;

  BEGIN
    PERFORM create_lieferschein(jsonb_build_object(
      'supplier_id', '11111111-1111-1111-1111-111111111111',
      'rechnungsnr', 'LS-TEST-002',
      'datum', '2026-04-23',
      'source_document_path', NULL,
      'items', jsonb_build_array(
        jsonb_build_object(
          'model_id', '44444444-4444-4444-4444-444444444444',
          'serial_number', 'TESTSN-003',
          'location', NULL, 'notes', NULL, 'ek_preis', 100
        ),
        jsonb_build_object(
          'model_id', '44444444-4444-4444-4444-444444444444',
          'serial_number', 'TESTSN-001',   -- duplicate from first test above
          'location', NULL, 'notes', NULL, 'ek_preis', 100
        )
      )
    ));
  EXCEPTION WHEN unique_violation THEN
    v_caught := true;
  END;

  SELECT COUNT(*) INTO v_after_count FROM devices;

  IF NOT v_caught THEN RAISE EXCEPTION 'Expected unique_violation, none raised'; END IF;
  IF v_after_count <> v_before_count THEN
    RAISE EXCEPTION 'Rollback failed: device count changed (% → %)', v_before_count, v_after_count;
  END IF;

  RAISE NOTICE 'Rollback path OK: unique_violation raised, no devices persisted';
END $$;

ROLLBACK;
```

- [ ] **Step 2: Run the test**

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/scripts/test_create_lieferschein.sql 2>&1 | tail -20
```

Expected:
```
NOTICE:  Happy path OK: purchase_id=..., devices=2, purchase_items=1
NOTICE:  Rollback path OK: unique_violation raised, no devices persisted
```

If `SUPABASE_DB_URL` is not set locally, the engineer should consult `supabase/config.toml` or `.env.local` for the local Postgres connection URL.

- [ ] **Step 3: Commit**

```bash
git add supabase/scripts/test_create_lieferschein.sql
git commit -m "test(db): add SQL integration test for create_lieferschein RPC"
```

---

## Task 4: PDF-to-PNG Helper

**Files:**
- Create: `lib/pdf/render-pages.ts`
- Create: `__tests__/lib/render-pages.test.ts`

- [ ] **Step 1: Install pdf-img-convert**

```bash
npm install pdf-img-convert
```

Expected: package added to `package.json`, no native build errors. (pdf-img-convert is pure JS, wraps pdfjs.)

- [ ] **Step 2: Write the failing test**

Create `__tests__/lib/render-pages.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { renderPdfPages, MAX_PDF_PAGES } from '@/lib/pdf/render-pages'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('renderPdfPages', () => {
  it('renders pages as PNG buffers, capped at MAX_PDF_PAGES', async () => {
    // Use a real tiny PDF fixture if available, else a minimal one-page PDF
    const pdfPath = join(__dirname, 'fixtures', 'sample.pdf')
    const buffer = readFileSync(pdfPath)
    const pages = await renderPdfPages(buffer)
    expect(pages.length).toBeGreaterThan(0)
    expect(pages.length).toBeLessThanOrEqual(MAX_PDF_PAGES)
    // Each page is a PNG (magic bytes 89 50 4E 47)
    for (const png of pages) {
      expect(png[0]).toBe(0x89)
      expect(png[1]).toBe(0x50)
      expect(png[2]).toBe(0x4e)
      expect(png[3]).toBe(0x47)
    }
  })
})
```

Create a minimal fixture `__tests__/lib/fixtures/sample.pdf` (one page, any content — easiest way: print any web page to PDF and copy here, or use the test bundle that Next.js ships).

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest __tests__/lib/render-pages.test.ts 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module '@/lib/pdf/render-pages'".

- [ ] **Step 4: Write the implementation**

Create `lib/pdf/render-pages.ts`:

```typescript
import pdf2img from 'pdf-img-convert'

export const MAX_PDF_PAGES = 5

/**
 * Renders the first MAX_PDF_PAGES pages of a PDF to PNG buffers.
 * Pure JS, no native deps. Pages beyond the limit are silently skipped.
 */
export async function renderPdfPages(pdfBuffer: Buffer): Promise<Buffer[]> {
  const results = await pdf2img.convert(pdfBuffer, {
    page_numbers: Array.from({ length: MAX_PDF_PAGES }, (_, i) => i + 1),
    scale: 2,       // 2x resolution for better OCR
  })
  // pdf-img-convert returns Uint8Array[] (PNG-encoded)
  return results.map((u) => Buffer.from(u))
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest __tests__/lib/render-pages.test.ts 2>&1 | tail -20
```

Expected: `Tests: 1 passed`.

- [ ] **Step 6: Commit**

```bash
git add lib/pdf/render-pages.ts __tests__/lib/render-pages.test.ts __tests__/lib/fixtures/sample.pdf package.json package-lock.json
git commit -m "feat(pdf): add renderPdfPages helper using pdf-img-convert"
```

---

## Task 5: OCR API Route — POST `/api/lieferschein/ocr`

**Files:**
- Create: `app/api/lieferschein/ocr/route.ts`
- Create: `__tests__/api/lieferschein-ocr.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/lieferschein-ocr.test.ts`:

```typescript
/**
 * @jest-environment node
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.LIEFERSCHEIN_OCR_MODEL = 'gpt-4o-mini'

import { NextRequest } from 'next/server'

// --- Mock OpenAI ---
const mockCreate = jest.fn()
jest.mock('openai', () => jest.fn().mockImplementation(() => ({
  chat: { completions: { create: mockCreate } },
})))

// --- Mock Supabase client: auth + storage ---
const uploadMock = jest.fn().mockResolvedValue({ data: { path: 'ignored' }, error: null })
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'test-user' } } }) },
    from: (t: string) => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { role: 'admin' }, error: null }) }),
      }),
    }),
    storage: {
      from: () => ({
        upload: uploadMock,
        remove: jest.fn().mockResolvedValue({ data: null, error: null }),
        createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/x' }, error: null }),
      }),
    },
  }),
}))

import { POST } from '@/app/api/lieferschein/ocr/route'

function makeRequest(file: Blob | null): NextRequest {
  const form = new FormData()
  if (file) form.append('file', file, 'slip.jpg')
  return new NextRequest('http://localhost/api/lieferschein/ocr', {
    method: 'POST',
    body: form,
  })
}

describe('POST /api/lieferschein/ocr', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    uploadMock.mockClear()
  })

  it('returns 400 when file is missing', async () => {
    const res = await POST(makeRequest(null))
    expect(res.status).toBe(400)
  })

  it('returns 413 when file exceeds 10MB', async () => {
    const big = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: 'image/jpeg' })
    const res = await POST(makeRequest(big))
    expect(res.status).toBe(413)
  })

  it('uploads file, calls OpenAI, returns parsed payload', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        supplier: 'Quad GmbH',
        rechnungsnr: 'LS-42',
        datum: '2026-04-20',
        items: [{ manufacturer: 'Epson', name: 'TM-T88VI', serial_number: null, quantity: 5, ek_preis: 249.0 }],
      }) } }],
    })
    const res = await POST(makeRequest(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.supplier).toBe('Quad GmbH')
    expect(body.items).toHaveLength(1)
    expect(body.source_path).toMatch(/^lieferscheine\//)
    expect(uploadMock).toHaveBeenCalled()
  })

  it('returns 502 when OpenAI throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('timeout'))
    const res = await POST(makeRequest(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })))
    expect(res.status).toBe(502)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/lieferschein-ocr.test.ts 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module '@/app/api/lieferschein/ocr/route'".

- [ ] **Step 3: Write the implementation**

Create `app/api/lieferschein/ocr/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { renderPdfPages } from '@/lib/pdf/render-pages'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf'])

const LIEFERSCHEIN_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'Lieferschein',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        supplier:    { type: ['string', 'null'] },
        rechnungsnr: { type: ['string', 'null'] },
        datum:       { type: ['string', 'null'] },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              manufacturer:  { type: ['string', 'null'] },
              name:          { type: ['string', 'null'] },
              serial_number: { type: ['string', 'null'] },
              quantity:      { type: 'integer', minimum: 1 },
              ek_preis:      { type: ['number', 'null'] },
            },
            required: ['manufacturer', 'name', 'serial_number', 'quantity', 'ek_preis'],
            additionalProperties: false,
          },
        },
      },
      required: ['supplier', 'rechnungsnr', 'datum', 'items'],
      additionalProperties: false,
    },
  },
} as const

const SYSTEM_PROMPT = `Du extrahierst aus einem Lieferschein (Foto oder PDF) strukturierte Felder für eine Warenwirtschaft für Kassen-/POS-Hardware.

Felder:
- supplier: Lieferant / Absender-Firma auf dem Lieferschein. Kanonischer Name ohne Rechtsform (z.B. "Quad" statt "Quad GmbH").
- rechnungsnr: Lieferschein- oder Rechnungsnummer (z.B. "LS-2026-0042"). Nicht Bestellnummer, nicht Auftragsnummer.
- datum: Rechnungs- oder Lieferdatum im ISO-Format YYYY-MM-DD. Bevorzuge Rechnungsdatum wenn beide vorhanden.
- items: Liste der Positionen auf dem Lieferschein.
  - manufacturer: Hersteller ohne Rechtsform (z.B. "Epson").
  - name: Modellbezeichnung ohne Hersteller-Präfix (z.B. "TM-T88VI").
  - serial_number: NUR wenn Seriennummer der Einzelgeräte auf dem Lieferschein gelistet ist. NICHT: Artikel-Nr., EAN, Bestell-Nr., Trackingnummer.
  - quantity: Anzahl gleicher Geräte in der Zeile (Default 1).
  - ek_preis: Netto-Stückpreis in Euro. Wenn nur Gesamtpreis gelistet, teile durch quantity. Wenn kein Preis erkennbar: null.

Regeln:
- Nur aus dem Dokument ableiten, niemals raten.
- Nicht eindeutig erkennbare Felder: null.
- Keine zusätzlichen Felder, keine Erklärungen.`

export async function POST(req: NextRequest) {
  const supabase = createClient()

  // --- Auth ---
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // --- Parse multipart ---
  const form = await req.formData()
  const file = form.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'file too large (max 10MB)' }, { status: 413 })
  }
  const mime = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: `unsupported type: ${mime}` }, { status: 415 })
  }

  // --- Upload to Storage ---
  const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg'
  const iso = new Date().toISOString().slice(0, 10)
  const source_path = `lieferscheine/${iso}-${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await supabase.storage.from('lieferscheine').upload(
    source_path.replace(/^lieferscheine\//, ''),
    buffer,
    { contentType: mime, upsert: false },
  )
  if (upErr) {
    console.error('Storage upload failed', { user: user.id, err: upErr.message })
    return NextResponse.json({ error: 'storage upload failed' }, { status: 500 })
  }

  // --- Build Vision content ---
  type VisionPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  const userContent: VisionPart[] = [
    { type: 'text', text: 'Extrahiere die strukturierten Felder aus dem folgenden Lieferschein.' },
  ]
  if (mime === 'application/pdf') {
    let pages: Buffer[]
    try { pages = await renderPdfPages(buffer) } catch (e) {
      console.error('PDF render failed', { user: user.id, err: String(e) })
      return NextResponse.json({ error: 'pdf render failed' }, { status: 502 })
    }
    for (const png of pages) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${png.toString('base64')}` },
      })
    }
  } else {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${mime};base64,${buffer.toString('base64')}` },
    })
  }

  // --- Vision call ---
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  const model = process.env.LIEFERSCHEIN_OCR_MODEL || 'gpt-4o-mini'
  let completion
  try {
    completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { role: 'user', content: userContent as any },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response_format: LIEFERSCHEIN_SCHEMA as any,
      max_tokens: 2000,
    })
  } catch (e) {
    console.error('OpenAI vision failed', { user: user.id, source_path, err: String(e) })
    return NextResponse.json({ error: 'ocr service error' }, { status: 502 })
  }

  const raw = completion.choices[0]?.message?.content ?? '{}'
  let parsed
  try { parsed = JSON.parse(raw) } catch {
    return NextResponse.json({ error: 'ocr returned non-json', raw }, { status: 502 })
  }

  return NextResponse.json({ ...parsed, source_path })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/lieferschein-ocr.test.ts 2>&1 | tail -20
```

Expected: `Tests: 4 passed`.

- [ ] **Step 5: Commit**

```bash
git add app/api/lieferschein/ocr/route.ts __tests__/api/lieferschein-ocr.test.ts
git commit -m "feat(api): add /api/lieferschein/ocr with vision + structured output"
```

---

## Task 6: Cancel Endpoint — POST `/api/lieferschein/ocr/cancel`

**Files:**
- Create: `app/api/lieferschein/ocr/cancel/route.ts`
- Create: `__tests__/api/lieferschein-ocr-cancel.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/lieferschein-ocr-cancel.test.ts`:

```typescript
/**
 * @jest-environment node
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

import { NextRequest } from 'next/server'

const removeMock = jest.fn().mockResolvedValue({ data: null, error: null })
jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'admin' } }) }) }) }),
    storage: { from: () => ({ remove: removeMock }) },
  }),
}))

import { POST } from '@/app/api/lieferschein/ocr/cancel/route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/lieferschein/ocr/cancel', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/lieferschein/ocr/cancel', () => {
  beforeEach(() => removeMock.mockClear())

  it('returns 400 when source_path is missing', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when source_path is outside lieferscheine/', async () => {
    const res = await POST(req({ source_path: 'other-bucket/evil.pdf' }))
    expect(res.status).toBe(400)
  })

  it('deletes the file and returns 200', async () => {
    const res = await POST(req({ source_path: 'lieferscheine/2026-04-23-abc.pdf' }))
    expect(res.status).toBe(200)
    expect(removeMock).toHaveBeenCalledWith(['2026-04-23-abc.pdf'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/lieferschein-ocr-cancel.test.ts 2>&1 | tail -20
```

Expected: FAIL ("Cannot find module...").

- [ ] **Step 3: Write the implementation**

Create `app/api/lieferschein/ocr/cancel/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { source_path?: string }
  try { body = await req.json() } catch { body = {} }

  const sp = body.source_path
  if (!sp || typeof sp !== 'string') {
    return NextResponse.json({ error: 'source_path required' }, { status: 400 })
  }
  if (!sp.startsWith('lieferscheine/')) {
    return NextResponse.json({ error: 'invalid source_path' }, { status: 400 })
  }

  const keyInBucket = sp.replace(/^lieferscheine\//, '')
  const { error } = await supabase.storage.from('lieferscheine').remove([keyInBucket])
  if (error) {
    console.error('Storage cancel remove failed', { user: user.id, sp, err: error.message })
    return NextResponse.json({ error: 'remove failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/lieferschein-ocr-cancel.test.ts 2>&1 | tail -20
```

Expected: `Tests: 3 passed`.

- [ ] **Step 5: Commit**

```bash
git add app/api/lieferschein/ocr/cancel/route.ts __tests__/api/lieferschein-ocr-cancel.test.ts
git commit -m "feat(api): add /api/lieferschein/ocr/cancel for aborted uploads"
```

---

## Task 7: ManufacturerPicker Component

**Files:**
- Create: `components/inventory/manufacturer-picker.tsx`
- Create: `__tests__/components/manufacturer-picker.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/manufacturer-picker.test.tsx`:

```typescript
/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ManufacturerPicker } from '@/components/inventory/manufacturer-picker'

const insertMock = jest.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null })
const selectMock = jest.fn().mockResolvedValue({ data: [{ id: 'm1', name: 'Epson' }], error: null })

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ order: selectMock }),
      insert: () => ({ select: () => ({ single: insertMock }) }),
    }),
  }),
}))

describe('ManufacturerPicker', () => {
  beforeEach(() => { insertMock.mockClear(); selectMock.mockClear() })

  it('renders existing manufacturers', async () => {
    render(<ManufacturerPicker value="" onChange={() => {}} />)
    await waitFor(() => expect(selectMock).toHaveBeenCalled())
  })

  it('creates a new manufacturer and calls onChange with new id', async () => {
    const onChange = jest.fn()
    render(<ManufacturerPicker value="" onChange={onChange} />)
    await waitFor(() => expect(selectMock).toHaveBeenCalled())

    fireEvent.click(screen.getByText('+ Neu'))
    const input = screen.getByPlaceholderText(/Hersteller-Name/i)
    fireEvent.change(input, { target: { value: 'Quad' } })
    fireEvent.click(screen.getByText('Anlegen'))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('new-id'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/manufacturer-picker.test.tsx 2>&1 | tail -20
```

Expected: FAIL ("Cannot find module...").

- [ ] **Step 3: Write the implementation**

Create `components/inventory/manufacturer-picker.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface Manufacturer { id: string; name: string }

interface ManufacturerPickerProps {
  value: string
  onChange: (id: string) => void
  hint?: string | null             // OCR value shown when no DB match
}

export function ManufacturerPicker({ value, onChange, hint }: ManufacturerPickerProps) {
  const supabase = createClient()
  const [items, setItems] = useState<Manufacturer[]>([])
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState(hint ?? '')

  async function refresh() {
    const { data } = await supabase.from('manufacturers').select('id, name').order('name')
    setItems((data ?? []) as Manufacturer[])
  }
  useEffect(() => { refresh() }, [])

  async function create() {
    if (!name.trim()) { toast.error('Name ist Pflicht'); return }
    const { data, error } = await supabase.from('manufacturers').insert({ name: name.trim() }).select('id').single()
    if (error) { toast.error('Konnte nicht angelegt werden', { description: error.message }); return }
    await refresh()
    onChange(data.id)
    setShowNew(false)
    setName('')
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Hersteller wählen..." /></SelectTrigger>
          <SelectContent>
            {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowNew(v => !v)}>
          {showNew ? 'Abbrechen' : '+ Neu'}
        </Button>
      </div>
      {hint && !value && !showNew && (
        <p className="text-xs text-amber-600">OCR: „{hint}" — nicht in DB, bitte wählen oder anlegen.</p>
      )}
      {showNew && (
        <div className="border rounded p-2 space-y-2 bg-slate-50">
          <Label className="text-xs">Hersteller-Name</Label>
          <Input placeholder="Hersteller-Name" value={name} onChange={e => setName(e.target.value)} />
          <Button type="button" size="sm" onClick={create}>Anlegen</Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/manufacturer-picker.test.tsx 2>&1 | tail -20
```

Expected: `Tests: 2 passed`.

- [ ] **Step 5: Commit**

```bash
git add components/inventory/manufacturer-picker.tsx __tests__/components/manufacturer-picker.test.tsx
git commit -m "feat(inventory): add ManufacturerPicker with inline create"
```

---

## Task 8: DeliveryItemRow Component (with inline Model create)

**Files:**
- Create: `components/delivery/delivery-item-row.tsx`
- Create: `__tests__/components/delivery-item-row.test.tsx`

The row supports inline **Model create** when manufacturer + category are set but the target model doesn't exist yet. Manufacturer create is delegated to `ManufacturerPicker` (Task 7).

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/delivery-item-row.test.tsx`:

```typescript
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeliveryItemRow } from '@/components/delivery/delivery-item-row'
import type { LieferscheinRowDraft, Category, Model } from '@/lib/types'

const insertMock = jest.fn().mockResolvedValue({ data: { id: 'new-model' }, error: null })
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (t: string) => ({
      select: () => ({ order: async () => ({ data: [], error: null }) }),
      insert: () => ({ select: () => ({ single: insertMock }) }),
    }),
  }),
}))

const baseRow: LieferscheinRowDraft = {
  client_id: 'r1',
  manufacturer_id: null,
  model_id: null,
  category_id: null,
  serial_number: null,
  location: null,
  notes: null,
  ek_preis: null,
  ocr_manufacturer: 'Epson',
  ocr_name: 'TM-T88VI',
}

const categories: Category[] = [
  { id: 'c1', name: 'Drucker' } as Category,
]
const models: Model[] = []

describe('DeliveryItemRow', () => {
  beforeEach(() => insertMock.mockClear())

  it('renders OCR hint when no manufacturer selected', () => {
    render(
      <DeliveryItemRow
        row={baseRow} categories={categories} models={models}
        onChange={() => {}} onRemove={() => {}} onModelCreated={() => {}}
      />
    )
    expect(screen.getByText(/OCR: „Epson"/)).toBeInTheDocument()
  })

  it('calls onRemove when delete button clicked', () => {
    const onRemove = jest.fn()
    render(
      <DeliveryItemRow
        row={baseRow} categories={categories} models={models}
        onChange={() => {}} onRemove={onRemove} onModelCreated={() => {}}
      />
    )
    fireEvent.click(screen.getByLabelText('Zeile entfernen'))
    expect(onRemove).toHaveBeenCalledWith('r1')
  })

  it('updates serial_number on input', () => {
    const onChange = jest.fn()
    render(
      <DeliveryItemRow
        row={baseRow} categories={categories} models={models}
        onChange={onChange} onRemove={() => {}} onModelCreated={() => {}}
      />
    )
    const sn = screen.getByPlaceholderText(/Seriennummer/i)
    fireEvent.change(sn, { target: { value: 'SN123' } })
    expect(onChange).toHaveBeenCalledWith('r1', expect.objectContaining({ serial_number: 'SN123' }))
  })

  it('creates a new model inline and calls onModelCreated + onChange', async () => {
    const onChange = jest.fn()
    const onModelCreated = jest.fn()
    const row: LieferscheinRowDraft = {
      ...baseRow,
      manufacturer_id: 'mf1',
      category_id: 'c1',
    }
    render(
      <DeliveryItemRow
        row={row} categories={categories} models={models}
        onChange={onChange} onRemove={() => {}} onModelCreated={onModelCreated}
      />
    )
    fireEvent.click(screen.getByLabelText('Modell neu anlegen'))
    const input = screen.getByPlaceholderText(/Modellname/i)
    fireEvent.change(input, { target: { value: 'TM-T88VI' } })
    fireEvent.click(screen.getByText('Anlegen'))

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled()
      expect(onModelCreated).toHaveBeenCalled()
      expect(onChange).toHaveBeenCalledWith('r1', expect.objectContaining({ model_id: 'new-model' }))
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/delivery-item-row.test.tsx 2>&1 | tail -20
```

Expected: FAIL ("Cannot find module...").

- [ ] **Step 3: Write the implementation**

Create `components/delivery/delivery-item-row.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ManufacturerPicker } from '@/components/inventory/manufacturer-picker'
import { toast } from 'sonner'
import { X, Plus } from 'lucide-react'
import type { LieferscheinRowDraft, Category, Model } from '@/lib/types'

interface Props {
  row: LieferscheinRowDraft
  categories: Category[]
  models: Model[]                                       // full unfiltered list; filtered below
  onChange: (client_id: string, patch: Partial<LieferscheinRowDraft>) => void
  onRemove: (client_id: string) => void
  onModelCreated: () => Promise<void> | void            // parent re-fetches models after create
}

export function DeliveryItemRow({ row, categories, models, onChange, onRemove, onModelCreated }: Props) {
  const supabase = createClient()
  const [showNewModel, setShowNewModel] = useState(false)
  const [newModelName, setNewModelName] = useState(row.ocr_name ?? '')

  const availableModels = row.manufacturer_id
    ? models.filter(m => m.manufacturer_id === row.manufacturer_id)
    : []

  const canCreateModel = !!row.manufacturer_id && !!row.category_id

  function patch(p: Partial<LieferscheinRowDraft>) {
    onChange(row.client_id, p)
  }

  async function createModel() {
    if (!row.manufacturer_id || !row.category_id) {
      toast.error('Hersteller und Kategorie müssen erst gesetzt sein')
      return
    }
    if (!newModelName.trim()) { toast.error('Modellname erforderlich'); return }
    const { data, error } = await supabase.from('models').insert({
      manufacturer_id: row.manufacturer_id,
      category_id: row.category_id,
      modellname: newModelName.trim(),
    }).select('id').single()
    if (error) { toast.error('Modell konnte nicht angelegt werden', { description: error.message }); return }
    await onModelCreated()
    patch({ model_id: data.id })
    setShowNewModel(false)
  }

  return (
    <>
      <tr className="border-b">
        <td className="p-2 align-top min-w-[180px]">
          <ManufacturerPicker
            value={row.manufacturer_id ?? ''}
            onChange={id => patch({ manufacturer_id: id, model_id: null })}
            hint={row.ocr_manufacturer}
          />
        </td>
        <td className="p-2 align-top min-w-[220px]">
          <div className="flex gap-1">
            <Select
              value={row.model_id ?? ''}
              onValueChange={id => {
                const m = availableModels.find(x => x.id === id)
                patch({ model_id: id, category_id: m?.category_id ?? row.category_id })
              }}
              disabled={!row.manufacturer_id}
            >
              <SelectTrigger className="flex-1"><SelectValue placeholder="Modell..." /></SelectTrigger>
              <SelectContent>
                {availableModels.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.modellname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button" variant="outline" size="icon"
              aria-label="Modell neu anlegen"
              disabled={!canCreateModel}
              onClick={() => setShowNewModel(v => !v)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {row.ocr_name && !row.model_id && (
            <p className="text-xs text-amber-600 mt-1">OCR: „{row.ocr_name}"</p>
          )}
          {!canCreateModel && row.manufacturer_id && !row.category_id && (
            <p className="text-xs text-slate-500 mt-1">Erst Kategorie wählen, dann neues Modell anlegen.</p>
          )}
        </td>
        <td className="p-2 align-top min-w-[150px]">
          <Select value={row.category_id ?? ''} onValueChange={id => patch({ category_id: id })}>
            <SelectTrigger><SelectValue placeholder="Kategorie..." /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </td>
        <td className="p-2 align-top min-w-[140px]">
          <Input
            placeholder="Seriennummer"
            className="font-mono"
            value={row.serial_number ?? ''}
            onChange={e => patch({ serial_number: e.target.value || null })}
          />
        </td>
        <td className="p-2 align-top min-w-[120px]">
          <Input
            placeholder="Standort"
            value={row.location ?? ''}
            onChange={e => patch({ location: e.target.value || null })}
          />
        </td>
        <td className="p-2 align-top min-w-[100px]">
          <Input
            type="number" step="0.01" min="0" placeholder="EK €"
            value={row.ek_preis ?? ''}
            onChange={e => patch({ ek_preis: e.target.value ? Number(e.target.value) : null })}
          />
        </td>
        <td className="p-2 align-top">
          <Button
            type="button" variant="ghost" size="icon"
            aria-label="Zeile entfernen"
            onClick={() => onRemove(row.client_id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </td>
      </tr>
      {showNewModel && (
        <tr className="bg-slate-50 border-b">
          <td colSpan={7} className="p-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Modellname</Label>
                <Input
                  placeholder="Modellname (z.B. TM-T88VI)"
                  value={newModelName}
                  onChange={e => setNewModelName(e.target.value)}
                />
              </div>
              <Button type="button" onClick={createModel}>Anlegen</Button>
              <Button type="button" variant="ghost" onClick={() => setShowNewModel(false)}>Abbrechen</Button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/delivery-item-row.test.tsx 2>&1 | tail -20
```

Expected: `Tests: 3 passed`.

- [ ] **Step 5: Commit**

```bash
git add components/delivery/delivery-item-row.tsx __tests__/components/delivery-item-row.test.tsx
git commit -m "feat(delivery): add DeliveryItemRow with per-row pickers"
```

---

## Task 9: DeliveryReview Component (Split View + Table + Save)

**Files:**
- Create: `components/delivery/delivery-review.tsx`
- Create: `__tests__/components/delivery-review.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/delivery-review.test.tsx`:

```typescript
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { DeliveryReview } from '@/components/delivery/delivery-review'
import type { LieferscheinOcrResponse, Category, Model } from '@/lib/types'

const rpcMock = jest.fn().mockResolvedValue({ data: 'purchase-id', error: null })
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }),
    rpc: (_n: string, args: unknown) => { rpcMock(args); return rpcMock(args) },
  }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }))

const ocr: LieferscheinOcrResponse = {
  supplier: 'Quad',
  rechnungsnr: 'LS-1',
  datum: '2026-04-20',
  source_path: 'lieferscheine/x.pdf',
  items: [
    { manufacturer: 'Epson', name: 'TM-T88VI', serial_number: null, quantity: 3, ek_preis: 249 },
    { manufacturer: 'Epson', name: 'TM-T88VI', serial_number: 'SN-X', quantity: 1, ek_preis: 249 },
  ],
}
const categories: Category[] = []
const models: Model[] = []

describe('DeliveryReview', () => {
  it('expands quantity>1 without SN into multiple rows', () => {
    render(<DeliveryReview ocr={ocr} categories={categories} models={models} previewUrl="about:blank" onModelsRefresh={async () => {}} />)
    // 3 expanded + 1 with SN = 4 rows
    const rows = screen.getAllByLabelText('Zeile entfernen')
    expect(rows).toHaveLength(4)
  })

  it('adds a blank row when "+ Zeile" clicked', () => {
    render(<DeliveryReview ocr={ocr} categories={categories} models={models} previewUrl="about:blank" onModelsRefresh={async () => {}} />)
    fireEvent.click(screen.getByText('+ Zeile'))
    const rows = screen.getAllByLabelText('Zeile entfernen')
    expect(rows).toHaveLength(5)
  })

  it('blocks save when no supplier picked', () => {
    render(<DeliveryReview ocr={ocr} categories={categories} models={models} previewUrl="about:blank" onModelsRefresh={async () => {}} />)
    fireEvent.click(screen.getByText(/Alle speichern/))
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/delivery-review.test.tsx 2>&1 | tail -20
```

Expected: FAIL ("Cannot find module...").

- [ ] **Step 3: Write the implementation**

Create `components/delivery/delivery-review.tsx`:

```typescript
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EntityPicker } from '@/components/inventory/entity-picker'
import { DeliveryItemRow } from '@/components/delivery/delivery-item-row'
import { toast } from 'sonner'
import type { LieferscheinOcrResponse, LieferscheinRowDraft, Category, Model, LieferscheinRpcPayload } from '@/lib/types'

interface Props {
  ocr: LieferscheinOcrResponse
  categories: Category[]
  models: Model[]
  previewUrl: string               // blob URL or storage signed URL for the original doc
  onModelsRefresh: () => Promise<void>   // parent re-fetches models after inline create
}

function expandOcrToRows(ocr: LieferscheinOcrResponse, models: Model[]): LieferscheinRowDraft[] {
  const rows: LieferscheinRowDraft[] = []
  let counter = 0
  for (const item of ocr.items) {
    const expand = item.quantity > 1 && !item.serial_number ? item.quantity : 1
    for (let i = 0; i < expand; i++) {
      // Try model match
      const match = models.find(m =>
        m.manufacturer?.name?.toLowerCase() === item.manufacturer?.toLowerCase() &&
        m.modellname?.toLowerCase() === item.name?.toLowerCase(),
      )
      rows.push({
        client_id: `r${counter++}`,
        manufacturer_id: match?.manufacturer_id ?? null,
        model_id: match?.id ?? null,
        category_id: match?.category_id ?? null,
        serial_number: i === 0 ? item.serial_number : null,
        location: null,
        notes: null,
        ek_preis: item.ek_preis,
        ocr_manufacturer: item.manufacturer,
        ocr_name: item.name,
      })
    }
  }
  return rows
}

export function DeliveryReview({ ocr, categories, models, previewUrl, onModelsRefresh }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [supplier_id, setSupplierId] = useState('')
  const [rechnungsnr, setRechnungsnr] = useState(ocr.rechnungsnr ?? '')
  const [datum, setDatum] = useState(ocr.datum ?? new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState<LieferscheinRowDraft[]>(() => expandOcrToRows(ocr, models))
  const [saving, setSaving] = useState(false)

  function patchRow(id: string, p: Partial<LieferscheinRowDraft>) {
    setRows(prev => prev.map(r => (r.client_id === id ? { ...r, ...p } : r)))
  }
  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.client_id !== id))
  }
  function addBlankRow() {
    setRows(prev => [...prev, {
      client_id: `r${Date.now()}`,
      manufacturer_id: null, model_id: null, category_id: null,
      serial_number: null, location: null, notes: null, ek_preis: null,
      ocr_manufacturer: null, ocr_name: null,
    }])
  }

  const isPdf = useMemo(() => previewUrl.toLowerCase().endsWith('.pdf') || previewUrl.includes('application/pdf'), [previewUrl])

  async function save() {
    if (!supplier_id) { toast.error('Lieferant wählen'); return }
    const missing = rows.findIndex(r => !r.model_id)
    if (missing >= 0) { toast.error(`Zeile ${missing + 1}: Modell fehlt`); return }
    if (rows.length === 0) { toast.error('Mindestens eine Zeile erforderlich'); return }

    setSaving(true)
    const payload: LieferscheinRpcPayload = {
      supplier_id,
      rechnungsnr: rechnungsnr || null,
      datum,
      source_document_path: ocr.source_path,
      items: rows.map(r => ({
        model_id: r.model_id!,
        serial_number: r.serial_number,
        location: r.location,
        notes: r.notes,
        ek_preis: r.ek_preis,
      })),
    }
    const { data, error } = await supabase.rpc('create_lieferschein', { payload })
    setSaving(false)

    if (error) {
      if (error.code === '23505') {
        toast.error('Seriennummer bereits vergeben', { description: error.message })
      } else {
        toast.error('Speichern fehlgeschlagen', { description: error.message })
      }
      return
    }
    toast.success(`${rows.length} Geräte angelegt`)
    router.push(`/inventory?purchase=${data}`)
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="border rounded-lg bg-slate-50 overflow-hidden min-h-[500px]">
        {isPdf
          ? <iframe src={previewUrl} className="w-full h-[80vh]" title="Lieferschein" />
          : <img src={previewUrl} alt="Lieferschein" className="max-w-full h-auto" />}
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label>Rechnungsnr</Label><Input value={rechnungsnr} onChange={e => setRechnungsnr(e.target.value)} /></div>
          <div><Label>Datum</Label><Input type="date" value={datum} onChange={e => setDatum(e.target.value)} /></div>
          <div><EntityPicker table="suppliers" label="Lieferant" value={supplier_id} onChange={setSupplierId} /></div>
        </div>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="p-2 text-left">Hersteller</th>
                <th className="p-2 text-left">Modell</th>
                <th className="p-2 text-left">Kategorie</th>
                <th className="p-2 text-left">SN</th>
                <th className="p-2 text-left">Standort</th>
                <th className="p-2 text-left">EK €</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <DeliveryItemRow
                  key={r.client_id}
                  row={r} categories={categories} models={models}
                  onChange={patchRow} onRemove={removeRow}
                  onModelCreated={onModelsRefresh}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={addBlankRow}>+ Zeile</Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Speichern…' : 'Alle speichern'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/delivery-review.test.tsx 2>&1 | tail -20
```

Expected: `Tests: 3 passed`.

- [ ] **Step 5: Commit**

```bash
git add components/delivery/delivery-review.tsx __tests__/components/delivery-review.test.tsx
git commit -m "feat(delivery): add DeliveryReview split-view with atomic save"
```

---

## Task 10: DeliveryUpload Component

**Files:**
- Create: `components/delivery/delivery-upload.tsx`

- [ ] **Step 1: Write the component** (no test — trivial wrapper, covered in smoke checklist)

Create `components/delivery/delivery-upload.tsx`:

```typescript
'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { LieferscheinOcrResponse } from '@/lib/types'

interface Props {
  onResult: (ocr: LieferscheinOcrResponse, localPreviewUrl: string) => void
}

export function DeliveryUpload({ onResult }: Props) {
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handle(file: File) {
    setLoading(true)
    const previewUrl = URL.createObjectURL(file)
    const form = new FormData()
    form.append('file', file, file.name)
    try {
      const res = await fetch('/api/lieferschein/ocr', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data: LieferscheinOcrResponse = await res.json()
      onResult(data, previewUrl)
    } catch (e) {
      toast.error('OCR fehlgeschlagen', { description: e instanceof Error ? e.message : 'unbekannt' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center space-y-3">
      <p className="text-slate-500 text-sm">Lieferschein als Foto oder PDF hochladen</p>
      <div className="flex justify-center gap-3">
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
          Datei hochladen
        </Button>
        <Button
          type="button" variant="outline"
          onClick={() => {
            if (fileRef.current) {
              fileRef.current.setAttribute('capture', 'environment')
              fileRef.current.click()
            }
          }}
          disabled={loading}
        >
          <Camera className="h-4 w-4 mr-2" />
          Kamera
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={e => e.target.files?.[0] && handle(e.target.files[0])}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/delivery/delivery-upload.tsx
git commit -m "feat(delivery): add DeliveryUpload for photo/PDF input"
```

---

## Task 11: Page `/inventory/delivery/new` + Sidebar Link

**Files:**
- Create: `app/(protected)/inventory/delivery/new/page.tsx`
- Modify: sidebar / nav component (locate with `grep -rn "inventory" components/layout/`)

- [ ] **Step 1: Write the page**

Create `app/(protected)/inventory/delivery/new/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DeliveryUpload } from '@/components/delivery/delivery-upload'
import { DeliveryReview } from '@/components/delivery/delivery-review'
import type { LieferscheinOcrResponse, Category, Model } from '@/lib/types'

export default function NewDeliveryPage() {
  const router = useRouter()
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [ocr, setOcr] = useState<LieferscheinOcrResponse | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')

  async function refreshModels() {
    const { data: ms } = await supabase
      .from('models')
      .select('*, manufacturer:manufacturers(*)')
      .order('modellname')
    setModels((ms ?? []) as Model[])
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'viewer') { router.push('/inventory'); return }
      const { data: cats } = await supabase.from('categories').select('*').order('name')
      setCategories(cats ?? [])
      await refreshModels()
    }
    load()
  }, [])

  // Cleanup: if user leaves the page after OCR without saving, fire-and-forget a cancel.
  useEffect(() => {
    if (!ocr) return
    function onUnload() {
      navigator.sendBeacon(
        '/api/lieferschein/ocr/cancel',
        new Blob([JSON.stringify({ source_path: ocr!.source_path })], { type: 'application/json' }),
      )
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [ocr])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Lieferschein scannen</h1>
      {!ocr && (
        <DeliveryUpload
          onResult={(data, preview) => { setOcr(data); setPreviewUrl(preview) }}
        />
      )}
      {ocr && (
        <DeliveryReview
          ocr={ocr}
          categories={categories}
          models={models}
          previewUrl={previewUrl}
          onModelsRefresh={refreshModels}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Locate the sidebar/nav component**

```bash
grep -rln "inventory" components/layout/ 2>&1 | head -5
```

Inspect the hits (most likely `components/layout/sidebar.tsx`) and identify the section where the existing „Lager / Inventory" links live.

- [ ] **Step 3: Add the sidebar link**

Add a new nav entry (mirror the existing pattern exactly — do not invent new markup):

```tsx
{ href: '/inventory/delivery/new', label: 'Lieferschein scannen', icon: ScanLine }
```

Import `ScanLine` from `lucide-react` at the top of the file. The exact snippet depends on how the sidebar is structured; follow what's already there.

- [ ] **Step 4: Verify build and types**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v '__tests__' | head -20
```

Expected: no errors outside of `__tests__/` (the pre-existing jest-type noise).

- [ ] **Step 5: Run all new/changed Jest tests**

```bash
npx jest __tests__/lib/render-pages.test.ts \
         __tests__/api/lieferschein-ocr.test.ts \
         __tests__/api/lieferschein-ocr-cancel.test.ts \
         __tests__/components/manufacturer-picker.test.tsx \
         __tests__/components/delivery-item-row.test.tsx \
         __tests__/components/delivery-review.test.tsx 2>&1 | tail -10
```

Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add app/\(protected\)/inventory/delivery/new/page.tsx components/layout/
git commit -m "feat(delivery): wire /inventory/delivery/new page + sidebar link"
```

---

## Task 12: Smoke Checklist + Deploy

**Files:** none (verification only)

- [ ] **Step 1: Local smoke test**

```bash
npm run dev
```

Open `http://localhost:3000/inventory/delivery/new` and run through:

- [ ] JPG upload with clear items → review table appears, pickers prefillable
- [ ] PNG upload works the same
- [ ] PDF upload (1-page) → review table appears
- [ ] PDF upload (3-page) → items from all pages extracted
- [ ] OCR item with `quantity: 3` without SN → 3 rows expanded
- [ ] Inline „+ Neu" on Manufacturer creates new manufacturer
- [ ] Inline „+ Neu" on Supplier (EntityPicker) works
- [ ] Model picker disabled until manufacturer selected
- [ ] Save without supplier → toast "Lieferant wählen", no RPC call
- [ ] Save without model_id in a row → toast "Zeile N: Modell fehlt", no RPC call
- [ ] Happy-path save → toast "N Geräte angelegt", redirect to `/inventory?purchase=<id>`
- [ ] Reload the `/inventory?purchase=<id>` list — N new devices visible
- [ ] SQL: `select count(*) from purchases where source_document_path is not null` returns ≥ 1
- [ ] Supabase Storage: `lieferscheine` bucket contains the uploaded file

- [ ] **Step 2: Deploy to VPS**

Follow the deployment pattern used before (scp changed files + `docker compose build && up -d`):

```bash
# From local repo
ssh -i ~/.ssh/hostinger_ed25519 root@187.127.74.66 \
  "cd /opt/apps/warenwirtschaft && git -C /tmp/warenwirtschaft-src pull origin feat/warenwirtschaft-v2" || \
  echo "Use scp/tar-pipe fallback per prior deploy pattern"
```

If a git-based deploy is not set up on the VPS, use the scp/tar-pipe pattern from memory observation #407. After sync:

```bash
ssh -i ~/.ssh/hostinger_ed25519 root@187.127.74.66 \
  "cd /opt/apps/warenwirtschaft && \
   docker compose build warenwirtschaft && \
   docker compose up -d warenwirtschaft"
```

- [ ] **Step 3: Apply migration 013 to production DB**

```bash
# Via supabase CLI if configured, or direct psql to the production DB URL.
psql "$PROD_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/013_lieferschein.sql
```

Verify: `select proname from pg_proc where proname = 'create_lieferschein';` returns one row; `select * from storage.buckets where id = 'lieferscheine';` returns one row.

- [ ] **Step 4: Verify in production**

Run the same smoke list (Step 1) against the production URL. Stop at any failure and file a follow-up.

- [ ] **Step 5: Optional — Save observation to memory**

If the feature is live, consider a short memory entry via claude-mem capturing the new route, RPC name, and bucket — useful for future cross-session work on this app.

---

## Done

Plan ends here. Follow-ups deliberately deferred to separate planning cycles:

- Dashboard filter "Geräte ohne SN" + batch-SN-complete flow
- Purchase history page showing `source_document_path` download link
- Nightly Storage GC for orphaned uploads (unreferenced `lieferscheine/*` files)
- Playwright E2E coverage
