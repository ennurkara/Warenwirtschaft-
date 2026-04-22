# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # next dev on :3000
npm run build     # production build
npm run start     # run built app
npm run lint      # eslint via next lint
```

No `test` script is defined. Run Jest directly:

```bash
npx jest                                    # full suite
npx jest __tests__/lib/category-columns     # single file
npx jest -t 'deriveDisplayStatus'           # by test name
node node_modules/typescript/bin/tsc --noEmit   # strict typecheck (no emit)
```

**Windows / Git Bash caveats** (this is the primary dev environment):
- If `next` is not on PATH, start the dev server with `node node_modules/next/dist/bin/next dev` instead of `npm run dev`.
- Jest output is sometimes silently suppressed in Git Bash and the exit code is unreliable. When in doubt, verify with `tsc --noEmit` and manual browser testing rather than trusting a silent pass.

## Environment

Copy `.env.local.example` → `.env.local`. Required keys:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client + server Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — only `/api/chat` uses this (bypasses RLS to build inventory context)
- `MISTRAL_API_KEY`, `OPENAI_API_KEY` — used by `/api/ocr` (Mistral for OCR → OpenAI for structuring) and `/api/chat`

## Architecture

### Stack
- Next.js 14 App Router, React 18, TypeScript strict mode
- Supabase: Postgres + Auth + Row Level Security (RLS) + Storage (`device-photos` bucket)
- `@supabase/ssr` for cookie-based session sync between middleware, server components, and the browser client
- Tailwind CSS + shadcn/ui (Radix primitives in `components/ui`)
- Path alias: `@/*` → project root (configured in `tsconfig.json` and `jest.config.ts`)

### Auth flow
`middleware.ts` gates everything: unauthenticated requests to anything other than `/login` redirect to `/login`; authenticated requests to `/login` redirect to `/dashboard`. Route groups encode the boundary:
- `app/(auth)/login` — public
- `app/(protected)/*` — protected; `app/(protected)/layout.tsx` additionally loads the `profiles` row and renders the navbar/chat FAB

Three Supabase clients — use the right one:
- `lib/supabase/server.ts` → server components, server actions, route handlers (reads cookies)
- `lib/supabase/client.ts` → `'use client'` components
- `createClient` from `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY` → only for trusted server work that must bypass RLS (`app/api/chat/route.ts`)

### Data model (see `supabase/migrations/` for the source of truth)

Migrations are numbered and applied **in order, manually via the Supabase SQL Editor** against the cloud-hosted project. There is no local Supabase instance or `supabase db push` flow wired up. Never assume a migration "ran" because it was committed — if you see PGRST errors or missing columns/tables, re-run the migration SQL idempotently.

Core relationships:
- `categories` → `models` ← `manufacturers` (catalog)
- `devices.model_id` → `models.id` (NOT NULL; models carry the category + manufacturer)
- `devices` ← `vectron_details` (1:1, Vectron-specific POS fields only)
- `purchases` → `purchase_items` → `devices` (one `purchase_item` per device, carries `ek_preis`)
- `sales` → `sale_items` → `devices` (one `sale_item` per device, carries `vk_preis`)
- `profiles.role` ∈ `{admin, mitarbeiter, viewer}` drives RLS write policies
- `models.default_ek` / `default_vk` / `default_supplier_id` and `manufacturers.default_supplier_id` feed `device-form.tsx` as **prefill** — model wins, manufacturer is fallback. Values are not copied to the DB at device creation; the actual `ek_preis` sits on `purchase_items` when the purchase is recorded.
- `v_incomplete_devices` (migration 010) lists devices with no `purchase_items` row. The dashboard widget reads this; only admins can open a device detail page and backfill the purchase. Mitarbeiter see the count but cannot act.

Devices have no `name` or `category_id` column — display name and category both come from the joined `model`. `devices.status` is `lager | reserviert | verkauft | defekt | ausgemustert`.

The canonical Supabase select is in `lib/inventory/queries.ts` (`DEVICE_SELECT`). When adding a joined table, add it there and make sure the FK exists — PostgREST embedded selects silently fail with `PGRST200` if the FK is missing.

### UI: category-driven columns
`lib/category-columns.ts` dispatches on category name to return a column set for device tables. `'Kassenhardware'` is special-cased to show Vectron-specific columns (SW-SN, Lizenz, Fiskal 2020, ZVT); `'Kabel'` and `'Sonstiges'` use a simplified column set; everything else uses the generic device columns. The device list (`components/inventory/device-list.tsx`) reads values from `vectron_details` and renders `'—'` when the row is null — do NOT render `false`/`'Light'` defaults for non-Vectron devices.

### UI: Vectron conditional fields
`components/inventory/device-form.tsx` gates Vectron fields on **two** conditions:
```
isKassenhardware && isVectron
```
`isKassenhardware` comes from the selected category name; `isVectron` comes from `selectedModel?.manufacturer?.name === 'Vectron'`. `model-picker.tsx` passes the full `Model` (with embedded `manufacturer`) back to the form so the manufacturer is known without a second round-trip. When the category changes, the form resets both `selectedModel` and `core.model_id` to avoid stale state.

### Role-gated UI
Role checks live in the components, not just in RLS. `components/layout/navbar.tsx` hides the Hersteller link for non-admins. `app/(protected)/inventory/[id]/page.tsx` gates the SellDialog and the admin-only Einkauf-backfill form on role + purchase presence. EK prices are hidden from mitarbeiter in device lists and detail views. When adding new admin-only actions, check `profile.role === 'admin'` in the component AND rely on RLS for the write — both layers are load-bearing.

### Server components by default, client components for interactivity
Pages under `app/(protected)/` are async server components that call `createClient()` from `lib/supabase/server.ts` and pass data to client components. Only components with `'use client'` (forms, dialogs, pickers, dashboard charts) talk to Supabase from the browser.

## Conventions

- **Language:** UI strings, toasts, labels, and SQL comments are in German. Keep new strings consistent.
- **Migrations are append-only and idempotent.** Every new migration gets the next number. Use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, and `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` for enums — a migration may need to be re-run against a partially-applied database.
- **Plans and specs live in `docs/superpowers/plans/` and `docs/superpowers/specs/`** (the writing-plans / subagent-driven-development skills output). Consult them for in-flight refactors before changing inventory domain code.
- **Active branch at the time of writing:** `feat/warenwirtschaft-v2`. Merging this branch is code-merge only — there is no deploy pipeline, so "merge" ≠ "go live."
