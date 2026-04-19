# Warenwirtschaftssystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Internes Warenwirtschaftssystem zur Verwaltung von Firmen-Endgeräten mit Foto-OCR, Bewegungshistorie und KI-Chatbot.

**Architecture:** Next.js 14 (App Router) auf Netlify als Frontend, Supabase für Datenbank/Auth/Storage, n8n (self-hosted) für OCR- und Chatbot-Workflows via OpenAI GPT-4o.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Supabase JS v2, n8n, OpenAI API

---

## Dateistruktur

```
warenwirtschaft/
├── app/
│   ├── (auth)/login/page.tsx           # Login-Seite
│   ├── (protected)/
│   │   ├── layout.tsx                  # Auth-Guard + Rollenprüfung
│   │   ├── dashboard/page.tsx          # Übersicht & Statistiken
│   │   ├── inventory/
│   │   │   ├── page.tsx                # Inventarliste mit Suche/Filter
│   │   │   ├── new/page.tsx            # Neues Gerät (manuell + OCR)
│   │   │   └── [id]/page.tsx           # Gerätedetail + Bearbeiten
│   │   ├── movements/page.tsx          # Bewegungshistorie
│   │   ├── chat/page.tsx               # Chatbot-Vollansicht
│   │   └── admin/
│   │       ├── users/page.tsx          # Benutzerverwaltung (Admin only)
│   │       └── categories/page.tsx     # Kategorien verwalten (Admin only)
│   ├── api/
│   │   ├── ocr/route.ts                # Proxy → n8n OCR-Webhook
│   │   └── chat/route.ts               # Proxy → n8n Chatbot-Webhook
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── layout/
│   │   ├── navbar.tsx                  # Navigation + User-Menü
│   │   └── chat-fab.tsx                # Floating Chatbot-Button
│   ├── inventory/
│   │   ├── device-list.tsx             # Tabelle mit Filter/Suche
│   │   ├── device-form.tsx             # Formular (neu + bearbeiten)
│   │   ├── ocr-upload.tsx              # Foto-Upload + OCR-Trigger
│   │   └── movement-dialog.tsx         # Entnahme/Einlagerung Dialog
│   ├── chat/
│   │   └── chat-window.tsx             # Chat-UI (Nachrichten + Input)
│   └── dashboard/
│       └── stats-cards.tsx             # Kennzahlen-Karten
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Browser-Client (singleton)
│   │   └── server.ts                   # Server-Client (per Request)
│   ├── types.ts                        # TypeScript-Typen (DB-Schema)
│   └── utils.ts                        # Hilfsfunktionen
├── middleware.ts                        # Next.js Auth-Middleware
├── supabase/migrations/
│   ├── 001_initial_schema.sql
│   └── 002_rls_policies.sql
├── n8n/
│   ├── workflow-ocr.json
│   └── workflow-chat.json
├── __tests__/
│   ├── lib/utils.test.ts
│   ├── api/ocr.test.ts
│   └── api/chat.test.ts
├── .env.local.example
├── netlify.toml
└── package.json
```

---

## Phase 1: Projekt-Setup

### Task 1: Next.js Projekt initialisieren

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`
- Create: `.env.local.example`
- Create: `netlify.toml`

- [ ] **Step 1: Next.js Projekt erstellen**

```bash
cd /Users/ennurkara/Projekte/warenwirtschaft
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir no --import-alias "@/*"
```

Expected: Projekt-Dateien werden erstellt, `npm run dev` startet ohne Fehler.

- [ ] **Step 2: shadcn/ui initialisieren**

```bash
npx shadcn@latest init
```

Wenn nach Style gefragt: `Default`. Base color: `Slate`. CSS variables: `Yes`.

- [ ] **Step 3: Benötigte shadcn-Komponenten installieren**

```bash
npx shadcn@latest add button input label card table badge dialog select textarea toast
```

- [ ] **Step 4: Supabase JS installieren**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 5: .env.local.example erstellen**

Erstelle `/Users/ennurkara/Projekte/warenwirtschaft/.env.local.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
N8N_OCR_WEBHOOK_URL=https://your-n8n.domain/webhook/ocr
N8N_OCR_WEBHOOK_SECRET=your-secret-token
N8N_CHAT_WEBHOOK_URL=https://your-n8n.domain/webhook/chat
N8N_CHAT_WEBHOOK_SECRET=your-secret-token
```

Kopiere zu `.env.local` und fülle die echten Werte ein.

- [ ] **Step 6: netlify.toml erstellen**

Erstelle `/Users/ennurkara/Projekte/warenwirtschaft/netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

```bash
npm install -D @netlify/plugin-nextjs
```

- [ ] **Step 7: Jest für Tests einrichten**

```bash
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom ts-jest
```

Erstelle `jest.config.ts`:

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
```

Erstelle `jest.setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 8: Git initialisieren und committen**

```bash
git init
echo "node_modules\n.next\n.env.local\n.env\n" > .gitignore
git add .
git commit -m "chore: initial Next.js project setup with shadcn, Supabase, Jest"
```

---

### Task 2: TypeScript-Typen definieren

**Files:**
- Create: `lib/types.ts`
- Create: `__tests__/lib/utils.test.ts`
- Create: `lib/utils.ts`

- [ ] **Step 1: Typen für das DB-Schema erstellen**

Erstelle `lib/types.ts`:

```typescript
export type UserRole = 'admin' | 'mitarbeiter' | 'viewer'
export type DeviceCondition = 'neu' | 'gebraucht'
export type DeviceStatus = 'lager' | 'im_einsatz' | 'defekt' | 'ausgemustert'
export type MovementAction = 'entnahme' | 'einlagerung' | 'defekt_gemeldet'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  created_at: string
}

export interface Category {
  id: string
  name: string
  icon: string | null
  created_at: string
}

export interface Device {
  id: string
  name: string
  category_id: string
  serial_number: string | null
  condition: DeviceCondition
  status: DeviceStatus
  quantity: number
  location: string | null
  photo_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  category?: Category
}

export interface DeviceMovement {
  id: string
  device_id: string
  user_id: string
  action: MovementAction
  quantity: number
  note: string | null
  created_at: string
  device?: Device
  profile?: Profile
}

export interface OcrResult {
  name: string | null
  serial_number: string | null
  manufacturer: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
```

- [ ] **Step 2: Failing test für utils schreiben**

Erstelle `__tests__/lib/utils.test.ts`:

```typescript
import { formatDate, getStatusLabel, getConditionLabel } from '@/lib/utils'

describe('formatDate', () => {
  it('formats ISO timestamp to German date', () => {
    expect(formatDate('2026-04-19T10:00:00Z')).toBe('19.04.2026')
  })
})

describe('getStatusLabel', () => {
  it('returns German label for lager', () => {
    expect(getStatusLabel('lager')).toBe('Im Lager')
  })
  it('returns German label for im_einsatz', () => {
    expect(getStatusLabel('im_einsatz')).toBe('Im Einsatz')
  })
  it('returns German label for defekt', () => {
    expect(getStatusLabel('defekt')).toBe('Defekt')
  })
  it('returns German label for ausgemustert', () => {
    expect(getStatusLabel('ausgemustert')).toBe('Ausgemustert')
  })
})

describe('getConditionLabel', () => {
  it('returns German label for neu', () => {
    expect(getConditionLabel('neu')).toBe('Neu')
  })
  it('returns German label for gebraucht', () => {
    expect(getConditionLabel('gebraucht')).toBe('Gebraucht')
  })
})
```

- [ ] **Step 3: Test ausführen — muss fehlschlagen**

```bash
npx jest __tests__/lib/utils.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/utils'"

- [ ] **Step 4: utils.ts implementieren**

Erstelle `lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { DeviceStatus, DeviceCondition } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function getStatusLabel(status: DeviceStatus): string {
  const labels: Record<DeviceStatus, string> = {
    lager: 'Im Lager',
    im_einsatz: 'Im Einsatz',
    defekt: 'Defekt',
    ausgemustert: 'Ausgemustert',
  }
  return labels[status]
}

export function getConditionLabel(condition: DeviceCondition): string {
  return condition === 'neu' ? 'Neu' : 'Gebraucht'
}
```

```bash
npm install clsx tailwind-merge
```

- [ ] **Step 5: Tests ausführen — müssen bestehen**

```bash
npx jest __tests__/lib/utils.test.ts
```

Expected: PASS (7 tests)

- [ ] **Step 6: Committen**

```bash
git add lib/types.ts lib/utils.ts __tests__/lib/utils.test.ts jest.config.ts jest.setup.ts
git commit -m "feat: add TypeScript types and utility functions"
```

---

## Phase 2: Supabase Setup

### Task 3: Datenbank-Migrationen erstellen

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/migrations/002_rls_policies.sql`

- [ ] **Step 1: Supabase CLI installieren (falls nicht vorhanden)**

```bash
brew install supabase/tap/supabase
```

- [ ] **Step 2: Migration 001 — Schema erstellen**

Erstelle `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enum-Typen
CREATE TYPE user_role AS ENUM ('admin', 'mitarbeiter', 'viewer');
CREATE TYPE device_condition AS ENUM ('neu', 'gebraucht');
CREATE TYPE device_status AS ENUM ('lager', 'im_einsatz', 'defekt', 'ausgemustert');
CREATE TYPE movement_action AS ENUM ('entnahme', 'einlagerung', 'defekt_gemeldet');

-- Benutzerprofile
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL,
  role        user_role NOT NULL DEFAULT 'viewer',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Trigger: Profil automatisch bei User-Registrierung anlegen
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.email), 'viewer');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Kategorien
CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  icon        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Standardkategorien
INSERT INTO categories (name, icon) VALUES
  ('Registrierkasse', 'cash-register'),
  ('Drucker', 'printer'),
  ('Scanner', 'scan'),
  ('Kabel', 'cable'),
  ('Monitor', 'monitor'),
  ('Tastatur', 'keyboard'),
  ('Maus', 'mouse-pointer'),
  ('Netzwerk', 'network'),
  ('Sonstiges', 'package');

-- Endgeräte
CREATE TABLE devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  category_id   uuid NOT NULL REFERENCES categories(id),
  serial_number text,
  condition     device_condition NOT NULL,
  status        device_status NOT NULL DEFAULT 'lager',
  quantity      integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  location      text,
  photo_url     text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Trigger: updated_at automatisch aktualisieren
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Bewegungshistorie
CREATE TABLE device_movements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id),
  action      movement_action NOT NULL,
  quantity    integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Storage Bucket für Geräte-Fotos
INSERT INTO storage.buckets (id, name, public) VALUES ('device-photos', 'device-photos', false);
```

- [ ] **Step 3: Migration 002 — RLS-Policies erstellen**

Erstelle `supabase/migrations/002_rls_policies.sql`:

```sql
-- RLS aktivieren
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_movements ENABLE ROW LEVEL SECURITY;

-- Hilfsfunktion: Rolle des aktuellen Nutzers
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles: Jeder sieht alle Profile, nur Admin kann Rollen ändern
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (role = (SELECT role FROM profiles WHERE id = auth.uid()));
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE TO authenticated USING (get_my_role() = 'admin');

-- categories: Alle dürfen lesen, nur Admin darf schreiben
CREATE POLICY "categories_select" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_insert" ON categories FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "categories_update" ON categories FOR UPDATE TO authenticated USING (get_my_role() = 'admin');
CREATE POLICY "categories_delete" ON categories FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- devices: Alle dürfen lesen, Admin+Mitarbeiter dürfen einfügen, nur Admin darf bearbeiten/löschen
CREATE POLICY "devices_select" ON devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "devices_insert" ON devices FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin', 'mitarbeiter'));
CREATE POLICY "devices_update" ON devices FOR UPDATE TO authenticated USING (get_my_role() = 'admin');
CREATE POLICY "devices_delete" ON devices FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- device_movements: Alle dürfen lesen, Admin+Mitarbeiter dürfen einfügen
CREATE POLICY "movements_select" ON device_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "movements_insert" ON device_movements FOR INSERT TO authenticated WITH CHECK (get_my_role() IN ('admin', 'mitarbeiter'));

-- Storage: Alle authentifizierten Nutzer können Fotos hochladen und lesen
CREATE POLICY "photos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'device-photos');
CREATE POLICY "photos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'device-photos' AND get_my_role() IN ('admin', 'mitarbeiter'));
CREATE POLICY "photos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'device-photos' AND get_my_role() = 'admin');
```

- [ ] **Step 4: Migrationen im Supabase Dashboard ausführen**

1. Öffne https://app.supabase.com → dein Projekt → SQL Editor
2. Füge den Inhalt von `001_initial_schema.sql` ein → Run
3. Füge den Inhalt von `002_rls_policies.sql` ein → Run
4. Prüfe unter Table Editor: `profiles`, `categories`, `devices`, `device_movements` vorhanden

- [ ] **Step 5: Committen**

```bash
git add supabase/
git commit -m "feat: add Supabase database migrations and RLS policies"
```

---

### Task 4: Supabase Client-Helfer

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Browser-Client erstellen**

Erstelle `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Server-Client erstellen**

Erstelle `lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Auth-Middleware erstellen**

Erstelle `middleware.ts` (im Projektstamm):

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isProtected = !isAuthPage && !request.nextUrl.pathname.startsWith('/_next')

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 4: Committen**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat: add Supabase client helpers and auth middleware"
```

---

## Phase 3: Auth

### Task 5: Login-Seite

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/layout.tsx` (aktualisieren)
- Create: `app/page.tsx` (Redirect)

- [ ] **Step 1: Root layout aktualisieren**

Ersetze `app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Warenwirtschaft',
  description: 'Firmen-Inventarverwaltung',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Root-Seite als Redirect**

Ersetze `app/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 3: Login-Seite erstellen**

Erstelle `app/(auth)/login/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast({ title: 'Anmeldung fehlgeschlagen', description: 'E-Mail oder Passwort falsch.', variant: 'destructive' })
      setIsLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Warenwirtschaft</CardTitle>
          <CardDescription>Melde dich mit deiner Firmen-E-Mail an.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Anmelden...' : 'Anmelden'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Dev-Server starten und Login testen**

```bash
npm run dev
```

Öffne http://localhost:3000 — sollte zu `/login` weiterleiten. Login mit einem Supabase-Testnutzer prüfen.

- [ ] **Step 5: Committen**

```bash
git add app/
git commit -m "feat: add login page with Supabase Auth"
```

---

### Task 6: Protected Layout + Navbar

**Files:**
- Create: `app/(protected)/layout.tsx`
- Create: `components/layout/navbar.tsx`

- [ ] **Step 1: Navbar-Komponente erstellen**

Erstelle `components/layout/navbar.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/inventory', label: 'Inventar' },
  { href: '/movements', label: 'Bewegungen' },
  { href: '/chat', label: 'Chatbot' },
]

export function Navbar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-slate-900">Warenwirtschaft</span>
          <div className="flex gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  pathname.startsWith(link.href)
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                {link.label}
              </Link>
            ))}
            {profile.role === 'admin' && (
              <Link
                href="/admin/users"
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  pathname.startsWith('/admin')
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                Admin
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{profile.full_name}</span>
          <Button variant="outline" size="sm" onClick={handleSignOut}>Abmelden</Button>
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Protected Layout erstellen**

Erstelle `app/(protected)/layout.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/navbar'
import { ChatFab } from '@/components/layout/chat-fab'
import type { Profile } from '@/lib/types'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar profile={profile as Profile} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
      <ChatFab />
    </div>
  )
}
```

- [ ] **Step 3: ChatFab Platzhalter erstellen**

Erstelle `components/layout/chat-fab.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MessageCircle } from 'lucide-react'

export function ChatFab() {
  return (
    <Link href="/chat" className="fixed bottom-6 right-6 z-50">
      <Button size="icon" className="h-14 w-14 rounded-full shadow-lg">
        <MessageCircle className="h-6 w-6" />
      </Button>
    </Link>
  )
}
```

```bash
npm install lucide-react
```

- [ ] **Step 4: Committen**

```bash
git add app/(protected)/ components/layout/
git commit -m "feat: add protected layout with navbar and chat FAB"
```

---

## Phase 4: Inventar

### Task 7: Inventarliste

**Files:**
- Create: `app/(protected)/inventory/page.tsx`
- Create: `components/inventory/device-list.tsx`

- [ ] **Step 1: Device-List Komponente erstellen**

Erstelle `components/inventory/device-list.tsx`:

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getStatusLabel, getConditionLabel, formatDate } from '@/lib/utils'
import type { Device, Category, DeviceStatus } from '@/lib/types'

const STATUS_COLORS: Record<DeviceStatus, string> = {
  lager: 'bg-green-100 text-green-800',
  im_einsatz: 'bg-blue-100 text-blue-800',
  defekt: 'bg-red-100 text-red-800',
  ausgemustert: 'bg-slate-100 text-slate-800',
}

interface DeviceListProps {
  devices: Device[]
  categories: Category[]
  canAdd: boolean
}

export function DeviceList({ devices, categories, canAdd }: DeviceListProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = devices.filter(d => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.serial_number ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || d.category_id === categoryFilter
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventar</h1>
        {canAdd && (
          <Link href="/inventory/new">
            <Button>Gerät hinzufügen</Button>
          </Link>
        )}
      </div>
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Nach Name oder Seriennummer suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="lager">Im Lager</SelectItem>
            <SelectItem value="im_einsatz">Im Einsatz</SelectItem>
            <SelectItem value="defekt">Defekt</SelectItem>
            <SelectItem value="ausgemustert">Ausgemustert</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Seriennummer</TableHead>
              <TableHead>Zustand</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Menge</TableHead>
              <TableHead>Standort</TableHead>
              <TableHead>Hinzugefügt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                  Keine Geräte gefunden.
                </TableCell>
              </TableRow>
            )}
            {filtered.map(device => (
              <TableRow key={device.id} className="cursor-pointer hover:bg-slate-50">
                <TableCell>
                  <Link href={`/inventory/${device.id}`} className="font-medium hover:underline">
                    {device.name}
                  </Link>
                </TableCell>
                <TableCell>{device.category?.name ?? '—'}</TableCell>
                <TableCell className="font-mono text-sm">{device.serial_number ?? '—'}</TableCell>
                <TableCell>{getConditionLabel(device.condition)}</TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[device.status]}>
                    {getStatusLabel(device.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{device.quantity}</TableCell>
                <TableCell>{device.location ?? '—'}</TableCell>
                <TableCell>{formatDate(device.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Inventarliste-Seite erstellen**

Erstelle `app/(protected)/inventory/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { DeviceList } from '@/components/inventory/device-list'
import type { Device, Category, Profile } from '@/lib/types'

export default async function InventoryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  const [{ data: devices }, { data: categories }] = await Promise.all([
    supabase.from('devices').select('*, category:categories(*)').order('created_at', { ascending: false }),
    supabase.from('categories').select('*').order('name'),
  ])

  const canAdd = (profile as Profile)?.role !== 'viewer'

  return (
    <DeviceList
      devices={(devices ?? []) as Device[]}
      categories={(categories ?? []) as Category[]}
      canAdd={canAdd}
    />
  )
}
```

- [ ] **Step 3: Im Browser prüfen**

Navigiere zu http://localhost:3000/inventory — Tabelle sollte erscheinen (noch leer).

- [ ] **Step 4: Committen**

```bash
git add app/(protected)/inventory/page.tsx components/inventory/device-list.tsx
git commit -m "feat: add inventory list page with search and filters"
```

---

### Task 8: Gerät-Formular (manuell hinzufügen)

**Files:**
- Create: `components/inventory/device-form.tsx`
- Create: `app/(protected)/inventory/new/page.tsx`
- Create: `app/(protected)/inventory/[id]/page.tsx`

- [ ] **Step 1: Device-Form Komponente erstellen**

Erstelle `components/inventory/device-form.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { Category, Device, DeviceCondition, DeviceStatus } from '@/lib/types'

interface DeviceFormProps {
  categories: Category[]
  device?: Device
  isAdmin: boolean
  prefill?: { name?: string; serial_number?: string }
}

export function DeviceForm({ categories, device, isAdmin, prefill }: DeviceFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)

  const [form, setForm] = useState({
    name: prefill?.name ?? device?.name ?? '',
    category_id: device?.category_id ?? '',
    serial_number: prefill?.serial_number ?? device?.serial_number ?? '',
    condition: (device?.condition ?? 'neu') as DeviceCondition,
    status: (device?.status ?? 'lager') as DeviceStatus,
    quantity: device?.quantity ?? 1,
    location: device?.location ?? '',
    notes: device?.notes ?? '',
  })

  function set(key: string, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    const payload = {
      name: form.name,
      category_id: form.category_id,
      serial_number: form.serial_number || null,
      condition: form.condition,
      status: form.status,
      quantity: Number(form.quantity),
      location: form.location || null,
      notes: form.notes || null,
    }

    if (device) {
      const { error } = await supabase.from('devices').update(payload).eq('id', device.id)
      if (error) {
        toast({ title: 'Fehler beim Speichern', description: error.message, variant: 'destructive' })
        setIsLoading(false)
        return
      }
      toast({ title: 'Gerät aktualisiert' })
    } else {
      const { error } = await supabase.from('devices').insert(payload)
      if (error) {
        toast({ title: 'Fehler beim Erstellen', description: error.message, variant: 'destructive' })
        setIsLoading(false)
        return
      }
      toast({ title: 'Gerät hinzugefügt' })
    }

    router.push('/inventory')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="name">Gerätename *</Label>
          <Input id="name" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Kategorie *</Label>
          <Select value={form.category_id} onValueChange={v => set('category_id', v)} required>
            <SelectTrigger id="category">
              <SelectValue placeholder="Kategorie wählen..." />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="serial">Seriennummer</Label>
          <Input id="serial" value={form.serial_number} onChange={e => set('serial_number', e.target.value)} className="font-mono" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="condition">Zustand *</Label>
          <Select value={form.condition} onValueChange={v => set('condition', v as DeviceCondition)}>
            <SelectTrigger id="condition"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="neu">Neu</SelectItem>
              <SelectItem value="gebraucht">Gebraucht</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v as DeviceStatus)}>
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lager">Im Lager</SelectItem>
                <SelectItem value="im_einsatz">Im Einsatz</SelectItem>
                <SelectItem value="defekt">Defekt</SelectItem>
                <SelectItem value="ausgemustert">Ausgemustert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="quantity">Menge *</Label>
          <Input id="quantity" type="number" min="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} required />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="location">Standort</Label>
          <Input id="location" placeholder="z.B. Lager Raum 2, Regal B3" value={form.location} onChange={e => set('location', e.target.value)} />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="notes">Notizen</Label>
          <Textarea id="notes" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading}>{isLoading ? 'Speichern...' : (device ? 'Aktualisieren' : 'Hinzufügen')}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Abbrechen</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: "Neues Gerät"-Seite (Platzhalter, wird in Task 9 mit OCR erweitert)**

Erstelle `app/(protected)/inventory/new/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DeviceForm } from '@/components/inventory/device-form'
import type { Category, Profile } from '@/lib/types'

export default async function NewDevicePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  if ((profile as Profile)?.role === 'viewer') redirect('/inventory')

  const { data: categories } = await supabase.from('categories').select('*').order('name')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Neues Gerät hinzufügen</h1>
      <DeviceForm
        categories={(categories ?? []) as Category[]}
        isAdmin={(profile as Profile)?.role === 'admin'}
      />
    </div>
  )
}
```

- [ ] **Step 3: Gerätedetail-Seite erstellen**

Erstelle `app/(protected)/inventory/[id]/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DeviceForm } from '@/components/inventory/device-form'
import { MovementDialog } from '@/components/inventory/movement-dialog'
import { Badge } from '@/components/ui/badge'
import { formatDate, getStatusLabel, getConditionLabel } from '@/lib/utils'
import type { Device, Category, Profile, DeviceMovement } from '@/lib/types'

export default async function DeviceDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  const [{ data: device }, { data: categories }, { data: movements }] = await Promise.all([
    supabase.from('devices').select('*, category:categories(*)').eq('id', params.id).single(),
    supabase.from('categories').select('*').order('name'),
    supabase.from('device_movements')
      .select('*, profile:profiles(full_name)')
      .eq('device_id', params.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!device) notFound()

  const isAdmin = (profile as Profile)?.role === 'admin'
  const canMove = (profile as Profile)?.role !== 'viewer'

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{device.name}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {device.category?.name} · {getConditionLabel(device.condition)} · Menge: {device.quantity}
          </p>
        </div>
        {canMove && (
          <MovementDialog device={device as Device} />
        )}
      </div>

      {device.photo_url && (
        <img src={device.photo_url} alt={device.name} className="rounded-lg max-h-48 object-contain border" />
      )}

      {isAdmin && (
        <div>
          <h2 className="text-lg font-medium mb-4">Gerät bearbeiten</h2>
          <DeviceForm
            categories={(categories ?? []) as Category[]}
            device={device as Device}
            isAdmin={isAdmin}
          />
        </div>
      )}

      <div>
        <h2 className="text-lg font-medium mb-3">Bewegungshistorie</h2>
        {(movements ?? []).length === 0 ? (
          <p className="text-slate-500 text-sm">Keine Bewegungen aufgezeichnet.</p>
        ) : (
          <ul className="space-y-2">
            {(movements as DeviceMovement[]).map(m => (
              <li key={m.id} className="flex items-center gap-3 text-sm border rounded-md px-4 py-2 bg-white">
                <Badge variant={m.action === 'entnahme' ? 'destructive' : 'default'}>
                  {m.action === 'entnahme' ? 'Entnahme' : m.action === 'einlagerung' ? 'Einlagerung' : 'Defekt'}
                </Badge>
                <span>{m.quantity}x</span>
                <span className="text-slate-500">von {m.profile?.full_name}</span>
                <span className="ml-auto text-slate-400">{formatDate(m.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: MovementDialog Platzhalter (wird in Task 10 implementiert)**

Erstelle `components/inventory/movement-dialog.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { Device, MovementAction } from '@/lib/types'

export function MovementDialog({ device }: { device: Device }) {
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<MovementAction>('entnahme')
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error: movErr } = await supabase.from('device_movements').insert({
      device_id: device.id,
      user_id: user!.id,
      action,
      quantity,
      note: note || null,
    })

    if (movErr) {
      toast({ title: 'Fehler', description: movErr.message, variant: 'destructive' })
      setIsLoading(false)
      return
    }

    const delta = action === 'entnahme' ? -quantity : action === 'einlagerung' ? quantity : 0
    if (delta !== 0) {
      await supabase.from('devices').update({ quantity: device.quantity + delta }).eq('id', device.id)
    }
    if (action === 'defekt_gemeldet') {
      await supabase.from('devices').update({ status: 'defekt' }).eq('id', device.id)
    }

    toast({ title: 'Buchung erfolgreich' })
    setOpen(false)
    router.refresh()
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Buchung erstellen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bewegung buchen — {device.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Aktion</Label>
            <Select value={action} onValueChange={v => setAction(v as MovementAction)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entnahme">Entnahme</SelectItem>
                <SelectItem value="einlagerung">Einlagerung</SelectItem>
                <SelectItem value="defekt_gemeldet">Defekt melden</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Menge</Label>
            <Input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Notiz (optional)</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Buchen...' : 'Buchen'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

```bash
npx shadcn@latest add dialog
```

- [ ] **Step 5: Committen**

```bash
git add app/(protected)/inventory/ components/inventory/
git commit -m "feat: add device form, detail page, and movement dialog"
```

---

## Phase 5: Foto-OCR

### Task 9: OCR-Upload Komponente + n8n Workflow 1

**Files:**
- Create: `components/inventory/ocr-upload.tsx`
- Modify: `app/(protected)/inventory/new/page.tsx`
- Create: `app/api/ocr/route.ts`
- Create: `n8n/workflow-ocr.json`
- Create: `__tests__/api/ocr.test.ts`

- [ ] **Step 1: Failing test für OCR-API-Route schreiben**

Erstelle `__tests__/api/ocr.test.ts`:

```typescript
import { POST } from '@/app/api/ocr/route'
import { NextRequest } from 'next/server'

global.fetch = jest.fn()

describe('POST /api/ocr', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 if no image provided', async () => {
    const req = new NextRequest('http://localhost/api/ocr', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('forwards image to n8n and returns result', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Epson Printer', serial_number: 'SN123', manufacturer: 'Epson' }),
    })
    const req = new NextRequest('http://localhost/api/ocr', {
      method: 'POST',
      body: JSON.stringify({ image: 'base64data' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('Epson Printer')
  })
})
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

```bash
npx jest __tests__/api/ocr.test.ts
```

Expected: FAIL

- [ ] **Step 3: OCR API-Route implementieren**

Erstelle `app/api/ocr/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.image) {
    return NextResponse.json({ error: 'image required' }, { status: 400 })
  }

  const n8nUrl = process.env.N8N_OCR_WEBHOOK_URL
  const secret = process.env.N8N_OCR_WEBHOOK_SECRET

  const response = await fetch(n8nUrl!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': secret ?? '',
    },
    body: JSON.stringify({ image: body.image }),
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'OCR service error' }, { status: 502 })
  }

  const data = await response.json()
  return NextResponse.json(data)
}
```

- [ ] **Step 4: Tests ausführen — müssen bestehen**

```bash
npx jest __tests__/api/ocr.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: OCR-Upload Komponente erstellen**

Erstelle `components/inventory/ocr-upload.tsx`:

```typescript
'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, Upload, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { OcrResult } from '@/lib/types'

interface OcrUploadProps {
  onResult: (result: OcrResult) => void
}

export function OcrUpload({ onResult }: OcrUploadProps) {
  const [isLoading, setIsLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  async function handleFile(file: File) {
    setIsLoading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      try {
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        })
        if (!res.ok) throw new Error('OCR fehlgeschlagen')
        const data: OcrResult = await res.json()
        onResult(data)
        toast({ title: 'Gerät erkannt', description: `${data.name ?? 'Unbekannt'} gefunden` })
      } catch {
        toast({ title: 'OCR fehlgeschlagen', description: 'Bitte Daten manuell eingeben.', variant: 'destructive' })
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center space-y-3">
      <p className="text-slate-500 text-sm">Foto des Geräts oder Etiketts aufnehmen/hochladen</p>
      <div className="flex justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
          Foto hochladen
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (fileRef.current) {
              fileRef.current.setAttribute('capture', 'environment')
              fileRef.current.click()
            }
          }}
          disabled={isLoading}
        >
          <Camera className="h-4 w-4 mr-2" />
          Kamera
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  )
}
```

- [ ] **Step 6: "Neues Gerät"-Seite mit OCR erweitern**

Ersetze `app/(protected)/inventory/new/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OcrUpload } from '@/components/inventory/ocr-upload'
import { DeviceForm } from '@/components/inventory/device-form'
import type { Category, OcrResult } from '@/lib/types'
import { useEffect } from 'react'

// Dieser Client-Wrapper lädt Kategorien und rendert OCR + Form
export default function NewDevicePage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [prefill, setPrefill] = useState<{ name?: string; serial_number?: string }>({})
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
      if (profile?.role === 'viewer') { router.push('/inventory'); return }
      setIsAdmin(profile?.role === 'admin')
      const { data: cats } = await supabase.from('categories').select('*').order('name')
      setCategories(cats ?? [])
    }
    load()
  }, [])

  function handleOcrResult(result: OcrResult) {
    setPrefill({ name: result.name ?? undefined, serial_number: result.serial_number ?? undefined })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Neues Gerät hinzufügen</h1>
      <OcrUpload onResult={handleOcrResult} />
      {Object.keys(prefill).length > 0 && (
        <p className="text-sm text-green-600">Daten per OCR erkannt — bitte prüfen und bestätigen.</p>
      )}
      <DeviceForm categories={categories} isAdmin={isAdmin} prefill={prefill} />
    </div>
  )
}
```

- [ ] **Step 7: n8n OCR-Workflow JSON exportieren**

Erstelle `n8n/workflow-ocr.json`:

```json
{
  "name": "OCR - Gerät erkennen",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "ocr",
        "responseMode": "lastNode",
        "options": {}
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [240, 300]
    },
    {
      "parameters": {
        "resource": "chat",
        "operation": "create",
        "modelId": "gpt-4o",
        "messages": {
          "values": [
            {
              "role": "user",
              "content": "=Analysiere dieses Bild eines Geräts oder Etiketts. Extrahiere: Produktname, Seriennummer, Hersteller. Antworte ausschließlich als JSON ohne Markdown: { \"name\": \"...\", \"serial_number\": \"...\", \"manufacturer\": \"...\" }. Falls ein Feld nicht erkennbar ist, setze null. Bild (base64): {{ $json.body.image }}"
            }
          ]
        },
        "options": {
          "maxTokens": 200
        }
      },
      "name": "OpenAI",
      "type": "@n8n/n8n-nodes-langchain.openAi",
      "position": [460, 300]
    },
    {
      "parameters": {
        "jsCode": "const text = $input.first().json.choices[0].message.content;\ntry {\n  return [{ json: JSON.parse(text) }];\n} catch {\n  return [{ json: { name: null, serial_number: null, manufacturer: null } }];\n}"
      },
      "name": "JSON parsen",
      "type": "n8n-nodes-base.code",
      "position": [680, 300]
    }
  ],
  "connections": {
    "Webhook": { "main": [[{ "node": "OpenAI", "type": "main", "index": 0 }]] },
    "OpenAI": { "main": [[{ "node": "JSON parsen", "type": "main", "index": 0 }]] }
  }
}
```

**n8n einrichten:**
1. Öffne dein n8n → Import Workflow → `n8n/workflow-ocr.json` einfügen
2. OpenAI-Credential hinterlegen
3. Webhook-URL kopieren → in `.env.local` als `N8N_OCR_WEBHOOK_URL` eintragen
4. Workflow aktivieren

- [ ] **Step 8: Committen**

```bash
git add app/api/ocr/ components/inventory/ocr-upload.tsx app/(protected)/inventory/new/ n8n/ __tests__/api/ocr.test.ts
git commit -m "feat: add photo OCR upload with n8n workflow"
```

---

## Phase 6: Bewegungshistorie

### Task 10: Bewegungshistorie-Seite

**Files:**
- Create: `app/(protected)/movements/page.tsx`

- [ ] **Step 1: Movements-Seite erstellen**

Erstelle `app/(protected)/movements/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { DeviceMovement } from '@/lib/types'

export default async function MovementsPage() {
  const supabase = await createClient()

  const { data: movements } = await supabase
    .from('device_movements')
    .select('*, device:devices(name), profile:profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Bewegungshistorie</h1>
      <div className="rounded-md border bg-white divide-y">
        {(movements ?? []).length === 0 && (
          <p className="text-slate-500 text-sm p-6">Keine Bewegungen vorhanden.</p>
        )}
        {(movements as DeviceMovement[]).map(m => (
          <div key={m.id} className="flex items-center gap-4 px-4 py-3 text-sm">
            <Badge variant={m.action === 'entnahme' ? 'destructive' : 'default'}>
              {m.action === 'entnahme' ? 'Entnahme' : m.action === 'einlagerung' ? 'Einlagerung' : 'Defekt'}
            </Badge>
            <span className="font-medium">{m.device?.name}</span>
            <span className="text-slate-500">{m.quantity}x</span>
            <span className="text-slate-500">von {m.profile?.full_name}</span>
            {m.note && <span className="text-slate-400 italic">„{m.note}"</span>}
            <span className="ml-auto text-slate-400">{formatDate(m.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Committen**

```bash
git add app/(protected)/movements/
git commit -m "feat: add movement history page"
```

---

## Phase 7: Dashboard

### Task 11: Dashboard mit Statistiken

**Files:**
- Create: `app/(protected)/dashboard/page.tsx`
- Create: `components/dashboard/stats-cards.tsx`

- [ ] **Step 1: Stats-Cards Komponente**

Erstelle `components/dashboard/stats-cards.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Stat {
  title: string
  value: number | string
  description: string
}

export function StatsCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map(stat => (
        <Card key={stat.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">{stat.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-slate-500 mt-1">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Dashboard-Seite erstellen**

Erstelle `app/(protected)/dashboard/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { DeviceMovement } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: totalDevices },
    { count: inStock },
    { count: defective },
    { data: recentMovements },
    { data: categories },
  ] = await Promise.all([
    supabase.from('devices').select('*', { count: 'exact', head: true }),
    supabase.from('devices').select('*', { count: 'exact', head: true }).eq('status', 'lager'),
    supabase.from('devices').select('*', { count: 'exact', head: true }).eq('status', 'defekt'),
    supabase.from('device_movements')
      .select('*, device:devices(name), profile:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('categories').select('id, name, devices(count)'),
  ])

  const stats = [
    { title: 'Geräte gesamt', value: totalDevices ?? 0, description: 'alle Einträge' },
    { title: 'Im Lager', value: inStock ?? 0, description: 'verfügbar' },
    { title: 'Defekt', value: defective ?? 0, description: 'benötigen Wartung' },
    { title: 'Kategorien', value: categories?.length ?? 0, description: 'Gerätetypen' },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <StatsCards stats={stats} />
      <div>
        <h2 className="text-lg font-medium mb-3">Letzte Bewegungen</h2>
        <div className="rounded-md border bg-white divide-y">
          {(recentMovements ?? []).length === 0 && (
            <p className="text-slate-500 text-sm p-6">Noch keine Bewegungen.</p>
          )}
          {(recentMovements as DeviceMovement[]).map(m => (
            <div key={m.id} className="flex items-center gap-4 px-4 py-3 text-sm">
              <Badge variant={m.action === 'entnahme' ? 'destructive' : 'default'}>
                {m.action === 'entnahme' ? 'Entnahme' : m.action === 'einlagerung' ? 'Einlagerung' : 'Defekt'}
              </Badge>
              <span>{m.device?.name}</span>
              <span className="text-slate-500">von {m.profile?.full_name}</span>
              <span className="ml-auto text-slate-400">{formatDate(m.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Committen**

```bash
git add app/(protected)/dashboard/ components/dashboard/
git commit -m "feat: add dashboard with inventory statistics"
```

---

## Phase 8: Chatbot

### Task 12: Chat-API + n8n Workflow 2

**Files:**
- Create: `app/api/chat/route.ts`
- Create: `n8n/workflow-chat.json`
- Create: `__tests__/api/chat.test.ts`

- [ ] **Step 1: Failing test für Chat-API schreiben**

Erstelle `__tests__/api/chat.test.ts`:

```typescript
import { POST } from '@/app/api/chat/route'
import { NextRequest } from 'next/server'

global.fetch = jest.fn()

describe('POST /api/chat', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 if no message provided', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('forwards message to n8n and returns reply', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'Ihr habt 3 Drucker im Lager.' }),
    })
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: 'Wie viele Drucker?' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.reply).toBe('Ihr habt 3 Drucker im Lager.')
  })
})
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

```bash
npx jest __tests__/api/chat.test.ts
```

Expected: FAIL

- [ ] **Step 3: Chat API-Route implementieren**

Erstelle `app/api/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const n8nUrl = process.env.N8N_CHAT_WEBHOOK_URL
  const secret = process.env.N8N_CHAT_WEBHOOK_SECRET

  const response = await fetch(n8nUrl!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': secret ?? '',
    },
    body: JSON.stringify({ message: body.message }),
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Chat service error' }, { status: 502 })
  }

  const data = await response.json()
  return NextResponse.json(data)
}
```

- [ ] **Step 4: Tests ausführen — müssen bestehen**

```bash
npx jest __tests__/api/chat.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: n8n Chatbot-Workflow JSON erstellen**

Erstelle `n8n/workflow-chat.json`:

```json
{
  "name": "Chatbot - Inventar Assistent",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "chat",
        "responseMode": "lastNode",
        "options": {}
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [240, 300]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT d.name, d.quantity, d.status, d.condition, d.location, d.serial_number, c.name as category FROM devices d LEFT JOIN categories c ON d.category_id = c.id WHERE d.status != 'ausgemustert' ORDER BY c.name, d.name"
      },
      "name": "Inventar laden",
      "type": "n8n-nodes-base.postgres",
      "position": [460, 200]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT dm.action, dm.quantity, dm.created_at, d.name as device_name, p.full_name FROM device_movements dm JOIN devices d ON dm.device_id = d.id JOIN profiles p ON dm.user_id = p.id ORDER BY dm.created_at DESC LIMIT 20"
      },
      "name": "Bewegungen laden",
      "type": "n8n-nodes-base.postgres",
      "position": [460, 400]
    },
    {
      "parameters": {
        "resource": "chat",
        "operation": "create",
        "modelId": "gpt-4o",
        "messages": {
          "values": [
            {
              "role": "system",
              "content": "=Du bist ein freundlicher Lager-Assistent für ein Warenwirtschaftssystem. Beantworte Fragen zum Inventar auf Deutsch. Antworte immer im JSON-Format: { \"reply\": \"...\" }.\n\nAktueller Inventarstand:\n{{ JSON.stringify($node['Inventar laden'].json, null, 2) }}\n\nLetzte Bewegungen:\n{{ JSON.stringify($node['Bewegungen laden'].json, null, 2) }}"
            },
            {
              "role": "user",
              "content": "={{ $node['Webhook'].json.body.message }}"
            }
          ]
        },
        "options": { "maxTokens": 500 }
      },
      "name": "GPT-4o",
      "type": "@n8n/n8n-nodes-langchain.openAi",
      "position": [680, 300]
    },
    {
      "parameters": {
        "jsCode": "const text = $input.first().json.choices[0].message.content;\ntry {\n  return [{ json: JSON.parse(text) }];\n} catch {\n  return [{ json: { reply: text } }];\n}"
      },
      "name": "JSON parsen",
      "type": "n8n-nodes-base.code",
      "position": [900, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [{ "node": "Inventar laden", "type": "main", "index": 0 }],
        [{ "node": "Bewegungen laden", "type": "main", "index": 0 }]
      ]
    },
    "Inventar laden": { "main": [[{ "node": "GPT-4o", "type": "main", "index": 0 }]] },
    "Bewegungen laden": { "main": [[{ "node": "GPT-4o", "type": "main", "index": 1 }]] },
    "GPT-4o": { "main": [[{ "node": "JSON parsen", "type": "main", "index": 0 }]] }
  }
}
```

**n8n einrichten:**
1. Import Workflow → `n8n/workflow-chat.json`
2. PostgreSQL-Credential für Supabase hinterlegen (Host: `db.YOUR_PROJECT.supabase.co`, Port: `5432`, DB: `postgres`, User: `postgres`, Password: dein DB-Passwort aus Supabase Settings)
3. OpenAI-Credential hinterlegen
4. Webhook-URL kopieren → `.env.local` als `N8N_CHAT_WEBHOOK_URL` eintragen
5. Workflow aktivieren

- [ ] **Step 6: Committen**

```bash
git add app/api/chat/ n8n/workflow-chat.json __tests__/api/chat.test.ts
git commit -m "feat: add chat API route and n8n chatbot workflow"
```

---

### Task 13: Chatbot-UI

**Files:**
- Create: `components/chat/chat-window.tsx`
- Create: `app/(protected)/chat/page.tsx`

- [ ] **Step 1: Chat-Window Komponente erstellen**

Erstelle `components/chat/chat-window.tsx`:

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/types'

const STARTER_QUESTIONS = [
  'Wie viele Geräte haben wir insgesamt?',
  'Welche Geräte sind im Lager?',
  'Zeig mir alle defekten Geräte.',
  'Was wurde diese Woche entnommen?',
]

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hallo! Ich bin dein Lager-Assistent. Was möchtest du über dein Inventar wissen?' },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return
    const userMessage: ChatMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Keine Antwort erhalten.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Fehler beim Verbinden mit dem Assistenten.' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] border rounded-lg bg-white overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div className={cn(
              'max-w-[75%] rounded-2xl px-4 py-2 text-sm',
              msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'
            )}>
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-slate-100 rounded-2xl px-4 py-2 text-sm text-slate-500">Denkt nach...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          {STARTER_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="text-xs border rounded-full px-3 py-1 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Frage stellen..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Chat-Seite erstellen**

Erstelle `app/(protected)/chat/page.tsx`:

```typescript
import { ChatWindow } from '@/components/chat/chat-window'

export default function ChatPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Lager-Assistent</h1>
      <ChatWindow />
    </div>
  )
}
```

- [ ] **Step 3: Committen**

```bash
git add components/chat/ app/(protected)/chat/
git commit -m "feat: add chatbot UI with starter questions"
```

---

## Phase 9: Admin-Bereich

### Task 14: Benutzerverwaltung (Admin)

**Files:**
- Create: `app/(protected)/admin/users/page.tsx`

- [ ] **Step 1: Users-Admin-Seite erstellen**

Erstelle `app/(protected)/admin/users/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UserRoleSelect } from './user-role-select'
import type { Profile } from '@/lib/types'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: profiles } = await supabase.from('profiles').select('*').order('full_name')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Benutzerverwaltung</h1>
      <div className="rounded-md border bg-white divide-y">
        {(profiles as Profile[]).map(p => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{p.full_name}</p>
              <p className="text-sm text-slate-500">{p.id}</p>
            </div>
            <UserRoleSelect profile={p} currentUserId={user!.id} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: UserRoleSelect Client-Komponente erstellen**

Erstelle `app/(protected)/admin/users/user-role-select.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import type { Profile, UserRole } from '@/lib/types'

export function UserRoleSelect({ profile, currentUserId }: { profile: Profile; currentUserId: string }) {
  const [role, setRole] = useState<UserRole>(profile.role)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  async function handleChange(newRole: UserRole) {
    setRole(newRole)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profile.id)
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' })
      setRole(profile.role)
      return
    }
    toast({ title: 'Rolle aktualisiert' })
    router.refresh()
  }

  return (
    <Select value={role} onValueChange={v => handleChange(v as UserRole)} disabled={profile.id === currentUserId}>
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="mitarbeiter">Mitarbeiter</SelectItem>
        <SelectItem value="viewer">Viewer</SelectItem>
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 3: Committen**

```bash
git add app/(protected)/admin/users/
git commit -m "feat: add admin user management page"
```

---

### Task 15: Kategorien-Verwaltung (Admin)

**Files:**
- Create: `app/(protected)/admin/categories/page.tsx`

- [ ] **Step 1: Categories-Admin-Seite erstellen**

Erstelle `app/(protected)/admin/categories/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import type { Category } from '@/lib/types'

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [newName, setNewName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => setCategories(data ?? []))
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setIsLoading(true)
    const { error } = await supabase.from('categories').insert({ name: newName.trim() })
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Kategorie hinzugefügt' })
      setNewName('')
      router.refresh()
      const { data } = await supabase.from('categories').select('*').order('name')
      setCategories(data ?? [])
    }
    setIsLoading(false)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) {
      toast({ title: 'Fehler', description: 'Kategorie wird noch verwendet.', variant: 'destructive' })
      return
    }
    setCategories(prev => prev.filter(c => c.id !== id))
    toast({ title: 'Kategorie gelöscht' })
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-semibold">Kategorien</h1>
      <form onSubmit={handleAdd} className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="new-cat">Neue Kategorie</Label>
          <Input id="new-cat" value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. Headset" />
        </div>
        <Button type="submit" disabled={isLoading} className="self-end">Hinzufügen</Button>
      </form>
      <div className="rounded-md border bg-white divide-y">
        {categories.map(c => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3">
            <span>{c.name}</span>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700">
              Löschen
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Committen**

```bash
git add app/(protected)/admin/categories/
git commit -m "feat: add admin categories management page"
```

---

## Phase 10: Deployment

### Task 16: Netlify Deployment

**Files:**
- Modify: `netlify.toml`
- Create: `.env.local` (nur lokal, nicht committen)

- [ ] **Step 1: Alle Tests ausführen**

```bash
npx jest --coverage
```

Expected: Alle Tests bestehen, Coverage-Report angezeigt.

- [ ] **Step 2: Production Build testen**

```bash
npm run build
```

Expected: Kein Fehler. `.next` Ordner wird erstellt.

- [ ] **Step 3: GitHub Repository erstellen und pushen**

```bash
git remote add origin https://github.com/ennurkara/warenwirtschaft.git
git push -u origin main
```

- [ ] **Step 4: Netlify verknüpfen**

1. https://app.netlify.com → "Add new site" → "Import an existing project"
2. GitHub-Repo `warenwirtschaft` auswählen
3. Build command: `npm run build`
4. Publish directory: `.next`
5. Plugin `@netlify/plugin-nextjs` wird automatisch erkannt

- [ ] **Step 5: Umgebungsvariablen in Netlify eintragen**

In Netlify → Site Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
N8N_OCR_WEBHOOK_URL=...
N8N_OCR_WEBHOOK_SECRET=...
N8N_CHAT_WEBHOOK_URL=...
N8N_CHAT_WEBHOOK_SECRET=...
```

- [ ] **Step 6: Deploy auslösen und testen**

1. Netlify → "Trigger deploy" → "Deploy site"
2. Build-Log beobachten
3. Nach erfolgreichem Deploy: Live-URL öffnen
4. Login testen, Gerät hinzufügen, OCR testen, Chatbot fragen

- [ ] **Step 7: Ersten Admin-Nutzer anlegen**

1. Supabase Dashboard → Authentication → Users → "Invite user"
2. E-Mail `ennurkara@gmail.com` einladen
3. Nach Registrierung: SQL Editor → `UPDATE profiles SET role = 'admin' WHERE id = '<user-id>';`

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "chore: final deployment configuration"
```

---

## Zusammenfassung

| Phase | Aufgaben | Ergebnis |
|---|---|---|
| 1 | Setup | Next.js + Tailwind + shadcn + Supabase |
| 2 | Datenbank | Schema + RLS + Supabase-Clients |
| 3 | Auth | Login + Protected Layout + Navbar |
| 4 | Inventar | Liste + Formular + Detail + Bewegungen |
| 5 | OCR | Foto-Upload + n8n Workflow |
| 6 | Bewegungen | Bewegungshistorie-Seite |
| 7 | Dashboard | Statistiken + letzte Bewegungen |
| 8 | Chatbot | n8n Workflow + Chat-UI |
| 9 | Admin | Benutzerverwaltung + Kategorien |
| 10 | Deploy | Netlify + Umgebungsvariablen |
