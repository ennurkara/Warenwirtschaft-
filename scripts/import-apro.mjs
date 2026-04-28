// scripts/import-apro.mjs
//
// One-off Import: liest data/apro-licenses/apro_full.json und schreibt
// idempotent in customers (kind='apro') + licenses.
//
// Filter: nur Lizenzen mit Versions-Suffix (z.B. apro.kassa10) plus die
// Ausnahme apro.DATEV_KassenArchiv. Lizenzen ohne Zahl werden uebersprungen.
//
// Re-Sync-Anker:
//   customers.apro_customer_id  (numerische APRO-userId)
//   customers.apro_license_key  (UUID Lizenznehmerschluessel)
//   licenses    — kein UNIQUE-Anker; bei Re-Run werden alle Lizenzen
//                 fuer den jeweiligen Kunden zuerst geleert und dann neu
//                 angelegt (vermeidet Duplikate).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "apro-licenses", "apro_full.json");

const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env.local"), "utf-8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const DRY = process.argv.includes("--dry");

const data = JSON.parse(readFileSync(DATA_FILE, "utf-8"));

// ---- Lookup APRO models ---------------------------------------------------
const { data: apro, error: e1 } = await sb.from("manufacturers").select("id").eq("name", "Apro").single();
if (e1) throw e1;
const { data: models, error: e2 } = await sb.from("models").select("id, modellname").eq("manufacturer_id", apro.id);
if (e2) throw e2;
const modelByName = new Map(models.map((m) => [m.modellname, m.id]));

// ---- Filter: nur Versionen + DATEV ----------------------------------------
function isCatalogLicense(name) {
  if (!name) return false;
  if (name === "apro.DATEV_KassenArchiv") return true;
  return /^apro\.[a-zA-Z_/]+\d/.test(name);
}

const stats = {
  customers: data.customers.length,
  customersWritten: 0,
  customersWithoutLicenses: 0,
  licensesWritten: 0,
  licensesSkippedNoCatalog: 0,
  licensesSkippedNoNumber: 0,
  errors: 0,
};
const skippedLicenses = new Map();

for (const c of data.customers) {
  try {
    // 1) UPSERT customer
    const customerRow = {
      name: c.name,
      customer_kind: "apro",
      contact_person: undefined, // not in our schema
      email: c.email || null,
      phone: null,
      address: c.street || null,
      postal_code: c.zip || null,
      city: c.city || null,
      country: c.country || null,
      apro_customer_id: c.userId,
      apro_license_key: c.licenseKey || null,
    };
    delete customerRow.contact_person;
    if (DRY) {
      stats.customersWritten++;
    } else {
      const { error: ce } = await sb
        .from("customers")
        .upsert(customerRow, { onConflict: "apro_customer_id" });
      if (ce) throw new Error(`customer ${c.userId}: ${ce.message}`);
      stats.customersWritten++;
    }

    // Get customer.id back for license writes
    let customerId = "DRY";
    if (!DRY) {
      const { data: cu, error: se } = await sb
        .from("customers")
        .select("id")
        .eq("apro_customer_id", c.userId)
        .single();
      if (se) throw new Error(`customer fetch ${c.userId}: ${se.message}`);
      customerId = cu.id;
    }

    // 2) Filter licenses
    const filtered = (c.licenses ?? []).filter((row) => {
      const name = row[1];
      if (!name) {
        skippedLicenses.set("(empty)", (skippedLicenses.get("(empty)") ?? 0) + 1);
        stats.licensesSkippedNoNumber++;
        return false;
      }
      if (!isCatalogLicense(name)) {
        skippedLicenses.set(name, (skippedLicenses.get(name) ?? 0) + 1);
        stats.licensesSkippedNoNumber++;
        return false;
      }
      return true;
    });

    if (filtered.length === 0) stats.customersWithoutLicenses++;

    // 3) Replace strategy: delete then insert
    if (!DRY && customerId !== "DRY") {
      const { error: de } = await sb.from("licenses").delete().eq("customer_id", customerId);
      if (de) throw new Error(`license delete ${c.userId}: ${de.message}`);
    }

    // 4) Insert each license
    for (const row of filtered) {
      // row = [customerName, licenseName, licenseId, zertifikat, modular, lizenzmenge, davonBezahlt, allokiert, verbleibend]
      const licenseName = row[1];
      const modelId = modelByName.get(licenseName) ?? null;
      if (!modelId) {
        stats.licensesSkippedNoCatalog++;
        skippedLicenses.set(`NO_MODEL:${licenseName}`, (skippedLicenses.get(`NO_MODEL:${licenseName}`) ?? 0) + 1);
        continue;
      }
      const lizenzmenge = parseInt(row[5], 10);
      const verbleibend = parseInt(row[8], 10);
      const noteParts = [];
      if (row[2]) noteParts.push(`APRO Lizenz-ID: ${row[2]}`);
      if (!isNaN(lizenzmenge)) noteParts.push(`Lizenzmenge: ${lizenzmenge}`);
      if (!isNaN(verbleibend)) noteParts.push(`Verbleibend: ${verbleibend}`);

      const insertRow = {
        customer_id: customerId,
        model_id: modelId,
        name: licenseName,
        status: "aktiv",
        notes: noteParts.length ? noteParts.join(" · ") : null,
      };
      if (DRY) {
        stats.licensesWritten++;
        continue;
      }
      const { error: ie } = await sb.from("licenses").insert(insertRow);
      if (ie) throw new Error(`license insert ${c.userId}/${licenseName}: ${ie.message}`);
      stats.licensesWritten++;
    }
  } catch (e) {
    stats.errors++;
    console.error("ERROR", c.userId, c.name, "—", e.message);
  }
}

console.log("\n=== Stats ===");
console.log(JSON.stringify(stats, null, 2));
if (skippedLicenses.size > 0) {
  console.log("\n=== Skipped license types ===");
  for (const [n, c] of [...skippedLicenses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${n}: ${c}`);
  }
}
if (DRY) console.log("\n[DRY RUN] — nichts geschrieben.");
