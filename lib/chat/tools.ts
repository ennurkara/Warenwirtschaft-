// lib/chat/tools.ts
//
// Read-only Tool-Registry für den Chat-Assistenten. Jedes Tool hat ein
// OpenAI-Function-Schema + einen Handler, der den ÜBERGEBENEN supabase
// Client benutzt — KEIN Service-Role-Bypass. Damit gilt RLS für jeden
// Tool-Call und Mitarbeiter/Techniker sehen nur, was sie auch über die
// UI sehen würden.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ToolSpec {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description?: string; enum?: string[] }>
    required?: string[]
  }
}

type Handler = (supabase: SupabaseClient, args: Record<string, unknown>) => Promise<unknown>

// ──────────────────────────────────────────────────────────────────────
// Schemas
// ──────────────────────────────────────────────────────────────────────

const SCHEMAS: ToolSpec[] = [
  {
    name: 'fetchCustomers',
    description: 'Sucht Kunden anhand Name (Substring) und/oder Gruppe (vectron|apro|sonstige). Liefert max 20 Treffer mit ID, Name, Gruppe, Adresse, E-Mail. Ohne Filter: alle Kunden.',
    parameters: {
      type: 'object',
      properties: {
        searchName: { type: 'string', description: 'Teilstring im Kundennamen' },
        kind: { type: 'string', enum: ['vectron', 'apro', 'sonstige'], description: 'Kunden-Gruppe' },
      },
    },
  },
  {
    name: 'fetchCustomerDetails',
    description: 'Komplette Kundenkartei: Stammdaten, aktiver Vertrag, Lizenzen, Geräte beim Kunden, letzte Arbeitsberichte. Brauche customerId.',
    parameters: {
      type: 'object',
      properties: { customerId: { type: 'string', description: 'UUID des Kunden' } },
      required: ['customerId'],
    },
  },
  {
    name: 'fetchDevices',
    description: 'Sucht Geräte. Filter optional: searchTerm (Seriennummer oder Modellname Substring), categoryName (z.B. "TSE Swissbit", "Kassenhardware"), status. Liefert max 30.',
    parameters: {
      type: 'object',
      properties: {
        searchTerm: { type: 'string' },
        categoryName: { type: 'string' },
        status: { type: 'string', enum: ['lager', 'reserviert', 'verkauft', 'verliehen', 'in_reparatur', 'defekt', 'ausgemustert'] },
      },
    },
  },
  {
    name: 'fetchTseExpiringSoon',
    description: 'TSEs sortiert nach Ablaufdatum (frühestes zuerst). Optional withinDays als Filter. Default: 5 Stück.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'max Einträge, default 5' },
        withinDays: { type: 'number', description: 'nur TSEs deren Ablauf in N Tagen oder weniger ist' },
      },
    },
  },
  {
    name: 'fetchAproLicenseCatalog',
    description: 'Apro-Lizenz-Katalog inkl. ALLER PREISE (EK einmalig, VK einmalig, monatliche Update-Gebühr EK + VK). Bei jeder Preis-Frage zu einer Apro-Lizenz dieses Tool aufrufen. Suche ist whitespace-tolerant (extra Leerzeichen werden normalisiert), case-insensitive, Substring-Match. Beispiel-Suchen: "Kasse 9", "Kassenbuch", "Handy 10".',
    parameters: {
      type: 'object',
      properties: {
        searchName: { type: 'string', description: 'Teilstring aus dem Modellnamen, beliebige Reihenfolge der Worte ist OK' },
      },
    },
  },
  {
    name: 'fetchWorkReportStats',
    description: 'Arbeitsbericht-Zahlen: heute, diese Woche, dieser Monat, gesamt + offene Entwürfe. mineOnly=true: nur die des aufrufenden Users. Sonst alle.',
    parameters: {
      type: 'object',
      properties: { mineOnly: { type: 'boolean' } },
    },
  },
  {
    name: 'fetchRecentWorkReports',
    description: 'Letzte abgeschlossene Arbeitsberichte mit Bericht-Nr, Kunde, Techniker, Datum. Default 10. Optional customerName als Filter (Substring).',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        customerName: { type: 'string' },
      },
    },
  },
  {
    name: 'fetchStockOverview',
    description: 'Bestandsübersicht für kind=stock Kategorien (Bonrollen, USB-Sticks, Installationsmaterial): pro Modell aktuelle Menge.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'fetchInventoryKpi',
    description: 'KPI-Werte: Anzahl Geräte im Lager, Bestandswert EK, Anzahl unvollständiger Geräte (ohne EK-Beleg). Aggregiert.',
    parameters: { type: 'object', properties: {} },
  },
]

// ──────────────────────────────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────────────────────────────

const fetchCustomers: Handler = async (supabase, args) => {
  const { searchName, kind } = args as { searchName?: string; kind?: string }
  let q = supabase
    .from('customers')
    .select('id, name, customer_kind, address, postal_code, city, email, phone')
    .order('name')
    .limit(20)
  if (searchName) q = q.ilike('name', `%${searchName}%`)
  if (kind) q = q.eq('customer_kind', kind)
  const { data, error } = await q
  if (error) return { error: error.message }
  return data
}

const fetchCustomerDetails: Handler = async (supabase, args) => {
  const { customerId } = args as { customerId: string }
  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()
  if (cErr) return { error: cErr.message }

  const [{ data: contracts }, { data: licenses }, { data: devices }, { data: reports }] = await Promise.all([
    supabase.from('contracts').select('*').eq('customer_id', customerId),
    supabase.from('licenses').select('id, name, status, monthly_update_fee, vk_preis').eq('customer_id', customerId),
    supabase
      .from('devices')
      .select('id, serial_number, status, model:models(modellname, category:categories(name))')
      .eq('current_customer_id', customerId),
    supabase
      .from('work_reports')
      .select('id, report_number, status, start_time, completed_at')
      .eq('customer_id', customerId)
      .order('start_time', { ascending: false })
      .limit(10),
  ])

  return { customer, contracts, licenses, devices, recent_reports: reports }
}

const fetchDevices: Handler = async (supabase, args) => {
  const { searchTerm, categoryName, status } = args as {
    searchTerm?: string; categoryName?: string; status?: string
  }
  let q = supabase
    .from('devices')
    .select(`
      id, serial_number, status, location, current_customer_id,
      model:models(modellname, manufacturer:manufacturers(name), category:categories(name))
    `)
    .order('serial_number')
    .limit(30)
  if (status) q = q.eq('status', status)
  if (searchTerm) q = q.ilike('serial_number', `%${searchTerm}%`)
  const { data, error } = await q
  if (error) return { error: error.message }
  type DeviceRow = {
    id: string
    serial_number: string | null
    status: string
    location: string | null
    current_customer_id: string | null
    model?: { modellname?: string; manufacturer?: { name?: string } | null; category?: { name?: string } | null } | null
  }
  let rows = (data ?? []) as unknown as DeviceRow[]
  if (categoryName) {
    rows = rows.filter(r => r.model?.category?.name === categoryName)
  }
  return rows
}

const fetchTseExpiringSoon: Handler = async (supabase, args) => {
  const { limit = 5, withinDays } = args as { limit?: number; withinDays?: number }
  let q = supabase
    .from('tse_details')
    .select(`
      device_id, kind, expires_at, bsi_k_tr_number,
      device:devices!tse_details_device_id_fkey(serial_number, customer:customers!current_customer_id(name)),
      kasse:devices!tse_details_installed_in_device_fkey(serial_number, model:models(modellname))
    `)
    .not('expires_at', 'is', null)
    .order('expires_at', { ascending: true })
    .limit(Math.min(limit, 50))
  if (withinDays != null) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + withinDays)
    q = q.lte('expires_at', cutoff.toISOString().slice(0, 10))
  }
  const { data, error } = await q
  if (error) return { error: error.message }
  return data
}

const fetchAproLicenseCatalog: Handler = async (supabase, args) => {
  const { searchName } = args as { searchName?: string }
  // Alle ~53 Apro-Lizenzen laden — klein genug, dann clientseitig filtern.
  // Server-Filter via ilike scheitert an doppelten Whitespaces in den
  // Modellnamen (Excel-Import hat manche mit "APRO. Kasse  9" angelegt).
  const { data, error } = await supabase
    .from('models')
    .select(`
      id, modellname, default_ek, default_vk,
      default_monthly_update_fee_ek, default_monthly_update_fee_vk, notes,
      manufacturer:manufacturers(name), category:categories(name)
    `)
    .order('modellname')
    .limit(200)
  if (error) return { error: error.message }
  type Row = {
    modellname: string
    manufacturer?: { name?: string } | null
    category?: { name?: string } | null
  }
  const all = (data ?? []) as unknown as Row[]
  const apro = all.filter(r => r.manufacturer?.name === 'Apro' && r.category?.name === 'Apro-Lizenz')
  if (!searchName) return apro
  // Tokenize Suche + Modellnamen: lowercase, Whitespace kollabiert, alle Tokens
  // müssen im Namen vorkommen (Reihenfolge egal). Robuster gegen "Kasse 9" vs.
  // "APRO. Kasse  9" als ein einfacher ilike.
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const tokens = normalize(searchName).split(' ').filter(Boolean)
  return apro.filter(r => {
    const hay = normalize(r.modellname)
    return tokens.every(t => hay.includes(t))
  })
}

const fetchWorkReportStats: Handler = async (supabase, args) => {
  const { mineOnly } = args as { mineOnly?: boolean }
  const { data: { user } } = await supabase.auth.getUser()
  const techId = mineOnly && user ? user.id : null

  const now = new Date()
  const dayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const weekIso = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()).toISOString()
  const monthIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  async function count(fromIso: string | null, status: 'abgeschlossen' | 'entwurf') {
    let q = supabase.from('work_reports').select('id', { count: 'exact', head: true }).eq('status', status)
    if (techId) q = q.eq('technician_id', techId)
    if (fromIso) q = q.gte('completed_at', fromIso)
    const { count: c } = await q
    return c ?? 0
  }

  const [today, thisWeek, thisMonth, total, drafts] = await Promise.all([
    count(dayIso, 'abgeschlossen'),
    count(weekIso, 'abgeschlossen'),
    count(monthIso, 'abgeschlossen'),
    count(null, 'abgeschlossen'),
    count(null, 'entwurf'),
  ])
  return { today, thisWeek, thisMonth, total, drafts, scope: techId ? 'mine' : 'all' }
}

const fetchRecentWorkReports: Handler = async (supabase, args) => {
  const { limit = 10, customerName } = args as { limit?: number; customerName?: string }
  let q = supabase
    .from('work_reports')
    .select(`
      id, report_number, status, start_time, completed_at,
      customer:customers(name),
      technician:profiles!work_reports_technician_id_fkey(full_name)
    `)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(Math.min(limit, 30))
  const { data, error } = await q
  if (error) return { error: error.message }
  let rows = (data ?? []) as unknown as Array<{ customer?: { name?: string } | null }>
  if (customerName) {
    const needle = customerName.toLowerCase()
    rows = rows.filter(r => (r.customer?.name ?? '').toLowerCase().includes(needle))
  }
  return rows
}

const fetchStockOverview: Handler = async (supabase) => {
  const { data, error } = await supabase
    .from('stock_items')
    .select(`
      quantity, location,
      model:models(modellname, manufacturer:manufacturers(name), category:categories(name))
    `)
    .order('quantity', { ascending: false })
  if (error) return { error: error.message }
  const rows = (data ?? []) as unknown as Array<{
    model?: { category?: { kind?: string } | null } | null
  }>
  return rows
}

const fetchInventoryKpi: Handler = async (supabase) => {
  const [{ count: lager }, { count: incomplete }] = await Promise.all([
    supabase.from('devices').select('id', { count: 'exact', head: true }).eq('status', 'lager'),
    supabase.from('v_incomplete_devices').select('id', { count: 'exact', head: true }),
  ])
  const { data: kpi } = await supabase.from('v_dashboard_kpis').select('*').maybeSingle()
  return {
    geraete_im_lager: lager ?? 0,
    unvollstaendig: incomplete ?? 0,
    bestandswert_ek: kpi?.bestandswert_ek ?? null,
    umsatz_mtd: kpi?.umsatz_mtd ?? null,
    marge_mtd: kpi?.marge_mtd ?? null,
  }
}

// ──────────────────────────────────────────────────────────────────────
// Registry
// ──────────────────────────────────────────────────────────────────────

const HANDLERS: Record<string, Handler> = {
  fetchCustomers,
  fetchCustomerDetails,
  fetchDevices,
  fetchTseExpiringSoon,
  fetchAproLicenseCatalog,
  fetchWorkReportStats,
  fetchRecentWorkReports,
  fetchStockOverview,
  fetchInventoryKpi,
}

export const TOOL_SCHEMAS = SCHEMAS

export async function runTool(
  supabase: SupabaseClient,
  name: string,
  argsJson: string,
): Promise<unknown> {
  const handler = HANDLERS[name]
  if (!handler) return { error: `Unknown tool: ${name}` }
  let args: Record<string, unknown> = {}
  try {
    args = argsJson ? JSON.parse(argsJson) : {}
  } catch (e) {
    return { error: `Invalid JSON args: ${(e as Error).message}` }
  }
  try {
    return await handler(supabase, args)
  } catch (e) {
    return { error: (e as Error).message }
  }
}
