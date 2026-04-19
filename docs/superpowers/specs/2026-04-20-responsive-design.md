# Responsive Design Overhaul — Warenwirtschaft

**Date:** 2026-04-20  
**Status:** Approved  
**Scope:** All resolutions — Mobile (< 768px), Tablet (768–1023px), Desktop (≥ 1024px)

---

## Context

The app is used equally across all device types. Currently it has minimal responsive support (9 breakpoint instances across 34+ files). The navbar breaks on mobile, the device table overflows, and forms are fixed 2-column on all screen sizes.

---

## Breakpoint Strategy

| Tailwind | Device | Width | Navigation |
|---|---|---|---|
| default | Smartphone | < 768px | Bottom Tab Bar |
| `md:` | Tablet | 768–1023px | Top Navbar (compact) |
| `lg:` | Desktop | ≥ 1024px | Top Navbar (full) |

---

## Area 1 — Navigation

**Mobile (< 768px):**
- Top bar shows only logo + user avatar/profile icon
- Bottom Tab Bar with 4 tabs: Dashboard, Inventar, Bewegungen, Chat
- Admin link appears as 5th tab only for admin role
- Chat FAB hidden on mobile (tab replaces it)
- Implemented via `md:hidden` / `hidden md:flex` — no Sheet/Drawer needed

**Tablet/Desktop (≥ 768px):**
- Existing top navbar unchanged
- Chat FAB visible as before

**Content padding:**
- Mobile: `pb-20` on `<main>` to prevent content hiding behind tab bar
- Container: `px-4 sm:px-6 lg:px-8`

---

## Area 2 — Device List

**Mobile (< 768px):**
- New `<DeviceCard>` component replaces table rows
- Each card shows: category icon, device name, location, status badge, quantity
- Card tap navigates to device detail page
- Filter bar stacks vertically, inputs `w-full`
- Table hidden via `hidden md:block`

**Tablet/Desktop (≥ 768px):**
- Existing 8-column table unchanged
- Filter bar horizontal with `md:w-48` fixed widths

**DeviceCard structure:**
```tsx
<div className="flex items-center gap-3 p-3 bg-card rounded-lg">
  <CategoryIcon />  {/* 36x36 rounded */}
  <div className="flex-1 min-w-0">
    <p className="font-medium truncate">{name}</p>
    <p className="text-xs text-muted-foreground">{location} · {serialNumber}</p>
  </div>
  <div className="flex flex-col items-end gap-1">
    <StatusBadge />
    <span className="text-sm">{quantity}×</span>
  </div>
</div>
```

---

## Area 3 — Forms

**DeviceForm (`/inventory/new`, `/inventory/[id]`):**
- Mobile: `grid-cols-1` (single column, full-width inputs)
- Tablet+: `sm:grid-cols-2` (existing 2-column layout)
- All `<Select>` triggers: `w-full sm:w-48` / `w-full sm:w-40`

**No structural changes** to form logic, validation, or submission.

---

## Area 4 — Movements & Admin

**Movement list rows:**
- Mobile: `flex-col` stack (badge, name, quantity, user, date each on own line with label)
- Tablet+: existing `flex-row` with `sm:flex-row`

**Admin pages (categories, users):**
- Header actions: `flex flex-col sm:flex-row` gap adjustments
- Table/list items: same `flex-col sm:flex-row` pattern
- No structural redesign

---

## Implementation Order (Layout-First)

1. **Navbar + Bottom Tab Bar** — shared layout, all pages benefit immediately
2. **Container & Spacing** — `pb-20 md:pb-0` on main, updated padding
3. **DeviceCard component** — new component, conditionally rendered on mobile
4. **DeviceForm** — add `sm:` breakpoints to grid and select widths
5. **Movements + Admin** — `flex-col sm:flex-row` stacking
6. **Filter Bar** — `w-full md:w-auto` on all select triggers

---

## Out of Scope

- Dark/light mode toggle (already consistent)
- Chat window height fix (separate concern)
- Dashboard stats cards (already responsive with `md:grid-cols-4`)
- CategoryGrid (already responsive with `sm:grid-cols-2 lg:grid-cols-3`)
- Login page (already centered, works on mobile)
