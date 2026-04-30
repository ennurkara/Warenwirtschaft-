// scripts/sync-report.mjs
//
// Liest die frisch gescrapten Outputs der portal-Scraper und produziert einen
// Markdown-Diff-Report gegen die Prod-DB. Wird vom GH Actions Workflow zwischen
// scrape-and-report (Job A) und import (Job B, manuell freigegeben) ausgefuehrt.
//
// Lese-Inputs (relativ zum Repo-Root):
//   data/vectron-operators/cash_registers_full.csv
//   data/vectron-operators/vectron_states_full.json
//   data/vectron-operators/operators_full.json
//   data/apro-licenses/apro_full.json
//
// Schreibe-Output:
//   stdout         Markdown-Report
//   ENV `GITHUB_OUTPUT` (falls gesetzt): `has_changes=true|false`
//
// Exit-Code:
//   0  Diff-Report erfolgreich erzeugt (auch wenn keine Aenderungen)
//   1  Input-Files fehlen
//   2  DB-Connection-Fehler

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, appendFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ---- Env -----------------------------------------------------------------
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
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY benoetigt.");
  process.exit(2);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// ---- Input-Files laden ---------------------------------------------------
const VECTRON_CSV = join(ROOT, "data", "vectron-operators", "cash_registers_full.csv");
const VECTRON_OPS_JSON = join(ROOT, "data", "vectron-operators", "operators_full.json");
const VECTRON_STATES_JSON = join(ROOT, "data", "vectron-operators", "vectron_states_full.json");
const APRO_JSON = join(ROOT, "data", "apro-licenses", "apro_full.json");

for (const f of [VECTRON_OPS_JSON, VECTRON_STATES_JSON, APRO_JSON]) {
  if (!existsSync(f)) {
    console.error(`ERROR: Input-Datei fehlt: ${f}`);
    process.exit(1);
  }
}

const vectronOps = JSON.parse(readFileSync(VECTRON_OPS_JSON, "utf-8"));
const vectronStates = JSON.parse(readFileSync(VECTRON_STATES_JSON, "utf-8")).cashRegisterStates ?? [];
const apro = JSON.parse(readFileSync(APRO_JSON, "utf-8"));

// ---- DB-Schnappschuss ----------------------------------------------------
const { data: dbCustomers, error: ec } = await sb
  .from("customers")
  .select("id, name, customer_kind, vectron_operator_id, apro_customer_id, last_heartbeat_at");
if (ec) throw ec;

const { data: dbSites, error: es } = await sb
  .from("customer_sites")
  .select("id, customer_id, vectron_site_id, name");
if (es) throw es;

const { data: dbVectronDetails, error: ev } = await sb
  .from("vectron_details")
  .select("device_id, vectron_cash_register_id");
if (ev) throw ev;

// Master-Passwoerter: service-role bypassed RLS, daher direkt lesbar.
const { data: dbSecretsRaw, error: esec } = await sb
  .from("vectron_master_passwords")
  .select("device_id, master_password");
if (esec) throw esec;

const { data: dbLicenses, error: el } = await sb
  .from("licenses")
  .select("id, customer_id, model_id, name, quantity");
if (el) throw el;

// ---- Vectron-Diff --------------------------------------------------------
const dbVectronOpIds = new Set(
  dbCustomers.filter((c) => c.customer_kind === "vectron" && c.vectron_operator_id).map((c) => c.vectron_operator_id),
);
const dbSiteIds = new Set(dbSites.filter((s) => s.vectron_site_id).map((s) => s.vectron_site_id));
const dbCashRegisterIds = new Set(dbVectronDetails.filter((d) => d.vectron_cash_register_id).map((d) => d.vectron_cash_register_id));

const newOperators = [];
const newSites = [];
for (const op of vectronOps) {
  if (!dbVectronOpIds.has(op.operatorId)) {
    newOperators.push({ id: op.operatorId, name: op.name || op.operator?.companyName || "?" });
  }
  for (const site of op.sites ?? []) {
    if (site.siteUuid && !dbSiteIds.has(site.siteUuid)) {
      newSites.push({
        id: site.siteUuid,
        name: site.name,
        operator: op.name,
        siteNo: site.siteNo,
      });
    }
  }
}

// Master-Passwort-Diff: scrape vs. DB. KEINE Klartextwerte in den Report —
// nur Counts. Wert sitzt in vectron_master_passwords (admin-only RLS).
const VECTRON_CASH_DIR = join(ROOT, "data", "vectron-operators", "vectron_cash");
const scrapedSecrets = new Map(); // cashRegisterId -> password
if (existsSync(VECTRON_CASH_DIR)) {
  for (const f of readdirSync(VECTRON_CASH_DIR)) {
    if (!f.endsWith(".json")) continue;
    try {
      const d = JSON.parse(readFileSync(join(VECTRON_CASH_DIR, f), "utf-8"));
      for (const list of Object.values(d.sites ?? {})) {
        if (!Array.isArray(list)) continue;
        for (const cr of list) {
          const pw = cr?.masterPassword;
          if (cr?.cashRegisterId && pw) scrapedSecrets.set(cr.cashRegisterId, pw);
        }
      }
    } catch (e) {
      console.error(`WARN: kann ${f} nicht parsen: ${e.message}`);
    }
  }
}

const cashIdByDevice = new Map(dbVectronDetails.map((d) => [d.device_id, d.vectron_cash_register_id]));
const dbSecretByCashId = new Map();
for (const s of dbSecretsRaw ?? []) {
  const crId = cashIdByDevice.get(s.device_id);
  if (crId) dbSecretByCashId.set(crId, s.master_password);
}

let newSecrets = 0;
let changedSecrets = 0;
for (const [crId, scrPw] of scrapedSecrets.entries()) {
  const dbPw = dbSecretByCashId.get(crId);
  if (dbPw == null) newSecrets++;
  else if (dbPw !== scrPw) changedSecrets++;
}

const newCashRegisters = [];
for (const cr of vectronStates) {
  if (cr.cashRegisterId && !dbCashRegisterIds.has(cr.cashRegisterId)) {
    newCashRegisters.push({
      id: cr.cashRegisterId,
      serial: cr.serialNumber,
      type: cr.type,
      operator: cr.operatorCompanyName,
      site: cr.siteName,
    });
  }
}

const scrapeOpIds = new Set(vectronOps.map((op) => op.operatorId));
const goneOperators = [...dbCustomers]
  .filter((c) => c.customer_kind === "vectron" && c.vectron_operator_id && !scrapeOpIds.has(c.vectron_operator_id))
  .map((c) => ({ id: c.vectron_operator_id, name: c.name }));

// ---- APRO-Diff -----------------------------------------------------------
const dbAproIds = new Set(
  dbCustomers.filter((c) => c.customer_kind === "apro" && c.apro_customer_id).map((c) => c.apro_customer_id),
);

const newAproCustomers = [];
for (const c of apro.customers ?? []) {
  if (!dbAproIds.has(c.userId)) {
    newAproCustomers.push({ id: c.userId, name: c.name });
  }
}

// Lizenzen: Match per (customer_id, license-name). Quantity-Diff erkennen.
const dbCustomerByApro = new Map(
  dbCustomers
    .filter((c) => c.customer_kind === "apro" && c.apro_customer_id)
    .map((c) => [c.apro_customer_id, c.id]),
);
const dbLicensesByCustomer = new Map();
for (const l of dbLicenses) {
  if (!dbLicensesByCustomer.has(l.customer_id)) dbLicensesByCustomer.set(l.customer_id, []);
  dbLicensesByCustomer.get(l.customer_id).push(l);
}

const newLicenses = [];
const changedQuantities = [];
for (const c of apro.customers ?? []) {
  const dbCustomerId = dbCustomerByApro.get(c.userId);
  if (!dbCustomerId) continue; // brand-new customer is reported above; license-diff will be picked up after the import
  const existing = dbLicensesByCustomer.get(dbCustomerId) ?? [];
  for (const lic of c.licenses ?? []) {
    const licName = lic[1];
    const lizenzmenge = parseInt(lic[5], 10) || 1;
    if (!licName) continue;
    // Selbe Filter-Regel wie scripts/import-apro.mjs:
    //   nur Versionen (apro.kassa10) + DATEV_KassenArchiv
    const isCatalog = licName === "apro.DATEV_KassenArchiv" || /^apro\.[a-zA-Z_/]+\d/.test(licName);
    if (!isCatalog) continue;
    const matched = existing.find((e) => e.name === licName);
    if (!matched) {
      newLicenses.push({ customer: c.name, licenseName: licName, quantity: lizenzmenge });
    } else if ((matched.quantity ?? 1) !== lizenzmenge) {
      changedQuantities.push({
        customer: c.name,
        licenseName: licName,
        oldQty: matched.quantity ?? 1,
        newQty: lizenzmenge,
      });
    }
  }
}

// ---- Markdown ------------------------------------------------------------
const lines = [];
const dateStr = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
lines.push(`## Portal-Sync ${dateStr}`);
lines.push("");

const totalChanges =
  newOperators.length + newSites.length + newCashRegisters.length + goneOperators.length +
  newSecrets + changedSecrets +
  newAproCustomers.length + newLicenses.length + changedQuantities.length;

if (totalChanges === 0) {
  lines.push("Keine Aenderungen seit dem letzten Sync.");
} else {
  lines.push(`### Vectron`);
  lines.push("");
  if (newOperators.length) {
    lines.push(`- 🆕 ${newOperators.length} neue Operator`);
    for (const op of newOperators.slice(0, 20)) lines.push(`  - ${op.name} (\`${op.id}\`)`);
    if (newOperators.length > 20) lines.push(`  - … +${newOperators.length - 20} weitere`);
  }
  if (newSites.length) {
    lines.push(`- 🆕 ${newSites.length} neue Filialen`);
    for (const s of newSites.slice(0, 20)) lines.push(`  - ${s.name} (Operator: ${s.operator}, ${s.siteNo})`);
    if (newSites.length > 20) lines.push(`  - … +${newSites.length - 20} weitere`);
  }
  if (newCashRegisters.length) {
    lines.push(`- 🆕 ${newCashRegisters.length} neue Kassen`);
    for (const cr of newCashRegisters.slice(0, 20)) {
      lines.push(`  - ${cr.serial || "(kein S/N)"} · ${cr.type || "?"} · ${cr.operator || "?"} / ${cr.site || "?"}`);
    }
    if (newCashRegisters.length > 20) lines.push(`  - … +${newCashRegisters.length - 20} weitere`);
  }
  if (goneOperators.length) {
    lines.push(`- ⚠️ ${goneOperators.length} Operator nicht mehr im Portal`);
    for (const op of goneOperators.slice(0, 20)) lines.push(`  - ${op.name} (\`${op.id}\`)`);
    if (goneOperators.length > 20) lines.push(`  - … +${goneOperators.length - 20} weitere`);
  }
  if (newSecrets) {
    lines.push(`- 🔑 ${newSecrets} neue Master-Passwoerter (Klartext nur in DB, admin-only)`);
  }
  if (changedSecrets) {
    lines.push(`- 🔑 ${changedSecrets} Master-Passwoerter geaendert`);
  }
  if (!newOperators.length && !newSites.length && !newCashRegisters.length && !goneOperators.length && !newSecrets && !changedSecrets) {
    lines.push("- (keine Vectron-Aenderungen)");
  }
  lines.push("");
  lines.push(`### APRO`);
  lines.push("");
  if (newAproCustomers.length) {
    lines.push(`- 🆕 ${newAproCustomers.length} neue Kunden`);
    for (const c of newAproCustomers.slice(0, 20)) lines.push(`  - ${c.name} (apro-id \`${c.id}\`)`);
    if (newAproCustomers.length > 20) lines.push(`  - … +${newAproCustomers.length - 20} weitere`);
  }
  if (newLicenses.length) {
    lines.push(`- 🆕 ${newLicenses.length} neue Lizenzen`);
    for (const l of newLicenses.slice(0, 20)) lines.push(`  - ${l.customer}: ${l.licenseName} ×${l.quantity}`);
    if (newLicenses.length > 20) lines.push(`  - … +${newLicenses.length - 20} weitere`);
  }
  if (changedQuantities.length) {
    lines.push(`- ✏️ ${changedQuantities.length} Mengen-Aenderungen`);
    for (const ch of changedQuantities.slice(0, 20)) {
      lines.push(`  - ${ch.customer}: ${ch.licenseName} ${ch.oldQty} → ${ch.newQty}`);
    }
    if (changedQuantities.length > 20) lines.push(`  - … +${changedQuantities.length - 20} weitere`);
  }
  if (!newAproCustomers.length && !newLicenses.length && !changedQuantities.length) {
    lines.push("- (keine APRO-Aenderungen)");
  }
  lines.push("");
}

lines.push("---");
lines.push("");
lines.push("**Stats:**");
lines.push(
  `Vectron — ${vectronOps.length} Operator, ${vectronStates.length} Kassen im Status-Monitor`,
);
lines.push(
  `APRO — ${apro.customers?.length ?? 0} Kunden, ${(apro.customers ?? []).reduce((s, c) => s + (c.licenses?.length ?? 0), 0)} Lizenzen`,
);

const report = lines.join("\n");
console.log(report);

// GH Actions: Output-Variable setzen, damit der Workflow den nachfolgenden
// "Issue erstellen"-Step nur fired wenn es Aenderungen gibt.
if (env.GITHUB_OUTPUT) {
  appendFileSync(env.GITHUB_OUTPUT, `has_changes=${totalChanges > 0 ? "true" : "false"}\n`);
  appendFileSync(env.GITHUB_OUTPUT, `total_changes=${totalChanges}\n`);
}
