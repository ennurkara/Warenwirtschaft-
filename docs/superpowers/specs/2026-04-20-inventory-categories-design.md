# Inventory Categories Design

## Goal

Reorganize the inventory page so categories are the primary navigation. Users find devices with one click by selecting a category first, then seeing that category's devices.

## Current State

- `categories` table exists with `id`, `name`, `icon`, `created_at` (9 pre-seeded categories)
- `devices.category_id` FK already links devices to categories
- Current `/inventory` shows a flat device table with category dropdown filter
- Category `icon` field stores Lucide icon names but is never rendered in the UI

## Design

### Navigation Model

URL-based with query parameter on the existing `/inventory` route:

| URL | View |
|---|---|
| `/inventory` | Category grid (all category tiles) |
| `/inventory?category=<uuid>` | Device list filtered to that category |
| `/inventory?category=all` | All devices as flat list |

Filtering by category `id` (UUID) rather than slug. No DB schema changes needed. Internal tool — URL sharing is not a priority.

### Category Grid (`CategoryGrid` component)

Displayed when no `category` query param is present.

**Layout:** Equal-sized tiles in a CSS grid. Responsive: 3 columns desktop, 2 tablet, 1 mobile. Hover effect (subtle shadow/scale).

**Tile content:** Lucide icon + category name + device count (e.g., "Drucker · 5 Geräte")

**"Alle Geräte" tile:** First tile, always present. Icon: `Package` (Lucide). Links to `?category=all`.

**Icon rendering:** Map the `icon` string from DB (e.g., `"printer"`) to the corresponding Lucide React component. Use a lookup object or dynamic import.

**Empty categories:** Show "0 Geräte". Clicking shows empty list with "Keine Geräte in dieser Kategorie" message.

### Category Device List (breadcrumb + filtered DeviceList)

Displayed when `?category=<id>` or `?category=all` is present.

**Breadcrumb:** `← Inventar > [Category Name]` at the top. "Inventar" links back to `/inventory`.

**DeviceList:** Reuses the existing `DeviceList` component with devices pre-filtered server-side.

- When a specific category is selected: hide the category dropdown filter (already navigated to category).
- When `category=all`: keep category dropdown visible.
- Search field and status filter remain available in both cases.

### Data Flow

Server Component in `/inventory/page.tsx` checks `searchParams.category`:

1. **No param:** Fetch all categories + count devices per category. Render `CategoryGrid`.
2. **With param:** Fetch the category by ID, fetch devices filtered by that category. Render breadcrumb + `DeviceList`.
3. **Invalid category ID:** Redirect to `/inventory`.

All fetching is server-side. No client-side data loading for the category/device list.

### New Components

| Component | Purpose |
|---|---|
| `CategoryGrid` | Renders category tiles in a grid + "Alle Geräte" tile |
| `CategoryDeviceList` | Breadcrumb header + existing DeviceList (pre-filtered) |

Existing components (`DeviceList`, `DeviceForm`, `MovementDialog`, `OcrUpload`) remain unchanged. `DeviceList` gets an optional prop to hide the category dropdown.

### Edge Cases

- **Category with 0 devices:** Tile shows "0 Geräte". List shows empty state message.
- **Invalid category ID:** Server validates, redirects to `/inventory`.
- **No categories in DB:** Grid shows only "Alle Geräte" tile.
- **Admin adds/deletes categories:** Visible immediately since Server Components re-fetch per request.

### Out of Scope

- No category icon picker (admin continues using text field for Lucide icon names)
- No admin category page redesign
- No new DB migration
- No "Alle Geräte" row in the `categories` table (virtual tile only)
- No pagination (current behavior preserved)