// scripts/import-tse.mjs
//
// Backfill TSE-Daten aus data/tse-import/records.json (extrahiert aus den
// Kunden-xlsx auf P:\Kunden_Daten\<Kunde>\TSE Meldung *.xlsx) in die
// Warenwirtschaft.
//
// Match-Schluessel:
//   Excel kassenSn ↔ devices.serial_number (Vectron-Kasse)
//   Excel tseSn    ↔ devices.serial_number (Swissbit-TSE-Geraet)
//
// Vorgehen pro Excel-Zeile:
//   1) Kasse via serial_number finden. Nicht da → skip + Lueckenliste.
//   2) TSE-device via serial_number finden. Nicht da → insert
//      (model = "TSE Swissbit USB" oder "SD", status='im_einsatz',
//       current_customer_id = current_customer_id der Kasse).
//   3) tse_details upsert (kind, bsi_k_tr_number, expires_at,
//      installed_in_device = Kasse.id). Bestehende Zeile wird ueberschrieben.
//
// Modi:
//   node scripts/import-tse.mjs           # Analyse, kein Schreiben
//   node scripts/import-tse.mjs --live    # echter Import

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RECORDS_PATH = join(ROOT, "data", "tse-import", "records.json");

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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const LIVE = process.argv.includes("--live");

// ---- Records laden + dedupen ----------------------------------------------

const rawRecords = JSON.parse(readFileSync(RECORDS_PATH, "utf-8"));
const records = [];
const seenTse = new Set();
const skipReasons = { noTseSn: 0, noKassenSn: 0, noKind: 0, dupTseSn: 0 };
for (const r of rawRecords) {
  if (!r.tseSn || r.tseSn === "?") { skipReasons.noTseSn++; continue; }
  if (!r.kassenSn || r.kassenSn === "?") { skipReasons.noKassenSn++; continue; }
  if (!r.kind) { skipReasons.noKind++; continue; }
  if (seenTse.has(r.tseSn)) { skipReasons.dupTseSn++; continue; }
  seenTse.add(r.tseSn);
  records.push(r);
}

console.log(`# Mode: ${LIVE ? "LIVE" : "ANALYSE (dry)"}`);
console.log(`# Records (raw):       ${rawRecords.length}`);
console.log(`#   skip no tseSn:     ${skipReasons.noTseSn}`);
console.log(`#   skip no kassenSn:  ${skipReasons.noKassenSn}`);
console.log(`#   skip no kind:      ${skipReasons.noKind}`);
console.log(`#   skip dup tseSn:    ${skipReasons.dupTseSn}`);
console.log(`# Records (effective): ${records.length}\n`);

// ---- TSE-Modelle (USB/SD) auflösen ----------------------------------------

const { data: tseCat, error: catErr } = await sb
  .from("categories")
  .select("id")
  .eq("name", "TSE Swissbit")
  .single();
if (catErr || !tseCat) { console.error("Kategorie 'TSE Swissbit' nicht gefunden:", catErr); process.exit(1); }

const { data: tseModels, error: modErr } = await sb
  .from("models")
  .select("id, modellname")
  .eq("category_id", tseCat.id);
if (modErr) { console.error("models query failed:", modErr); process.exit(1); }

const modelByKind = {};
for (const m of tseModels ?? []) {
  if (m.modellname === "USB") modelByKind.usb = m.id;
  if (m.modellname === "SD")  modelByKind.sd  = m.id;
}
if (!modelByKind.usb || !modelByKind.sd) {
  console.error("TSE-Modelle USB/SD fehlen unter Kategorie 'TSE Swissbit'.", modelByKind);
  process.exit(1);
}
console.log(`# TSE-Modelle: USB=${modelByKind.usb} SD=${modelByKind.sd}\n`);

// ---- Pro Record: Kasse + TSE finden, ggf. anlegen + tse_details upsert -----

const stats = {
  matched_kasse: 0,
  not_found_kasse: 0,
  multi_kasse: 0,
  tse_existing: 0,
  tse_inserted: 0,
  details_existing: 0,
  details_upserted: 0,
  details_overwritten: 0,
  errors: 0,
};
const missingKassen = [];
const conflicts = [];
const errors = [];

for (const r of records) {
  try {
    // 1) Kasse finden
    const { data: kassen, error: kErr } = await sb
      .from("devices")
      .select("id, serial_number, current_customer_id, status")
      .eq("serial_number", r.kassenSn);
    if (kErr) throw new Error(`kasse lookup: ${kErr.message}`);
    if (!kassen || kassen.length === 0) {
      stats.not_found_kasse++;
      missingKassen.push({ kunde: r.kunde, standort: r.standort, kassenSn: r.kassenSn, tseSn: r.tseSn });
      continue;
    }
    if (kassen.length > 1) {
      stats.multi_kasse++;
      console.warn(`  ! mehrere devices mit serial=${r.kassenSn}, nehme erstes`);
    }
    const kasse = kassen[0];
    stats.matched_kasse++;

    // 2) TSE-device finden
    const { data: tses, error: tErr } = await sb
      .from("devices")
      .select("id, serial_number, current_customer_id")
      .eq("serial_number", r.tseSn);
    if (tErr) throw new Error(`tse lookup: ${tErr.message}`);

    let tseDeviceId;
    if (tses && tses.length > 0) {
      tseDeviceId = tses[0].id;
      stats.tse_existing++;
    } else {
      // 3) TSE-device anlegen
      if (LIVE) {
        const { data: ins, error: iErr } = await sb
          .from("devices")
          .insert({
            model_id: modelByKind[r.kind],
            serial_number: r.tseSn,
            status: "im_einsatz",
            current_customer_id: kasse.current_customer_id,
          })
          .select("id")
          .single();
        if (iErr) throw new Error(`device insert: ${iErr.message}`);
        tseDeviceId = ins.id;
      } else {
        tseDeviceId = "(would-insert)";
      }
      stats.tse_inserted++;
    }

    // 4) tse_details upsert
    const { data: existing, error: eErr } = await sb
      .from("tse_details")
      .select("device_id, installed_in_device, expires_at")
      .eq("device_id", typeof tseDeviceId === "string" && tseDeviceId.startsWith("(") ? "00000000-0000-0000-0000-000000000000" : tseDeviceId)
      .maybeSingle();
    if (eErr) throw new Error(`tse_details lookup: ${eErr.message}`);

    if (existing) {
      stats.details_existing++;
      if (existing.installed_in_device && existing.installed_in_device !== kasse.id) {
        conflicts.push({
          tseSn: r.tseSn,
          old_kasse: existing.installed_in_device,
          new_kasse: kasse.id,
          new_kassen_sn: r.kassenSn,
          kunde: r.kunde,
        });
        stats.details_overwritten++;
      }
    }

    if (LIVE) {
      const payload = {
        device_id: tseDeviceId,
        kind: r.kind,
        bsi_k_tr_number: r.bsi || null,
        expires_at: r.ablaufdatum || null,
        installed_in_device: kasse.id,
      };
      const { error: uErr } = await sb
        .from("tse_details")
        .upsert(payload, { onConflict: "device_id" });
      if (uErr) throw new Error(`tse_details upsert: ${uErr.message}`);
      stats.details_upserted++;
    }
  } catch (e) {
    stats.errors++;
    errors.push({ tseSn: r.tseSn, kassenSn: r.kassenSn, kunde: r.kunde, error: String(e.message || e) });
  }
}

// ---- Bericht ---------------------------------------------------------------

console.log("\n=== Statistik ===");
console.log(JSON.stringify(stats, null, 2));

if (missingKassen.length) {
  console.log(`\n=== Lueckenliste: Kassen-SN nicht in DB (${missingKassen.length}) ===`);
  for (const m of missingKassen) {
    console.log(`  ${m.kunde} | ${m.standort} | Kasse ${m.kassenSn} | TSE ${m.tseSn.slice(0,16)}...`);
  }
}

if (conflicts.length) {
  console.log(`\n=== Conflicts: tse_details.installed_in_device geaendert (${conflicts.length}) ===`);
  for (const c of conflicts) {
    console.log(`  TSE ${c.tseSn.slice(0,16)}... ${c.old_kasse} -> ${c.new_kasse} (Kasse ${c.new_kassen_sn} bei ${c.kunde})`);
  }
}

if (errors.length) {
  console.log(`\n=== Errors (${errors.length}) ===`);
  for (const e of errors) {
    console.log(`  ${e.kunde} | Kasse ${e.kassenSn} | TSE ${e.tseSn.slice(0,16)}... -> ${e.error}`);
  }
}

if (!LIVE) {
  console.log("\n# Analyse-Modus. Fuer echten Import:  node scripts/import-tse.mjs --live");
}
