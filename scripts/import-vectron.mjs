// scripts/import-vectron.mjs
//
// One-off import: liest Vectron-Daten aus data/vectron-operators/* und
// schreibt sie idempotent in customers, customer_sites, devices, vectron_details.
//
// Usage:
//   node scripts/import-vectron.mjs --dry      # dry run, kein Schreiben
//   node scripts/import-vectron.mjs            # echter Lauf
//
// Filter: nur operatorContractStillActive (Heartbeat < 90 Tage).
// Idempotent ueber UNIQUE-Anker:
//   customers.vectron_operator_id
//   customer_sites.vectron_site_id
//   devices.serial_number
//   vectron_details.vectron_cash_register_id

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data", "vectron-operators");

// dotenv-light: lese .env.local fuer lokale Laeufe; in CI fallen wir auf
// process.env zurueck (Secrets werden via env: am Step injected).
const env = (() => {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return process.env;
  const fileEnv = Object.fromEntries(
    readFileSync(path, "utf-8")
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      }),
  );
  return { ...process.env, ...fileEnv };
})();

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local oder env-vars)");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const DRY = process.argv.includes("--dry");

// ---- Load source data ------------------------------------------------------

const operators = readdirSync(join(DATA, "vectron_export"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(DATA, "vectron_export", f), "utf-8")));

const cashByOp = new Map();
for (const f of readdirSync(join(DATA, "vectron_cash"))) {
  const d = JSON.parse(readFileSync(join(DATA, "vectron_cash", f), "utf-8"));
  cashByOp.set(d.operatorId, d.sites ?? {});
}

const states = JSON.parse(readFileSync(join(DATA, "vectron_states_full.json"), "utf-8"));
const stateByCashId = new Map();
for (const s of states.cashRegisterStates ?? []) stateByCashId.set(s.cashRegisterId, s);

// ---- Aktivitaets-Filter ----------------------------------------------------
//
// Aktiv = Operator-Konto ist nicht 'disabled' im MyVectron-Portal.
// Kassen-Heartbeat dient nur noch als Info (last_heartbeat_at), nicht mehr als Filter
// — auch Kunden ohne Kassen werden importiert, solange der Vertrag laeuft.

function operatorIsActive(op) {
  const o = op.operator ?? {};
  if (o.disabled) return false;
  if (o.rejected) return false;
  return true;
}

function lastHeartbeatFor(opId) {
  const sites = cashByOp.get(opId) ?? {};
  let last = 0;
  for (const regs of Object.values(sites)) {
    if (!Array.isArray(regs)) continue;
    for (const cr of regs) {
      const st = stateByCashId.get(cr.cashRegisterId);
      const ts = st?.lastHeartbeatReceivedAt ?? st?.lastInvoiceReceivedAt;
      if (ts) {
        const t = Date.parse(ts);
        if (t > last) last = t;
      }
    }
  }
  return last ? new Date(last).toISOString() : null;
}

// ---- Model lookup (Vectron) ------------------------------------------------

const { data: vectronManu, error: e1 } = await sb.from("manufacturers").select("id").eq("name", "Vectron").single();
if (e1) throw e1;
const { data: vectronModels, error: e2 } = await sb
  .from("models")
  .select("id, modellname")
  .eq("manufacturer_id", vectronManu.id);
if (e2) throw e2;

const modelByLowerName = new Map();
for (const m of vectronModels) modelByLowerName.set(m.modellname.toLowerCase(), m.id);

// Aliases: Vectron-API-Typ -> canonical Modell-Name
const TYPE_ALIASES = {
  "mini ii": "POS Mini II",
};
const skippedTypes = new Map();
function resolveModel(type) {
  if (!type) {
    skippedTypes.set("(null)", (skippedTypes.get("(null)") ?? 0) + 1);
    return null;
  }
  const key = TYPE_ALIASES[type.toLowerCase()] ?? type;
  const id = modelByLowerName.get(key.toLowerCase());
  if (!id) {
    skippedTypes.set(type, (skippedTypes.get(type) ?? 0) + 1);
    return null;
  }
  return id;
}

// ---- UPSERT helpers --------------------------------------------------------

async function upsertCustomer(op, lastHeartbeat) {
  const o = op.operator ?? {};
  const row = {
    name: o.companyName ?? op.name,
    customer_kind: "vectron",
    email: o.email ?? null,
    phone: o.phone ?? null,
    address: o.streetAddress ?? null,
    postal_code: o.zipcode ?? null,
    city: o.city ?? null,
    country: o.country ?? "DE",
    vat_id: o.vatRegistrationNumber ?? null,
    tax_number: o.taxNumber ?? null,
    customer_number: o.customerNumber != null ? String(o.customerNumber) : null,
    vectron_operator_id: op.operatorId,
    last_heartbeat_at: lastHeartbeat,
  };
  if (DRY) return { id: "DRY", ...row };
  const { data, error } = await sb
    .from("customers")
    .upsert(row, { onConflict: "vectron_operator_id" })
    .select("id")
    .single();
  if (error) throw new Error(`customer upsert ${op.operatorId}: ${error.message}`);
  return data;
}

async function upsertSite(customerId, site) {
  const a = site.address ?? {};
  const row = {
    customer_id: customerId,
    vectron_site_id: site.siteUuid,
    site_no: site.siteNo ?? null,
    name: site.name ?? "(unbenannt)",
    street: a.streetAddress ?? null,
    postal_code: a.zipCode ?? null,
    city: a.city ?? null,
    country: a.country ?? "DE",
    email: site.email ?? null,
    phone: site.phone ?? null,
  };
  if (DRY) return { id: "DRY", ...row };
  const { data, error } = await sb
    .from("customer_sites")
    .upsert(row, { onConflict: "vectron_site_id" })
    .select("id")
    .single();
  if (error) throw new Error(`site upsert ${site.siteUuid}: ${error.message}`);
  return data;
}

async function upsertDevice(serial, modelId, customerId, siteId) {
  const row = {
    serial_number: serial,
    model_id: modelId,
    status: "im_einsatz",
    current_customer_id: customerId,
    site_id: siteId,
  };
  if (DRY) return { id: "DRY", ...row };
  const { data, error } = await sb
    .from("devices")
    .upsert(row, { onConflict: "serial_number" })
    .select("id")
    .single();
  if (error) throw new Error(`device upsert ${serial}: ${error.message}`);
  return data;
}

// Master-Passwort der Kasse (8-stellig numerisch) liegt in einer separaten
// admin-only-RLS-Tabelle, damit es nicht via DEVICE_SELECT in
// lib/inventory/queries.ts mit raus-gejoined werden kann. Service-Role
// bypassed RLS — UPSERT funktioniert direkt.
async function upsertMasterPassword(deviceId, password) {
  // null nicht überschreiben — falls Vectron das Feld mal nicht ausliefert,
  // wollen wir kein gespeichertes Passwort verlieren.
  if (password == null) return false;
  if (DRY) return true;
  const { error } = await sb
    .from("vectron_master_passwords")
    .upsert({ device_id: deviceId, master_password: password }, { onConflict: "device_id" });
  if (error) throw new Error(`master_password upsert ${deviceId}: ${error.message}`);
  return true;
}

async function upsertVectronDetails(deviceId, cr, st) {
  const row = {
    device_id: deviceId,
    sw_serial: cr.serialNumber ?? null,
    sw_version: st?.version ?? null,
    os_version: st?.operatingSystem ?? null,
    platform: st?.platform ?? null,
    login: cr.login ?? null,
    connect_id: cr.maintenanceConfiguration?.connectId ?? null,
    fiscal_identifier: cr.fiscalIdentifier != null ? String(cr.fiscalIdentifier) : null,
    last_heartbeat_at: st?.lastHeartbeatReceivedAt ?? null,
    vectron_cash_register_id: cr.cashRegisterId,
  };
  if (DRY) return row;
  const { error } = await sb
    .from("vectron_details")
    .upsert(row, { onConflict: "device_id" });
  if (error) throw new Error(`vectron_details upsert ${cr.cashRegisterId}: ${error.message}`);
  return row;
}

// ---- Main loop -------------------------------------------------------------

const stats = {
  operators: 0,
  customersWritten: 0,
  sitesWritten: 0,
  devicesWritten: 0,
  detailsWritten: 0,
  masterPwdsWritten: 0,
  skippedDisabled: 0,
  customersWithoutSites: 0,
  sitesWithoutCash: 0,
  skippedUnknownModel: 0,
  errors: 0,
};

for (const op of operators) {
  stats.operators++;
  if (!operatorIsActive(op)) {
    stats.skippedDisabled++;
    continue;
  }
  const lastHeartbeat = lastHeartbeatFor(op.operatorId);
  const cashSites = cashByOp.get(op.operatorId) ?? {};

  try {
    const customer = await upsertCustomer(op, lastHeartbeat);
    if (!DRY) stats.customersWritten++;

    if (!Array.isArray(op.sites) || op.sites.length === 0) {
      stats.customersWithoutSites++;
      continue;
    }

    for (const site of op.sites) {
      const siteRow = await upsertSite(customer.id, site);
      if (!DRY) stats.sitesWritten++;

      const registers = cashSites[site.siteUuid];
      if (!Array.isArray(registers) || registers.length === 0) {
        stats.sitesWithoutCash++;
        continue;
      }
      for (const cr of registers) {
        const st = stateByCashId.get(cr.cashRegisterId);
        const modelId = resolveModel(st?.type);
        if (!modelId) {
          stats.skippedUnknownModel++;
          continue;
        }
        const device = await upsertDevice(cr.serialNumber, modelId, customer.id, siteRow.id);
        if (!DRY) stats.devicesWritten++;
        await upsertVectronDetails(device.id, cr, st);
        if (!DRY) stats.detailsWritten++;
        const wrotePwd = await upsertMasterPassword(device.id, cr.masterPassword);
        if (!DRY && wrotePwd) stats.masterPwdsWritten++;
      }
    }
  } catch (e) {
    stats.errors++;
    console.error("ERROR:", op.operatorId, op.name, "—", e.message);
  }
}

console.log("\n=== Import-Statistik ===");
console.log(JSON.stringify(stats, null, 2));
if (skippedTypes.size > 0) {
  console.log("\n=== Skipped types (kein Modell gefunden) ===");
  for (const [t, n] of [...skippedTypes.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t}: ${n}`);
  }
}
if (DRY) console.log("\n[DRY RUN] — nichts geschrieben.");
