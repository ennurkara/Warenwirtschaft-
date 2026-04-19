# Inventory Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the inventory page so categories are the primary navigation — users click a category tile to see its devices.

**Architecture:** The `/inventory` page uses a query parameter (`?category=<id>`) to switch between a category grid view and a filtered device list. Server Component decides which view to render based on `searchParams.category`. Two new components: `CategoryGrid` and `CategoryDeviceList`.

**Tech Stack:** Next.js 14 App Router, Supabase (server-side queries), Tailwind CSS, shadcn/ui Card component, Lucide React icons.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `components/inventory/category-icon.tsx` | Create | Lucide icon name → React component lookup |
| `components/inventory/category-grid.tsx` | Create | Category tiles in a grid with "Alle Geräte" tile |
| `components/inventory/category-device-list.tsx` | Create | Breadcrumb + filtered DeviceList wrapper |
| `app/(protected)/inventory/page.tsx` | Modify | Add `searchParams` handling, conditional rendering |
| `components/inventory/device-list.tsx` | Modify | Add `hideCategoryFilter` prop |
| `lib/types.ts` | Modify | Add `CategoryWithCount` interface |

---

### Task 1: Create Lucide Icon Lookup Component

**Files:**
- Create: `components/inventory/category-icon.tsx`

- [ ] **Step 1: Create the icon lookup component**

The DB stores Lucide icon name strings (e.g., `"printer"`, `"cash-register"`). This component maps those strings to actual Lucide React components, with a fallback to `Package` for unknown/missing icons.

```tsx
import {
  CashRegister,
  Printer,
  Scan,
  Cable,
  Monitor,
  Keyboard,
  MousePointer,
  Network,
  Package,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  'cash-register': CashRegister,
  'printer': Printer,
  'scan': Scan,
  'cable': Cable,
  'monitor': Monitor,
  'keyboard': Keyboard,
  'mouse-pointer': MousePointer,
  'network': Network,
}

interface CategoryIconProps {
  name: string | null
  className?: string
}

export function CategoryIcon({ name, className }: CategoryIconProps) {
  const Icon = (name && ICON_MAP[name]) ?? Package
  return <Icon className={className} />
}

export { Package as AllDevicesIcon }
```

- [ ] **Step 2: Commit**

```bash
git add components/inventory/category-icon.tsx
git commit -m "feat: add CategoryIcon component for Lucide icon lookup"
```

---

### Task 2: Add CategoryWithCount Type

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add the CategoryWithCount interface**

Add after the existing `Category` interface:

```ts
export interface CategoryWithCount extends Category {
  device_count: number
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add CategoryWithCount type for category grid"
```

---

### Task 3: Create CategoryGrid Component

**Files:**
- Create: `components/inventory/category-grid.tsx`

- [ ] **Step 1: Create the CategoryGrid component**

Renders all category tiles in a responsive grid plus an "Alle Geräte" tile. Each tile is a clickable Card linking to `/inventory?category=<id>`. Uses shadcn `Card` component and the new `CategoryIcon`.

```tsx
'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { CategoryIcon, AllDevicesIcon } from './category-icon'
import type { CategoryWithCount } from '@/lib/types'

interface CategoryGridProps {
  categories: CategoryWithCount[]
  totalDevices: number
  canAdd: boolean
}

export function CategoryGrid({ categories, totalDevices, canAdd }: CategoryGridProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventar</h1>
        {canAdd && (
          <Link href="/inventory/new" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Gerät hinzufügen
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/inventory?category=all">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="flex flex-col items-center justify-center p-6 text-center">
              <AllDevicesIcon className="h-8 w-8 mb-2 text-slate-600" />
              <span className="font-medium">Alle Geräte</span>
              <span className="text-sm text-muted-foreground">{totalDevices} Geräte</span>
            </CardContent>
          </Card>
        </Link>
        {categories.map(category => (
          <Link key={category.id} href={`/inventory?category=${category.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <CategoryIcon name={category.icon} className="h-8 w-8 mb-2 text-slate-600" />
                <span className="font-medium">{category.name}</span>
                <span className="text-sm text-muted-foreground">
                  {category.device_count} Gerät{category.device_count !== 1 ? 'e' : ''}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/inventory/category-grid.tsx
git commit -m "feat: add CategoryGrid component with category tiles"
```

---

### Task 4: Add hideCategoryFilter Prop to DeviceList

**Files:**
- Modify: `components/inventory/device-list.tsx`

- [ ] **Step 1: Add `hideCategoryFilter` prop**

Modify the `DeviceListProps` interface and the component to optionally hide the category dropdown filter. When navigating from a category tile, the user already chose a category — showing the dropdown is redundant.

Change the interface:

```ts
interface DeviceListProps {
  devices: Device[]
  categories: Category[]
  canAdd: boolean
  hideCategoryFilter?: boolean
}
```

Update the function signature:

```ts
export function DeviceList({ devices, categories, canAdd, hideCategoryFilter }: DeviceListProps) {
```

Wrap the category Select in a conditional. Replace the existing category Select block (lines 57-67) with:

```tsx
{!hideCategoryFilter && (
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
)}
```

When `hideCategoryFilter` is true, `categoryFilter` stays at `'all'` so the filtering still works correctly (all devices in the passed list are shown).

- [ ] **Step 2: Commit**

```bash
git add components/inventory/device-list.tsx
git commit -m "feat: add hideCategoryFilter prop to DeviceList"
```

---

### Task 5: Create CategoryDeviceList Component

**Files:**
- Create: `components/inventory/category-device-list.tsx`

- [ ] **Step 1: Create the CategoryDeviceList component**

This component renders a breadcrumb header (link back to category grid) plus the existing `DeviceList`. It's a client component that wraps DeviceList with navigation context.

```tsx
'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DeviceList } from './device-list'
import type { Device, Category } from '@/lib/types'

interface CategoryDeviceListProps {
  devices: Device[]
  categories: Category[]
  canAdd: boolean
  categoryName: string
  hideCategoryFilter: boolean
}

export function CategoryDeviceList({
  devices,
  categories,
  canAdd,
  categoryName,
  hideCategoryFilter,
}: CategoryDeviceListProps) {
  return (
    <div className="space-y-4">
      <Link href="/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Inventar
      </Link>
      <span className="text-muted-foreground mx-2">/</span>
      <span className="text-sm font-medium">{categoryName}</span>
      <DeviceList
        devices={devices}
        categories={categories}
        canAdd={canAdd}
        hideCategoryFilter={hideCategoryFilter}
      />
    </div>
  )
}
```

Note: The breadcrumb and DeviceList heading ("Inventar") will both appear. We need to suppress the heading inside DeviceList when used inside CategoryDeviceList. Add a `hideHeading` prop to DeviceList.

- [ ] **Step 2: Add `hideHeading` prop to DeviceList**

In `components/inventory/device-list.tsx`, add `hideHeading?: boolean` to the interface and conditionally render the heading:

```ts
interface DeviceListProps {
  devices: Device[]
  categories: Category[]
  canAdd: boolean
  hideCategoryFilter?: boolean
  hideHeading?: boolean
}
```

```ts
export function DeviceList({ devices, categories, canAdd, hideCategoryFilter, hideHeading }: DeviceListProps) {
```

Replace the heading section:

```tsx
{!hideHeading && (
  <h1 className="text-2xl font-semibold">Inventar</h1>
)}
```

Also hide the "Gerät hinzufügen" button when hideHeading is true (it's part of the header row). Wrap the entire header row:

```tsx
{!hideHeading && (
  <div className="flex items-center justify-between">
    <h1 className="text-2xl font-semibold">Inventar</h1>
    {canAdd && (
      <Link href="/inventory/new">
        <Button>Gerät hinzufügen</Button>
      </Link>
    )}
  </div>
)}
```

Update CategoryDeviceList to pass `hideHeading`:

```tsx
<DeviceList
  devices={devices}
  categories={categories}
  canAdd={canAdd}
  hideCategoryFilter={hideCategoryFilter}
  hideHeading
/>
```

And add "Gerät hinzufügen" button to CategoryDeviceList's own header when `canAdd` is true:

```tsx
export function CategoryDeviceList({
  devices,
  categories,
  canAdd,
  categoryName,
  hideCategoryFilter,
}: CategoryDeviceListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Inventar
          </Link>
          <span className="text-muted-foreground mx-2">/</span>
          <span className="text-sm font-medium">{categoryName}</span>
        </div>
        {canAdd && (
          <Link href="/inventory/new" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Gerät hinzufügen
          </Link>
        )}
      </div>
      <DeviceList
        devices={devices}
        categories={categories}
        canAdd={canAdd}
        hideCategoryFilter={hideCategoryFilter}
        hideHeading
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/inventory/category-device-list.tsx components/inventory/device-list.tsx
git commit -m "feat: add CategoryDeviceList with breadcrumb and filtered DeviceList"
```

---

### Task 6: Modify Inventory Page to Handle Category Query Parameter

**Files:**
- Modify: `app/(protected)/inventory/page.tsx`

- [ ] **Step 1: Rewrite the inventory page**

The page now checks `searchParams.category` and renders either `CategoryGrid` or `CategoryDeviceList`. When a category ID is provided, it fetches only that category's devices. Invalid category IDs redirect to `/inventory`.

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CategoryGrid } from '@/components/inventory/category-grid'
import { CategoryDeviceList } from '@/components/inventory/category-device-list'
import type { Device, Category, CategoryWithCount, Profile } from '@/lib/types'

interface PageProps {
  searchParams: { category?: string }
}

export default async function InventoryPage({ searchParams }: PageProps) {
  const categoryId = searchParams.category
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const canAdd = (profile as Profile)?.role !== 'viewer'

  if (!categoryId) {
    const [{ data: categories }, { data: devices }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('devices').select('category_id'),
    ])

    const countMap: Record<string, number> = {}
    for (const d of devices ?? []) {
      if (d.category_id) {
        countMap[d.category_id] = (countMap[d.category_id] ?? 0) + 1
      }
    }

    const categoriesWithCount: CategoryWithCount[] = (categories ?? []).map(c => ({
      ...c,
      device_count: countMap[c.id] ?? 0,
    }))

    return (
      <CategoryGrid
        categories={categoriesWithCount}
        totalDevices={devices?.length ?? 0}
        canAdd={canAdd}
      />
    )
  }

  if (categoryId === 'all') {
    const [{ data: devices }, { data: categories }] = await Promise.all([
      supabase.from('devices').select('*, category:categories(*)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
    ])

    return (
      <CategoryDeviceList
        devices={(devices ?? []) as Device[]}
        categories={(categories ?? []) as Category[]}
        canAdd={canAdd}
        categoryName="Alle Geräte"
        hideCategoryFilter={false}
      />
    )
  }

  const { data: category } = await supabase.from('categories').select('*').eq('id', categoryId).single()
  if (!category) {
    redirect('/inventory')
  }

  const { data: devices } = await supabase
    .from('devices')
    .select('*, category:categories(*)')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false })

  const { data: categories } = await supabase.from('categories').select('*').order('name')

  return (
    <CategoryDeviceList
      devices={(devices ?? []) as Device[]}
      categories={(categories ?? []) as Category[]}
      canAdd={canAdd}
      categoryName={category.name}
      hideCategoryFilter
    />
  )
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(protected\)/inventory/page.tsx
git commit -m "feat: add category-based navigation to inventory page"
```

---

### Task 7: Visual Verification

**Files:** None (manual testing)

- [ ] **Step 1: Start dev server and test in browser**

Run: `npm run dev`

1. Navigate to `/inventory` — should see category grid with tiles (including "Alle Geräte")
2. Click "Alle Geräte" — should see all devices in flat list with breadcrumb "Inventar / Alle Geräte"
3. Click "Drucker" — should see only printers with breadcrumb "Inventar / Drucker", no category dropdown
4. Click breadcrumb "Inventar" link — should go back to category grid
5. Click "Gerät hinzufügen" from grid view — should go to `/inventory/new`
6. Verify browser back button works correctly between views

- [ ] **Step 2: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address visual issues from inventory category testing"
```

---

### Task 8: Handle Empty Category Edge Case

**Files:**
- Modify: `components/inventory/device-list.tsx`

- [ ] **Step 1: Add empty state message for category-filtered view**

When a category has no devices, the DeviceList shows "Keine Geräte gefunden." which is already fine. However, we should make the message more specific when `hideCategoryFilter` is true (meaning we're in a category view):

In the empty state section (around line 96-100), update:

```tsx
{filtered.length === 0 && (
  <TableRow>
    <TableCell colSpan={8} className="text-center text-slate-500 py-8">
      {hideCategoryFilter
        ? 'Keine Geräte in dieser Kategorie.'
        : 'Keine Geräte gefunden.'}
    </TableCell>
  </TableRow>
)}
```

- [ ] **Step 2: Commit**

```bash
git add components/inventory/device-list.tsx
git commit -m "feat: show category-specific empty state message"
```

---

## Self-Review

**1. Spec coverage:**
- Category grid with equal tiles → Task 3
- Icon + Name + Zahl on tiles → Task 3
- "Alle Geräte" tile → Task 3
- Lucide icon rendering → Task 1
- Breadcrumb navigation → Task 5
- Category-filtered DeviceList → Task 5, 6
- Hide category dropdown when in category → Task 4
- URL-based navigation with query param → Task 6
- Invalid category redirect → Task 6
- Empty category message → Task 8
- CategoryWithCount type → Task 2

**2. Placeholder scan:** No TBDs, TODOs, or vague steps. All code is provided.

**3. Type consistency:** `CategoryWithCount` extends `Category` — used in Task 2 and Task 6. `CategoryIconProps`, `CategoryGridProps`, `CategoryDeviceListProps`, `DeviceListProps` are consistent across tasks. `hideCategoryFilter` and `hideHeading` are added to DeviceList in Task 4 and Task 5 respectively.

**Gap found and fixed:** Next.js 14 uses plain `searchParams` object (not `Promise<>`). Task 6 code uses the correct Next.js 14 pattern.