# Arbeitsbericht App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Next.js 14 app at arbeitsbericht.ennurkara.cloud where technicians create digital work reports with signatures and auto-generated PDFs, sharing the same Supabase instance as the Warenwirtschaft app.

**Architecture:** Separate Next.js 14 App Router project based on Warenwirtschaft patterns. New DB tables (customers, work_reports, work_report_devices) added to the existing Supabase instance. 5-step tablet wizard with draft autosave. Client-side PDF generation via html2canvas + jsPDF with react-signature-canvas signature pads.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase (shared instance), react-signature-canvas, html2canvas, jspdf

---

### Task 1: Project Scaffold

**Files:**
- Create: `/Users/ennurkara/Projekte/arbeitsbericht/` (new project root)
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`
- Create: `app/layout.tsx`, `app/page.tsx`, `.gitignore`

- [ ] **Step 1: Bootstrap Next.js app**

```bash
cd /Users/ennurkara/Projekte
npx create-next-app@14 arbeitsbericht \
  --typescript --tailwind --app --no-src-dir \
  --import-alias "@/*" --no-eslint
cd arbeitsbericht
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/ssr@0.10.2 @supabase/supabase-js@2.103.3 \
  sonner@2.0.7 clsx@2.1.1 tailwind-merge@3.5.0 \
  lucide-react@1.8.0 class-variance-authority@0.7.1 \
  react-signature-canvas html2canvas jspdf \
  @radix-ui/react-dialog @radix-ui/react-label \
  @radix-ui/react-select @radix-ui/react-slot \
  tailwindcss-animate

npm install -D @types/react-signature-canvas jest @types/jest ts-jest jest-environment-jsdom
```

- [ ] **Step 3: Copy shadcn/ui components + config from warenwirtschaft**

```bash
cp -r /Users/ennurkara/Projekte/warenwirtschaft/components/ui ./components/
cp /Users/ennurkara/Projekte/warenwirtschaft/tailwind.config.ts ./
cp /Users/ennurkara/Projekte/warenwirtschaft/postcss.config.js ./
cp /Users/ennurkara/Projekte/warenwirtschaft/app/globals.css ./app/
```

- [ ] **Step 4: Add standalone output to next.config.js**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}
module.exports = nextConfig
```

- [ ] **Step 5: Create app/layout.tsx**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Arbeitsbericht',
  description: 'Digitale Arbeitsberichte',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={inter.className}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Create app/page.tsx**

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 7: Create .gitignore**

```
node_modules/
.next/
.env.local
.env
*.env
.DS_Store
.superpowers/
Dockerfile
docker-compose.yml
```

- [ ] **Step 8: Create jest.config.ts**

```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
}
export default config
```

Add to `package.json` scripts: `"test": "jest"`

- [ ] **Step 9: Copy .env.local values from VPS warenwirtschaft**

```bash
ssh root@72.60.37.57 "cat /docker/warenwirtschaft/.env.local"
```

Create `/Users/ennurkara/Projekte/arbeitsbericht/.env.local` with the same values:

```env
NEXT_PUBLIC_SUPABASE_URL=<value from VPS>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<value from VPS>
SUPABASE_SERVICE_ROLE_KEY=<value from VPS>
```

- [ ] **Step 10: Git init and first commit**

```bash
git init
git add -A
git commit -m "chore: initial project scaffold"
```

---

### Task 2: Core Library (Types, Supabase Clients, Utils)

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/client.ts`
- Create: `lib/types.ts`
- Create: `lib/utils.ts`
- Create: `lib/__tests__/utils.test.ts`

- [ ] **Step 1: Create lib/supabase/server.ts**

```bash
mkdir -p lib/supabase lib/__tests__
```

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
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

- [ ] **Step 2: Create lib/supabase/client.ts**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create lib/types.ts**

```typescript
// lib/types.ts
export type UserRole = 'admin' | 'mitarbeiter' | 'viewer'
export type WorkReportStatus = 'entwurf' | 'abgeschlossen'
export type DeviceStatus = 'lager' | 'im_einsatz' | 'defekt' | 'ausgemustert'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  created_at: string
}

export interface Customer {
  id: string
  name: string
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Device {
  id: string
  name: string
  serial_number: string | null
  status: DeviceStatus
  category?: { name: string; icon: string | null }
}

export interface WorkReport {
  id: string
  report_number: string | null
  customer_id: string
  technician_id: string
  description: string | null
  work_hours: number | null
  travel_from: string | null
  travel_to: string | null
  start_time: string
  end_time: string | null
  status: WorkReportStatus
  technician_signature: string | null
  customer_signature: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  customer?: Customer
  technician?: Profile
  devices?: Device[]
}
```

- [ ] **Step 4: Create lib/utils.ts**

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

export function calculateWorkHours(startIso: string, endIso: string): number {
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime()
  return Math.max(0, Math.round((diffMs / 3600000) * 10) / 10)
}
```

- [ ] **Step 5: Write failing tests for utils**

Create `lib/__tests__/utils.test.ts`:

```typescript
import { calculateWorkHours } from '../utils'

describe('calculateWorkHours', () => {
  it('returns correct hours for a full workday', () => {
    expect(calculateWorkHours('2026-04-20T08:00:00.000Z', '2026-04-20T17:30:00.000Z')).toBe(9.5)
  })

  it('returns 0 when end is before start', () => {
    expect(calculateWorkHours('2026-04-20T17:00:00.000Z', '2026-04-20T08:00:00.000Z')).toBe(0)
  })

  it('rounds to one decimal place', () => {
    expect(calculateWorkHours('2026-04-20T09:00:00.000Z', '2026-04-20T10:06:00.000Z')).toBe(1.1)
  })
})
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
npm test lib/__tests__/utils.test.ts
```

Expected output: `3 passed`

- [ ] **Step 7: Commit**

```bash
git add lib/ jest.config.ts package.json
git commit -m "feat: add core lib — types, supabase clients, utils with tests"
```

---

### Task 3: Database Migrations

**Files:**
- Create: `supabase/migrations/003_work_reports.sql`
- Create: `supabase/migrations/004_work_reports_rls.sql`

- [ ] **Step 1: Create supabase/migrations/003_work_reports.sql**

```bash
mkdir -p supabase/migrations
```

```sql
-- supabase/migrations/003_work_reports.sql

CREATE TYPE work_report_status AS ENUM ('entwurf', 'abgeschlossen');

-- Kundenstamm
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

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Fortlaufende Berichtsnummer (AB-YYYY-NNNN)
CREATE OR REPLACE FUNCTION generate_report_number()
RETURNS text AS $$
DECLARE
  year_str text := to_char(now(), 'YYYY');
  seq_num  int;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num
  FROM work_reports
  WHERE report_number LIKE 'AB-' || year_str || '-%';
  RETURN 'AB-' || year_str || '-' || LPAD(seq_num::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Arbeitsberichte
CREATE TABLE work_reports (
  id                   uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number        text                UNIQUE,
  customer_id          uuid                NOT NULL REFERENCES customers(id),
  technician_id        uuid                NOT NULL REFERENCES profiles(id),
  description          text,
  work_hours           numeric(5,2),
  travel_from          text,
  travel_to            text,
  start_time           timestamptz         NOT NULL DEFAULT now(),
  end_time             timestamptz,
  status               work_report_status  NOT NULL DEFAULT 'entwurf',
  technician_signature text,
  customer_signature   text,
  completed_at         timestamptz,
  created_at           timestamptz         NOT NULL DEFAULT now(),
  updated_at           timestamptz         NOT NULL DEFAULT now()
);

CREATE TRIGGER work_reports_updated_at
  BEFORE UPDATE ON work_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION set_report_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.report_number IS NULL THEN
    NEW.report_number := generate_report_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_reports_set_number
  BEFORE INSERT ON work_reports
  FOR EACH ROW EXECUTE FUNCTION set_report_number();

-- Geräte-Zuordnung (Junction)
CREATE TABLE work_report_devices (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_report_id uuid        NOT NULL REFERENCES work_reports(id) ON DELETE CASCADE,
  device_id      uuid        NOT NULL REFERENCES devices(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(work_report_id, device_id)
);
```

- [ ] **Step 2: Create supabase/migrations/004_work_reports_rls.sql**

```sql
-- supabase/migrations/004_work_reports_rls.sql

ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_report_devices ENABLE ROW LEVEL SECURITY;

-- customers: alle authentifizierten Nutzer lesen; mitarbeiter + admin schreiben
CREATE POLICY "customers_select" ON customers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_insert" ON customers
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'mitarbeiter'));
CREATE POLICY "customers_update" ON customers
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'mitarbeiter'));

-- work_reports: Techniker sieht eigene; admin sieht alle; viewer read-only
CREATE POLICY "reports_select_own" ON work_reports
  FOR SELECT TO authenticated
  USING (technician_id = auth.uid() OR get_my_role() = 'admin');
CREATE POLICY "reports_insert" ON work_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'mitarbeiter')
    AND technician_id = auth.uid()
  );
CREATE POLICY "reports_update_own" ON work_reports
  FOR UPDATE TO authenticated
  USING (
    (technician_id = auth.uid() OR get_my_role() = 'admin')
    AND get_my_role() IN ('admin', 'mitarbeiter')
  );

-- work_report_devices: folgt Rechten des zugehörigen work_report
CREATE POLICY "report_devices_select" ON work_report_devices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_reports wr
      WHERE wr.id = work_report_id
        AND (wr.technician_id = auth.uid() OR get_my_role() = 'admin')
    )
  );
CREATE POLICY "report_devices_insert" ON work_report_devices
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'mitarbeiter')
    AND EXISTS (
      SELECT 1 FROM work_reports wr
      WHERE wr.id = work_report_id AND wr.technician_id = auth.uid()
    )
  );
CREATE POLICY "report_devices_delete" ON work_report_devices
  FOR DELETE TO authenticated
  USING (
    get_my_role() IN ('admin', 'mitarbeiter')
    AND EXISTS (
      SELECT 1 FROM work_reports wr
      WHERE wr.id = work_report_id AND wr.technician_id = auth.uid()
    )
  );
```

- [ ] **Step 3: Apply migrations via Supabase SQL editor**

Open https://supabase.ennurkara.cloud → SQL Editor:
1. Paste and run `003_work_reports.sql`
2. Paste and run `004_work_reports_rls.sql`

Verify: Table Editor shows `customers`, `work_reports`, `work_report_devices` tables.

- [ ] **Step 4: Commit migrations**

```bash
git add supabase/
git commit -m "feat: database schema — customers, work_reports, work_report_devices + RLS"
```

---

### Task 4: Auth (Middleware + Login)

**Files:**
- Create: `middleware.ts`
- Create: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Create middleware.ts**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
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

- [ ] **Step 2: Create app/(auth)/login/page.tsx**

```bash
mkdir -p "app/(auth)/login"
```

```typescript
// app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('Anmeldung fehlgeschlagen', { description: 'E-Mail oder Passwort falsch.' })
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
          <CardTitle>Arbeitsbericht</CardTitle>
          <CardDescription>Melde dich mit deinem Firmen-Account an.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input id="password" type="password" value={password}
                onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
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

- [ ] **Step 3: Commit**

```bash
git add middleware.ts "app/(auth)/"
git commit -m "feat: auth middleware and login page"
```

---

### Task 5: Protected Layout + Navbar

**Files:**
- Create: `components/layout/navbar.tsx`
- Create: `app/(protected)/layout.tsx`

- [ ] **Step 1: Create components/layout/navbar.tsx**

```bash
mkdir -p components/layout
```

```typescript
// components/layout/navbar.tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FileText, LayoutDashboard } from 'lucide-react'
import type { Profile } from '@/lib/types'

const navLinks = [
  { href: '/dashboard', label: 'Übersicht' },
  { href: '/arbeitsberichte', label: 'Arbeitsberichte' },
]

const tabLinks = [
  { href: '/dashboard', label: 'Übersicht', icon: LayoutDashboard },
  { href: '/arbeitsberichte', label: 'Berichte', icon: FileText },
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
    <>
      {/* Desktop navbar */}
      <nav className="border-b bg-white hidden md:block">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-slate-900">Arbeitsbericht</span>
            <div className="flex gap-1">
              {navLinks.map(link => (
                <Link key={link.href} href={link.href}
                  className={cn(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    pathname.startsWith(link.href)
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{profile.full_name}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>Abmelden</Button>
          </div>
        </div>
      </nav>

      {/* Mobile top bar */}
      <nav className="border-b bg-white flex items-center justify-between px-4 h-14 md:hidden">
        <span className="font-semibold text-slate-900">Arbeitsbericht</span>
        <Button variant="outline" size="sm" onClick={handleSignOut}>Abmelden</Button>
      </nav>

      {/* Mobile bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t md:hidden">
        <div className="grid grid-cols-2 h-16">
          {tabLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-xs transition-colors',
                pathname.startsWith(href) ? 'text-slate-900' : 'text-slate-400'
              )}>
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Create app/(protected)/layout.tsx**

```bash
mkdir -p "app/(protected)"
```

```typescript
// app/(protected)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/navbar'
import type { Profile } from '@/lib/types'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar profile={profile as Profile} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Start dev server, verify login works**

```bash
npm run dev
```

Open http://localhost:3000 → redirects to /login → log in with warenwirtschaft account → redirects to /dashboard (404 expected, layout loads).

- [ ] **Step 4: Commit**

```bash
git add components/layout/ "app/(protected)/layout.tsx"
git commit -m "feat: protected layout with responsive navbar"
```

---

### Task 6: Dashboard + Report List Pages

**Files:**
- Create: `components/arbeitsberichte/report-list.tsx`
- Create: `app/(protected)/dashboard/page.tsx`
- Create: `app/(protected)/arbeitsberichte/page.tsx`

- [ ] **Step 1: Create components/arbeitsberichte/report-list.tsx**

```bash
mkdir -p components/arbeitsberichte
```

```typescript
// components/arbeitsberichte/report-list.tsx
'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { FileText, Plus } from 'lucide-react'
import type { WorkReport } from '@/lib/types'

interface ReportListProps {
  reports: WorkReport[]
  canCreate: boolean
}

export function ReportList({ reports, canCreate }: ReportListProps) {
  if (reports.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 mb-4">Noch keine Arbeitsberichte vorhanden.</p>
        {canCreate && (
          <Button asChild>
            <Link href="/arbeitsberichte/neu">
              <Plus className="h-4 w-4 mr-2" />Neuer Bericht
            </Link>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {reports.map(report => (
        <Link key={report.id} href={`/arbeitsberichte/${report.id}`}
          className="block bg-white rounded-lg border p-4 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-slate-900">
                  {report.report_number ?? 'Entwurf'}
                </span>
                <Badge variant={report.status === 'abgeschlossen' ? 'default' : 'secondary'}>
                  {report.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Entwurf'}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                {report.customer?.name ?? '—'} · {formatDate(report.created_at)}
              </p>
            </div>
            <FileText className="h-5 w-5 text-slate-300" />
          </div>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create app/(protected)/arbeitsberichte/page.tsx**

```bash
mkdir -p "app/(protected)/arbeitsberichte"
```

```typescript
// app/(protected)/arbeitsberichte/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReportList } from '@/components/arbeitsberichte/report-list'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { WorkReport, UserRole } from '@/lib/types'

export default async function ArbeitsberichtePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role as UserRole

  const query = supabase
    .from('work_reports')
    .select('*, customer:customers(name)')
    .order('created_at', { ascending: false })

  const { data: reports } = role === 'admin'
    ? await query
    : await query.eq('technician_id', user.id)

  const canCreate = role === 'admin' || role === 'mitarbeiter'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Arbeitsberichte</h1>
        {canCreate && (
          <Button asChild>
            <Link href="/arbeitsberichte/neu">
              <Plus className="h-4 w-4 mr-2" />Neuer Bericht
            </Link>
          </Button>
        )}
      </div>
      <ReportList reports={(reports ?? []) as WorkReport[]} canCreate={canCreate} />
    </div>
  )
}
```

- [ ] **Step 3: Create app/(protected)/dashboard/page.tsx**

```bash
mkdir -p "app/(protected)/dashboard"
```

```typescript
// app/(protected)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, FileText, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { UserRole } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const role = profile?.role as UserRole
  const canCreate = role === 'admin' || role === 'mitarbeiter'

  const [{ data: recentReports }, { count: draftCount }] = await Promise.all([
    supabase
      .from('work_reports')
      .select('*, customer:customers(name)')
      .eq('technician_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('work_reports')
      .select('*', { count: 'exact', head: true })
      .eq('technician_id', user.id)
      .eq('status', 'entwurf'),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Willkommen, {profile?.full_name}</h1>
        <p className="text-slate-500 mt-1">Digitale Arbeitsberichte</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Entwürfe</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{draftCount ?? 0}</p>
        </div>
        {canCreate && (
          <div className="bg-white rounded-lg border p-4 flex items-center justify-center">
            <Button asChild className="w-full">
              <Link href="/arbeitsberichte/neu">
                <Plus className="h-4 w-4 mr-2" />Neuer Bericht
              </Link>
            </Button>
          </div>
        )}
      </div>

      {recentReports && recentReports.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Letzte Berichte</h2>
          <div className="space-y-2">
            {recentReports.map(r => (
              <Link key={r.id} href={`/arbeitsberichte/${r.id}`}
                className="flex items-center justify-between bg-white rounded-lg border p-3 hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium">{r.report_number ?? 'Entwurf'}</p>
                    <p className="text-xs text-slate-500">
                      {(r as any).customer?.name} · {formatDate(r.created_at)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify pages load**

With `npm run dev`:
- http://localhost:3000/dashboard → welcome + draft count 0
- http://localhost:3000/arbeitsberichte → empty list + "Neuer Bericht" button

- [ ] **Step 5: Commit**

```bash
git add components/arbeitsberichte/report-list.tsx "app/(protected)/dashboard/" "app/(protected)/arbeitsberichte/page.tsx"
git commit -m "feat: dashboard and report list pages"
```

---

### Task 7: Wizard Container

**Files:**
- Create: `components/arbeitsberichte/wizard.tsx`
- Create: `app/(protected)/arbeitsberichte/neu/page.tsx`

- [ ] **Step 1: Create components/arbeitsberichte/wizard.tsx**

```typescript
// components/arbeitsberichte/wizard.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types'

export interface WizardData {
  reportId: string | null
  customerId: string
  description: string
  deviceIds: string[]
  workHours: string
  travelFrom: string
  travelTo: string
  startTime: string
  endTime: string
  technicianSignature: string | null
  customerSignature: string | null
}

interface WizardProps {
  profile: Profile
}

const STEP_LABELS = ['Kundendaten', 'Tätigkeit', 'Geräte', 'Aufwand', 'Unterschriften']

export function Wizard({ profile }: WizardProps) {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>({
    reportId: null,
    customerId: '',
    description: '',
    deviceIds: [],
    workHours: '',
    travelFrom: '',
    travelTo: '',
    startTime: new Date().toISOString().slice(0, 16),
    endTime: '',
    technicianSignature: null,
    customerSignature: null,
  })

  function updateData(patch: Partial<WizardData>) {
    setData(prev => ({ ...prev, ...patch }))
  }

  async function saveStep1(patch: Partial<WizardData>) {
    const merged = { ...data, ...patch }
    updateData(patch)
    if (!merged.reportId) {
      const { data: created, error } = await supabase
        .from('work_reports')
        .insert({
          customer_id: merged.customerId,
          technician_id: profile.id,
          start_time: new Date().toISOString(),
          status: 'entwurf',
        })
        .select()
        .single()
      if (error || !created) {
        toast.error('Fehler beim Speichern des Entwurfs')
        return
      }
      updateData({ reportId: created.id })
    } else {
      await supabase
        .from('work_reports')
        .update({ customer_id: merged.customerId })
        .eq('id', merged.reportId)
    }
    setStep(2)
  }

  async function saveStep2(patch: Partial<WizardData>) {
    const merged = { ...data, ...patch }
    updateData(patch)
    if (merged.reportId) {
      await supabase
        .from('work_reports')
        .update({ description: merged.description })
        .eq('id', merged.reportId)
    }
    setStep(3)
  }

  async function saveStep3(patch: Partial<WizardData>) {
    const merged = { ...data, ...patch }
    updateData(patch)
    if (merged.reportId) {
      await supabase
        .from('work_report_devices')
        .delete()
        .eq('work_report_id', merged.reportId)
      if (merged.deviceIds.length > 0) {
        await supabase
          .from('work_report_devices')
          .insert(
            merged.deviceIds.map(deviceId => ({
              work_report_id: merged.reportId!,
              device_id: deviceId,
            }))
          )
      }
    }
    setStep(4)
  }

  async function saveStep4(patch: Partial<WizardData>) {
    const merged = { ...data, ...patch }
    updateData(patch)
    if (merged.reportId) {
      await supabase
        .from('work_reports')
        .update({
          work_hours: parseFloat(merged.workHours),
          travel_from: merged.travelFrom || null,
          travel_to: merged.travelTo || null,
          start_time: merged.startTime ? new Date(merged.startTime).toISOString() : undefined,
          end_time: merged.endTime ? new Date(merged.endTime).toISOString() : null,
        })
        .eq('id', merged.reportId)
    }
    setStep(5)
  }

  async function handleFinish(patch: Partial<WizardData>) {
    const merged = { ...data, ...patch }
    updateData(patch)
    if (!merged.reportId) {
      toast.error('Kein aktiver Bericht gefunden')
      return
    }

    // 1. Update report to abgeschlossen
    const { error } = await supabase
      .from('work_reports')
      .update({
        status: 'abgeschlossen',
        technician_signature: merged.technicianSignature,
        customer_signature: merged.customerSignature,
        completed_at: new Date().toISOString(),
      })
      .eq('id', merged.reportId)

    if (error) {
      toast.error('Fehler beim Abschließen des Berichts')
      return
    }

    // 2. Fetch report_number
    const { data: reportRow } = await supabase
      .from('work_reports')
      .select('report_number')
      .eq('id', merged.reportId)
      .single()

    // 3. Update devices + create movements
    for (const deviceId of merged.deviceIds) {
      await supabase
        .from('devices')
        .update({ status: 'im_einsatz' })
        .eq('id', deviceId)
      await supabase
        .from('device_movements')
        .insert({
          device_id: deviceId,
          user_id: profile.id,
          action: 'entnahme',
          quantity: 1,
          note: `Arbeitsbericht ${reportRow?.report_number ?? merged.reportId}`,
        })
    }

    // 4. Fetch data for PDF
    const [{ data: customerRow }, { data: deviceRows }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', merged.customerId).single(),
      merged.deviceIds.length > 0
        ? supabase.from('devices').select('id, name, serial_number').in('id', merged.deviceIds)
        : Promise.resolve({ data: [] }),
    ])

    // 5. Mount PDF template and generate
    setPdfPayload({
      customer: customerRow,
      devices: deviceRows ?? [],
      reportNumber: reportRow?.report_number ?? null,
      report: {
        description: merged.description,
        work_hours: parseFloat(merged.workHours),
        travel_from: merged.travelFrom,
        travel_to: merged.travelTo,
        start_time: merged.startTime ? new Date(merged.startTime).toISOString() : new Date().toISOString(),
        end_time: merged.endTime ? new Date(merged.endTime).toISOString() : null,
      },
      technicianSignature: merged.technicianSignature!,
      customerSignature: merged.customerSignature!,
    })
    setShowPdf(true)

    setTimeout(async () => {
      try {
        const { exportReportToPdf } = await import('./pdf-export')
        await exportReportToPdf(reportRow?.report_number ?? null)
        toast.success('PDF wurde heruntergeladen')
      } catch {
        toast.error('Fehler beim Erstellen des PDFs')
      }
      router.push('/arbeitsberichte')
    }, 400)
  }

  const [showPdf, setShowPdf] = useState(false)
  const [pdfPayload, setPdfPayload] = useState<any>(null)

  // Dynamic import to avoid circular reference — rendered below
  const StepComponents = {
    1: null, 2: null, 3: null, 4: null, 5: null,
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-600">
            Schritt {step} von {STEP_LABELS.length}
          </span>
          <span className="text-sm text-slate-500">{STEP_LABELS[step - 1]}</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${(step / STEP_LABELS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps — filled in Tasks 8–12 */}
      <div className="bg-white rounded-xl border p-6">
        <div className="text-slate-400 text-center py-8 text-sm">
          Schritt {step}: {STEP_LABELS[step - 1]}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        {step > 1 ? (
          <button onClick={() => setStep(s => s - 1)}
            className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
            ← Zurück
          </button>
        ) : (
          <button onClick={() => router.push('/arbeitsberichte')}
            className="text-sm text-slate-500 hover:text-slate-700">
            Abbrechen
          </button>
        )}
      </div>

      {/* Hidden PDF template — mounted after finish */}
      {showPdf && pdfPayload && (
        <PdfTemplateRenderer payload={pdfPayload} technician={profile} />
      )}
    </div>
  )
}

// Inline placeholder — replaced in Task 13 with real PdfTemplate
function PdfTemplateRenderer({ payload, technician }: any) {
  return null
}
```

- [ ] **Step 2: Create app/(protected)/arbeitsberichte/neu/page.tsx**

```bash
mkdir -p "app/(protected)/arbeitsberichte/neu"
```

```typescript
// app/(protected)/arbeitsberichte/neu/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Wizard } from '@/components/arbeitsberichte/wizard'
import type { Profile, UserRole } from '@/lib/types'

export default async function NeuerBerichtPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const role = profile?.role as UserRole

  if (role === 'viewer') redirect('/arbeitsberichte')

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Neuer Arbeitsbericht</h1>
      <Wizard profile={profile as Profile} />
    </div>
  )
}
```

- [ ] **Step 3: Verify wizard scaffold loads**

Open http://localhost:3000/arbeitsberichte/neu → 5-step progress bar visible, "Schritt 1: Kundendaten" shown.

- [ ] **Step 4: Commit**

```bash
git add components/arbeitsberichte/wizard.tsx "app/(protected)/arbeitsberichte/neu/"
git commit -m "feat: wizard container scaffold with all save handlers"
```

---

### Task 8: Step 1 — Kundendaten

**Files:**
- Create: `components/arbeitsberichte/step-kunde.tsx`
- Modify: `components/arbeitsberichte/wizard.tsx` (wire in StepKunde)

- [ ] **Step 1: Create components/arbeitsberichte/step-kunde.tsx**

```typescript
// components/arbeitsberichte/step-kunde.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Search, UserPlus } from 'lucide-react'
import type { Customer } from '@/lib/types'
import type { WizardData } from './wizard'

interface StepKundeProps {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => Promise<void>
}

export function StepKunde({ data, onNext }: StepKundeProps) {
  const supabase = createClient()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(data.customerId)
  const [showNewForm, setShowNewForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', address: '', city: '', phone: '' })

  useEffect(() => {
    supabase.from('customers').select('*').order('name')
      .then(({ data: rows }) => setCustomers(rows ?? []))
  }, [])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreateCustomer() {
    if (!newCustomer.name.trim()) {
      toast.error('Name ist erforderlich')
      return
    }
    setIsLoading(true)
    const { data: created, error } = await supabase
      .from('customers')
      .insert({ ...newCustomer })
      .select()
      .single()

    if (error || !created) {
      toast.error('Kunde konnte nicht gespeichert werden')
      setIsLoading(false)
      return
    }
    setCustomers(prev =>
      [...prev, created as Customer].sort((a, b) => a.name.localeCompare(b.name))
    )
    setSelectedId(created.id)
    setShowNewForm(false)
    setNewCustomer({ name: '', address: '', city: '', phone: '' })
    setIsLoading(false)
    toast.success('Kunde gespeichert')
  }

  async function handleNext() {
    if (!selectedId) {
      toast.error('Bitte einen Kunden auswählen')
      return
    }
    setIsLoading(true)
    await onNext({ customerId: selectedId })
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Kundendaten</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Kunde suchen..." value={search}
          onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">Keine Kunden gefunden</p>
        )}
        {filtered.map(customer => (
          <button key={customer.id} onClick={() => setSelectedId(customer.id)}
            className={`w-full text-left px-4 py-3 text-sm transition-colors ${
              selectedId === customer.id
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'hover:bg-slate-50 text-slate-700'
            }`}>
            <span className="font-medium">{customer.name}</span>
            {customer.city && <span className="text-slate-400 ml-2">· {customer.city}</span>}
          </button>
        ))}
      </div>

      {!showNewForm ? (
        <Button variant="outline" size="sm" onClick={() => setShowNewForm(true)}>
          <UserPlus className="h-4 w-4 mr-2" />Neuen Kunden anlegen
        </Button>
      ) : (
        <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">Neuer Kunde</h3>
          <div>
            <Label htmlFor="cname">Name *</Label>
            <Input id="cname" value={newCustomer.name}
              onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="caddress">Straße + Nr.</Label>
            <Input id="caddress" value={newCustomer.address}
              onChange={e => setNewCustomer(p => ({ ...p, address: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="ccity">PLZ + Ort</Label>
            <Input id="ccity" value={newCustomer.city}
              onChange={e => setNewCustomer(p => ({ ...p, city: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="cphone">Telefon</Label>
            <Input id="cphone" value={newCustomer.phone}
              onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreateCustomer} disabled={isLoading}>Speichern</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNewForm(false)}>Abbrechen</Button>
          </div>
        </div>
      )}

      <Button className="w-full" onClick={handleNext} disabled={isLoading || !selectedId}>
        Weiter →
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Wire StepKunde into wizard.tsx**

In `wizard.tsx`, add the import at the top and replace the step 1 placeholder inside the `<div className="bg-white rounded-xl border p-6">` block:

```typescript
// Add import:
import { StepKunde } from './step-kunde'

// Replace the placeholder div content with:
{step === 1 && <StepKunde data={data} onNext={saveStep1} />}
{step !== 1 && (
  <div className="text-slate-400 text-center py-8 text-sm">
    Schritt {step}: {STEP_LABELS[step - 1]}
  </div>
)}
```

Also remove the `← Zurück` navigation button render for step 1 (it shows "Abbrechen" instead — this is already handled in the scaffold).

- [ ] **Step 3: Test Step 1 end-to-end**

1. Open /arbeitsberichte/neu
2. Click "Neuen Kunden anlegen" → enter "Test GmbH", city "Berlin" → Speichern
3. Select "Test GmbH" in list → click "Weiter →"
4. Verify in Supabase: `work_reports` row created with `status='entwurf'` and `customer_id` set, `work_reports.report_number` = "AB-2026-0001"

- [ ] **Step 4: Commit**

```bash
git add components/arbeitsberichte/
git commit -m "feat: wizard step 1 — customer selection with inline create"
```

---

### Task 9: Step 2 — Ausgeführte Tätigkeit

**Files:**
- Create: `components/arbeitsberichte/step-taetigkeit.tsx`
- Modify: `components/arbeitsberichte/wizard.tsx`

- [ ] **Step 1: Create components/arbeitsberichte/step-taetigkeit.tsx**

```typescript
// components/arbeitsberichte/step-taetigkeit.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { WizardData } from './wizard'

interface StepTaetigkeitProps {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => Promise<void>
}

export function StepTaetigkeit({ data, onNext }: StepTaetigkeitProps) {
  const [description, setDescription] = useState(data.description)
  const [isLoading, setIsLoading] = useState(false)

  async function handleNext() {
    if (!description.trim()) {
      toast.error('Bitte eine Beschreibung eingeben')
      return
    }
    setIsLoading(true)
    await onNext({ description })
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Ausgeführte Tätigkeit</h2>
      <div>
        <Label htmlFor="description">Beschreibung der durchgeführten Arbeiten *</Label>
        <textarea
          id="description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Welche Arbeiten wurden ausgeführt?"
          rows={7}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            resize-none placeholder:text-slate-400"
        />
      </div>
      <Button className="w-full" onClick={handleNext}
        disabled={isLoading || !description.trim()}>
        Weiter →
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Wire into wizard.tsx**

Add import and replace step 2 placeholder:

```typescript
import { StepTaetigkeit } from './step-taetigkeit'

// In the step content block, add alongside step 1:
{step === 2 && <StepTaetigkeit data={data} onNext={saveStep2} />}
```

- [ ] **Step 3: Test — complete step 2, verify description saved in DB**

- [ ] **Step 4: Commit**

```bash
git add components/arbeitsberichte/
git commit -m "feat: wizard step 2 — Tätigkeit description"
```

---

### Task 10: Step 3 — Installierte Geräte

**Files:**
- Create: `components/arbeitsberichte/step-geraete.tsx`
- Modify: `components/arbeitsberichte/wizard.tsx`

- [ ] **Step 1: Create components/arbeitsberichte/step-geraete.tsx**

```typescript
// components/arbeitsberichte/step-geraete.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, X } from 'lucide-react'
import type { Device } from '@/lib/types'
import type { WizardData } from './wizard'

interface StepGeraeteProps {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => Promise<void>
}

export function StepGeraete({ data, onNext }: StepGeraeteProps) {
  const supabase = createClient()
  const [devices, setDevices] = useState<Device[]>([])
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(data.deviceIds)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('devices')
      .select('id, name, serial_number, status, category:categories(name, icon)')
      .eq('status', 'lager')
      .order('name')
      .then(({ data: rows }) => setDevices((rows ?? []) as Device[]))
  }, [])

  const filtered = devices.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.serial_number ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function toggleDevice(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectedDevices = devices.filter(d => selectedIds.includes(d.id))

  async function handleNext() {
    setIsLoading(true)
    await onNext({ deviceIds: selectedIds })
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Installierte Geräte</h2>
      <p className="text-sm text-slate-500">Nur Geräte mit Status „Lager" werden angezeigt.</p>

      {selectedDevices.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedDevices.map(d => (
            <Badge key={d.id} variant="secondary" className="flex items-center gap-1 py-1">
              {d.name}
              {d.serial_number && <span className="text-slate-400 text-xs">· {d.serial_number}</span>}
              <button onClick={() => toggleDevice(d.id)} className="ml-1 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Gerät oder Seriennummer suchen..."
          value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="max-h-56 overflow-y-auto border rounded-lg divide-y">
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">Keine Geräte verfügbar</p>
        )}
        {filtered.map(device => (
          <button key={device.id} onClick={() => toggleDevice(device.id)}
            className={`w-full text-left px-4 py-3 text-sm transition-colors ${
              selectedIds.includes(device.id)
                ? 'bg-blue-50 text-blue-700'
                : 'hover:bg-slate-50 text-slate-700'
            }`}>
            <span className="font-medium">{device.name}</span>
            {device.serial_number && (
              <span className="text-slate-400 ml-2">SN: {device.serial_number}</span>
            )}
            {device.category && (
              <span className="text-xs text-slate-400 ml-2">
                · {(device.category as any).name}
              </span>
            )}
          </button>
        ))}
      </div>

      <Button className="w-full" onClick={handleNext} disabled={isLoading}>
        {selectedIds.length === 0
          ? 'Überspringen →'
          : `Weiter → (${selectedIds.length} Gerät${selectedIds.length !== 1 ? 'e' : ''})`}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Wire into wizard.tsx**

```typescript
import { StepGeraete } from './step-geraete'

// Add alongside other steps:
{step === 3 && <StepGeraete data={data} onNext={saveStep3} />}
```

- [ ] **Step 3: Test — select 2 devices, verify work_report_devices rows created in DB**

- [ ] **Step 4: Commit**

```bash
git add components/arbeitsberichte/
git commit -m "feat: wizard step 3 — device multi-select from inventory"
```

---

### Task 11: Step 4 — Aufwand & Anfahrt

**Files:**
- Create: `components/arbeitsberichte/step-aufwand.tsx`
- Modify: `components/arbeitsberichte/wizard.tsx`

- [ ] **Step 1: Create components/arbeitsberichte/step-aufwand.tsx**

```typescript
// components/arbeitsberichte/step-aufwand.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { calculateWorkHours } from '@/lib/utils'
import type { WizardData } from './wizard'

interface StepAufwandProps {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => Promise<void>
}

export function StepAufwand({ data, onNext }: StepAufwandProps) {
  const [startTime, setStartTime] = useState(data.startTime)
  const [endTime, setEndTime] = useState(data.endTime)
  const [workHours, setWorkHours] = useState(data.workHours)
  const [travelFrom, setTravelFrom] = useState(data.travelFrom)
  const [travelTo, setTravelTo] = useState(data.travelTo)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (startTime && endTime) {
      const auto = calculateWorkHours(
        new Date(startTime).toISOString(),
        new Date(endTime).toISOString()
      )
      if (auto > 0) setWorkHours(String(auto))
    }
  }, [startTime, endTime])

  async function handleNext() {
    if (!workHours || parseFloat(workHours) <= 0) {
      toast.error('Bitte Arbeitsaufwand in Stunden angeben')
      return
    }
    setIsLoading(true)
    await onNext({ startTime, endTime, workHours, travelFrom, travelTo })
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Aufwand & Anfahrt</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startTime">Beginn</Label>
          <Input id="startTime" type="datetime-local" value={startTime}
            onChange={e => setStartTime(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="endTime">Ende</Label>
          <Input id="endTime" type="datetime-local" value={endTime}
            onChange={e => setEndTime(e.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor="workHours">Arbeitsaufwand (Stunden) *</Label>
        <Input id="workHours" type="number" min="0" step="0.5"
          value={workHours} onChange={e => setWorkHours(e.target.value)}
          placeholder="z.B. 4.5" />
        <p className="text-xs text-slate-400 mt-1">
          Wird automatisch aus Start/Ende berechnet, manuell überschreibbar
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="travelFrom">Anfahrt von</Label>
          <Input id="travelFrom" value={travelFrom}
            onChange={e => setTravelFrom(e.target.value)} placeholder="z.B. Berlin" />
        </div>
        <div>
          <Label htmlFor="travelTo">Anfahrt bis</Label>
          <Input id="travelTo" value={travelTo}
            onChange={e => setTravelTo(e.target.value)} placeholder="z.B. München" />
        </div>
      </div>

      <Button className="w-full" onClick={handleNext} disabled={isLoading || !workHours}>
        Weiter →
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Wire into wizard.tsx**

```typescript
import { StepAufwand } from './step-aufwand'

{step === 4 && <StepAufwand data={data} onNext={saveStep4} />}
```

- [ ] **Step 3: Test — set start 09:00, end 17:30, verify work_hours auto-calculates to 8.5, saved to DB**

- [ ] **Step 4: Commit**

```bash
git add components/arbeitsberichte/
git commit -m "feat: wizard step 4 — work hours and travel with auto-calculation"
```

---

### Task 12: Step 5 — Unterschriften

**Files:**
- Create: `components/arbeitsberichte/step-unterschriften.tsx`
- Modify: `components/arbeitsberichte/wizard.tsx`

- [ ] **Step 1: Create components/arbeitsberichte/step-unterschriften.tsx**

```typescript
// components/arbeitsberichte/step-unterschriften.tsx
'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
import type SignatureCanvas from 'react-signature-canvas'
import type { WizardData } from './wizard'

const SignaturePad = dynamic(() => import('react-signature-canvas'), { ssr: false })

interface StepUnterschriftenProps {
  data: WizardData
  technicianName: string
  onFinish: (patch: Partial<WizardData>) => Promise<void>
}

export function StepUnterschriften({ data, technicianName, onFinish }: StepUnterschriftenProps) {
  const techRef = useRef<SignatureCanvas>(null)
  const customerRef = useRef<SignatureCanvas>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleFinish() {
    if (techRef.current?.isEmpty() ?? true) {
      toast.error('Bitte Techniker-Unterschrift hinzufügen')
      return
    }
    if (customerRef.current?.isEmpty() ?? true) {
      toast.error('Bitte Kunden-Unterschrift hinzufügen')
      return
    }
    setIsLoading(true)
    await onFinish({
      technicianSignature: techRef.current!.toDataURL('image/png'),
      customerSignature: customerRef.current!.toDataURL('image/png'),
    })
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">Unterschriften</h2>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">
            Techniker: {technicianName}
          </label>
          <button onClick={() => techRef.current?.clear()}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <RotateCcw className="h-3 w-3" />Löschen
          </button>
        </div>
        <div className="border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-white">
          <SignaturePad
            ref={techRef}
            canvasProps={{
              className: 'w-full touch-none',
              style: { height: '150px', display: 'block' },
            }}
            backgroundColor="white"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">Unterschrift Kunde</label>
          <button onClick={() => customerRef.current?.clear()}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <RotateCcw className="h-3 w-3" />Löschen
          </button>
        </div>
        <div className="border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-white">
          <SignaturePad
            ref={customerRef}
            canvasProps={{
              className: 'w-full touch-none',
              style: { height: '150px', display: 'block' },
            }}
            backgroundColor="white"
          />
        </div>
      </div>

      <Button
        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-base font-medium"
        onClick={handleFinish}
        disabled={isLoading}
      >
        {isLoading ? 'Wird verarbeitet...' : '✓ Fertigstellen & PDF erstellen'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Wire into wizard.tsx**

```typescript
import { StepUnterschriften } from './step-unterschriften'

{step === 5 && (
  <StepUnterschriften
    data={data}
    technicianName={profile.full_name}
    onFinish={handleFinish}
  />
)}
```

Also remove the "Weiter →" navigation button for step 5 in the wizard footer — step 5 submits via `handleFinish` inside the component. Update the footer to only show "← Zurück" when `step > 1 && step < 5`:

```typescript
{step > 1 && step < 5 && (
  <button onClick={() => setStep(s => s - 1)} ...>← Zurück</button>
)}
{step === 5 && (
  <button onClick={() => setStep(4)} ...>← Zurück</button>
)}
```

- [ ] **Step 3: Test signature pads**

Open step 5 → draw on both pads with mouse → "Löschen" clears → both pads accept input.

- [ ] **Step 4: Commit**

```bash
git add components/arbeitsberichte/
git commit -m "feat: wizard step 5 — dual signature pads"
```

---

### Task 13: PDF Template + Export

**Files:**
- Create: `components/arbeitsberichte/pdf-template.tsx`
- Create: `components/arbeitsberichte/pdf-export.ts`
- Modify: `components/arbeitsberichte/wizard.tsx` (replace PdfTemplateRenderer stub)

- [ ] **Step 1: Create components/arbeitsberichte/pdf-template.tsx**

Uses inline styles throughout — html2canvas does not reliably capture Tailwind utility classes.

```typescript
// components/arbeitsberichte/pdf-template.tsx

interface PdfTemplateProps {
  reportNumber: string | null
  customer: { name: string; address: string | null; city: string | null; phone: string | null }
  technician: { full_name: string }
  report: {
    description: string | null
    work_hours: number | null
    travel_from: string | null
    travel_to: string | null
    start_time: string
    end_time: string | null
  }
  devices: Array<{ id: string; name: string; serial_number: string | null }>
  technicianSignature: string
  customerSignature: string
}

export function PdfTemplate({
  reportNumber, customer, technician, report, devices,
  technicianSignature, customerSignature,
}: PdfTemplateProps) {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('de-DE', opts).format(new Date(iso))

  const dateStr = fmt(report.start_time, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const startStr = fmt(report.start_time, { hour: '2-digit', minute: '2-digit' })
  const endStr = report.end_time
    ? fmt(report.end_time, { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div
      id="pdf-template"
      style={{
        position: 'fixed', left: '-9999px', top: 0,
        width: '794px', backgroundColor: 'white',
        fontFamily: 'Arial, sans-serif', fontSize: '12px',
        color: '#1e293b', padding: '0', boxSizing: 'border-box',
      }}
    >
      {/* Blue header */}
      <div style={{
        backgroundColor: '#1e40af', padding: '20px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
          ARBEITSBERICHT
        </div>
        <div style={{ textAlign: 'right', color: '#93c5fd', fontSize: '11px', lineHeight: '1.6' }}>
          <div style={{ fontWeight: '600' }}>{reportNumber ?? '—'}</div>
          <div>{dateStr}</div>
        </div>
      </div>

      <div style={{ padding: '24px 40px 40px' }}>
        {/* Kunde + Techniker */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Kunde
            </div>
            <div style={{ fontWeight: '600', marginBottom: '2px' }}>{customer.name}</div>
            {customer.address && <div style={{ color: '#475569', fontSize: '11px' }}>{customer.address}</div>}
            {customer.city && <div style={{ color: '#475569', fontSize: '11px' }}>{customer.city}</div>}
            {customer.phone && <div style={{ color: '#475569', fontSize: '11px' }}>{customer.phone}</div>}
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Techniker
            </div>
            <div style={{ fontWeight: '600', marginBottom: '2px' }}>{technician.full_name}</div>
            <div style={{ color: '#475569', fontSize: '11px' }}>
              {report.work_hours}h
              {report.travel_from && report.travel_to && ` | ${report.travel_from} → ${report.travel_to}`}
            </div>
            <div style={{ color: '#475569', fontSize: '11px' }}>{startStr} – {endStr} Uhr</div>
          </div>
        </div>

        {/* Tätigkeit */}
        <div style={{ backgroundColor: '#f1f5f9', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ color: '#475569', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>
            Ausgeführte Tätigkeit
          </div>
          <div style={{ color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {report.description ?? '—'}
          </div>
        </div>

        {/* Geräte table */}
        {devices.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ color: '#475569', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>
              Installierte Geräte
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#e2e8f0' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', color: '#475569', fontWeight: '600' }}>Gerät</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', color: '#475569', fontWeight: '600' }}>Seriennummer</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d, i) => (
                  <tr key={d.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                    <td style={{ padding: '6px 10px', fontSize: '11px', color: '#334155' }}>{d.name}</td>
                    <td style={{ padding: '6px 10px', fontSize: '11px', color: '#64748b' }}>{d.serial_number ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Unterschriften */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '16px' }}>
          <div>
            <img src={technicianSignature} alt="Unterschrift Techniker"
              style={{ width: '100%', height: '90px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '4px', backgroundColor: 'white' }} />
            <div style={{ borderTop: '1px solid #334155', paddingTop: '6px', marginTop: '6px', textAlign: 'center', fontSize: '10px', color: '#64748b' }}>
              {technician.full_name} (Techniker)
            </div>
          </div>
          <div>
            <img src={customerSignature} alt="Unterschrift Kunde"
              style={{ width: '100%', height: '90px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '4px', backgroundColor: 'white' }} />
            <div style={{ borderTop: '1px solid #334155', paddingTop: '6px', marginTop: '6px', textAlign: 'center', fontSize: '10px', color: '#64748b' }}>
              {customer.name} (Kunde)
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create components/arbeitsberichte/pdf-export.ts**

```typescript
// components/arbeitsberichte/pdf-export.ts

export async function exportReportToPdf(reportNumber: string | null): Promise<void> {
  const element = document.getElementById('pdf-template')
  if (!element) throw new Error('PDF template element not found')

  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF } = await import('jspdf')

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
  pdf.save(`${reportNumber ?? 'arbeitsbericht'}.pdf`)
}
```

- [ ] **Step 3: Replace PdfTemplateRenderer stub in wizard.tsx**

Replace the `PdfTemplateRenderer` function and its usage at the bottom of wizard.tsx with:

```typescript
// Add import at top:
import { PdfTemplate } from './pdf-template'

// Replace the stub render (inside the return, after the main div):
{showPdf && pdfPayload && (
  <PdfTemplate
    reportNumber={pdfPayload.reportNumber}
    customer={pdfPayload.customer}
    technician={profile}
    report={pdfPayload.report}
    devices={pdfPayload.devices}
    technicianSignature={pdfPayload.technicianSignature}
    customerSignature={pdfPayload.customerSignature}
  />
)}
```

Remove the `PdfTemplateRenderer` stub function entirely.

- [ ] **Step 4: Full end-to-end wizard test**

Run through complete wizard:
1. Step 1: Create customer "Muster GmbH", Adresse "Musterstr. 1", Stadt "Hamburg"
2. Step 2: Enter "Installation Kassensystem, Softwareupdate durchgeführt."
3. Step 3: Select 1-2 devices (if none available, skip is OK)
4. Step 4: Start 09:00, End 17:00 → verify 8h auto-calculated
5. Step 5: Draw signatures for both → "Fertigstellen & PDF erstellen"

Expected results:
- `work_reports` row: `status='abgeschlossen'`, `completed_at` set, signatures stored as base64
- Selected devices: `status='im_einsatz'` in warenwirtschaft DB
- `device_movements` rows created with `action='entnahme'`
- PDF file downloaded: `AB-2026-0001.pdf` with blue header, both signatures visible
- Browser redirects to /arbeitsberichte

- [ ] **Step 5: Commit**

```bash
git add components/arbeitsberichte/
git commit -m "feat: PDF template and export — completes full wizard flow"
```

---

### Task 14: Report Detail Page

**Files:**
- Create: `app/(protected)/arbeitsberichte/[id]/page.tsx`

- [ ] **Step 1: Create app/(protected)/arbeitsberichte/[id]/page.tsx**

```bash
mkdir -p "app/(protected)/arbeitsberichte/[id]"
```

```typescript
// app/(protected)/arbeitsberichte/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import { ArrowLeft, Edit } from 'lucide-react'
import type { UserRole } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BerichtDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role as UserRole

  const { data: report } = await supabase
    .from('work_reports')
    .select(`
      *,
      customer:customers(*),
      technician:profiles!work_reports_technician_id_fkey(full_name),
      devices:work_report_devices(device:devices(id, name, serial_number))
    `)
    .eq('id', id)
    .single()

  if (!report) notFound()

  const canView = role === 'admin' || report.technician_id === user.id
  if (!canView) redirect('/arbeitsberichte')

  const devices = (report.devices ?? []).map((d: any) => d.device)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/arbeitsberichte"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-xl font-bold text-slate-900">
          {report.report_number ?? 'Entwurf'}
        </h1>
        <Badge variant={report.status === 'abgeschlossen' ? 'default' : 'secondary'}>
          {report.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Entwurf'}
        </Badge>
      </div>

      {report.status === 'entwurf' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-amber-700">Dieser Bericht ist noch nicht abgeschlossen.</p>
          <Button size="sm" asChild>
            <Link href="/arbeitsberichte/neu">
              <Edit className="h-4 w-4 mr-2" />Neuer Bericht
            </Link>
          </Button>
        </div>
      )}

      <div className="bg-white rounded-xl border divide-y">
        <div className="p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Kunde</p>
          <p className="font-medium">{(report.customer as any)?.name ?? '—'}</p>
          {(report.customer as any)?.address && (
            <p className="text-sm text-slate-500">{(report.customer as any).address}</p>
          )}
          {(report.customer as any)?.city && (
            <p className="text-sm text-slate-500">{(report.customer as any).city}</p>
          )}
        </div>

        <div className="p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Techniker & Aufwand</p>
          <p className="font-medium">{(report.technician as any)?.full_name ?? '—'}</p>
          {report.start_time && (
            <p className="text-sm text-slate-500">{formatDateTime(report.start_time)}</p>
          )}
          {report.work_hours && (
            <p className="text-sm text-slate-500">{report.work_hours}h Aufwand</p>
          )}
          {report.travel_from && report.travel_to && (
            <p className="text-sm text-slate-500">
              Anfahrt: {report.travel_from} → {report.travel_to}
            </p>
          )}
        </div>

        {report.description && (
          <div className="p-5">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Ausgeführte Tätigkeit</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.description}</p>
          </div>
        )}

        {devices.length > 0 && (
          <div className="p-5">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">Installierte Geräte</p>
            <div className="space-y-2">
              {devices.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 font-medium">{d.name}</span>
                  {d.serial_number && (
                    <span className="text-slate-400 font-mono text-xs">{d.serial_number}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {report.status === 'abgeschlossen' && (
          <div className="p-5 grid grid-cols-2 gap-4">
            {report.technician_signature && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Unterschrift Techniker</p>
                <img src={report.technician_signature} alt="Unterschrift Techniker"
                  className="border rounded-lg h-20 w-full object-contain bg-white" />
              </div>
            )}
            {report.customer_signature && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Unterschrift Kunde</p>
                <img src={report.customer_signature} alt="Unterschrift Kunde"
                  className="border rounded-lg h-20 w-full object-contain bg-white" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test detail page**

Navigate to a completed report from /arbeitsberichte → all fields shown, signatures visible, back button works.

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/arbeitsberichte/[id]/"
git commit -m "feat: report detail page with signatures display"
```

---

### Task 15: Docker + VPS Deployment

**Files (VPS-only, not in git):**
- Create on VPS: `/docker/arbeitsbericht/Dockerfile`
- Create on VPS: `/docker/arbeitsbericht/docker-compose.yml`
- Create on VPS: `/docker/arbeitsbericht/.env.local`

- [ ] **Step 1: Create project directory on VPS**

```bash
ssh root@72.60.37.57 "mkdir -p /docker/arbeitsbericht"
```

- [ ] **Step 2: Rsync project to VPS**

```bash
rsync -avz \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '.superpowers' \
  --exclude '.DS_Store' \
  /Users/ennurkara/Projekte/arbeitsbericht/ \
  root@72.60.37.57:/docker/arbeitsbericht/
```

- [ ] **Step 3: Create Dockerfile on VPS**

```bash
ssh root@72.60.37.57 bash -s << 'EOF'
cat > /docker/arbeitsbericht/Dockerfile << 'DOCKERFILE'
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
DOCKERFILE
EOF
```

- [ ] **Step 4: Create .env.local on VPS**

```bash
ssh root@72.60.37.57
# Copy values from existing warenwirtschaft .env.local:
grep -E 'SUPABASE' /docker/warenwirtschaft/.env.local > /docker/arbeitsbericht/.env.local
```

- [ ] **Step 5: Create docker-compose.yml on VPS**

```bash
ssh root@72.60.37.57 bash -s << 'EOF'
cat > /docker/arbeitsbericht/docker-compose.yml << 'COMPOSE'
services:
  arbeitsbericht:
    build: .
    container_name: arbeitsbericht
    restart: unless-stopped
    env_file: .env.local
    networks:
      - n8n_web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.arbeitsbericht.rule=Host(`arbeitsbericht.ennurkara.cloud`)"
      - "traefik.http.routers.arbeitsbericht.entrypoints=websecure"
      - "traefik.http.routers.arbeitsbericht.tls.certresolver=myresolver"
      - "traefik.http.services.arbeitsbericht.loadbalancer.server.port=3000"

networks:
  n8n_web:
    external: true
COMPOSE
EOF
```

- [ ] **Step 6: Build and start container**

```bash
ssh root@72.60.37.57 "cd /docker/arbeitsbericht && docker compose up --build -d"
ssh root@72.60.37.57 "docker logs arbeitsbericht --tail=30"
```

Expected: `▲ Next.js ... Ready in XXms`

- [ ] **Step 7: Verify production**

Open https://arbeitsbericht.ennurkara.cloud → login page loads → log in → dashboard accessible.

Run full wizard on production → PDF downloads → devices updated in Warenwirtschaft.

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "chore: finalize project for production deployment"
```

---

## Self-Review

**Spec coverage:**
- ✅ Separate Next.js app at arbeitsbericht.ennurkara.cloud
- ✅ Same Supabase instance (shared DB + Auth)
- ✅ `customers` table with inline create (Task 8)
- ✅ `work_reports` + `work_report_devices` tables (Task 3)
- ✅ Auto `report_number` via DB trigger (Task 3)
- ✅ RLS: mitarbeiter sees own, admin sees all (Task 3)
- ✅ 5-step wizard with autosave drafts after each step (Tasks 7–12)
- ✅ Step 1: customer select + inline create (Task 8)
- ✅ Step 2: description textarea (Task 9)
- ✅ Step 3: device multi-select from inventory, status=lager only (Task 10)
- ✅ Step 4: work hours + travel, auto-calculated from timestamps (Task 11)
- ✅ Step 5: dual signature pads via react-signature-canvas (Task 12)
- ✅ On completion: devices → `im_einsatz` + `device_movements` created (Task 13)
- ✅ PDF: modern blue header, device table, inline signatures (Task 13)
- ✅ PDF generated client-side via html2canvas + jsPDF (Task 13)
- ✅ Report detail page (Task 14)
- ✅ Docker + Traefik deployment (Task 15)
- ✅ Mobile bottom tab bar navbar (Task 5)
- ✅ Viewer role: read-only access (Tasks 6, 7)
- ✅ `calculateWorkHours` utility covered by tests (Task 2)

**Type consistency:**
- `WizardData.reportId: string | null` — used consistently in all `saveStepN` and `handleFinish`
- `PdfTemplate` props match fields set in `handleFinish`'s `setPdfPayload` call
- `WorkReport.report_number: string | null` matches `exportReportToPdf(reportNumber: string | null)`
- `Device.status: DeviceStatus` — `'lager'` filter in StepGeraete matches the enum value
