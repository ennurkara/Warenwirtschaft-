// scripts/scrape-apro.mjs
//
// Headless Scraper fuer das APRO Liveupdate-Distributoren-Portal (ASP.NET WebForms).
//
// Output:
//   data/apro-licenses/apro_full.json    — Kunden + Lizenzen, gleiche Struktur wie der
//                                           manuelle One-Off-Scrape von Apr 2026
//   data/apro-licenses/customers.csv     — flache Kundenliste (consolidate.mjs Format)
//   data/apro-licenses/licenses.csv      — eine Zeile pro Lizenz
//   data/apro-licenses/stats.json        — Anzahlen + Lizenztyp-Histogramm
//
// Modi:
//   --debug    Headed + Network-Logger + erste Detail-Page wird inspiziert
//   --headed   Headed ohne Network-Spam
//   --limit N  Nur die ersten N Kunden scrapen (Smoke-Test)
//
// Env:
//   APRO_USER, APRO_PASS  — Portal-Credentials
//   APRO_PORTAL_BASE      — optional, default "http://liveupdate.apro.at/LiveUpdateDistributorenPortal"

import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "data", "apro-licenses");

const args = new Set(process.argv.slice(2));
const DEBUG = args.has("--debug");
const HEADED = DEBUG || args.has("--headed");
const limitIndex = process.argv.findIndex((a) => a === "--limit");
const LIMIT = limitIndex > 0 ? parseInt(process.argv[limitIndex + 1], 10) : null;

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

const APRO_USER = env.APRO_USER;
const APRO_PASS = env.APRO_PASS;
const PORTAL_BASE = env.APRO_PORTAL_BASE || "http://liveupdate.apro.at/LiveUpdateDistributorenPortal";
const LOGIN_URL = `${PORTAL_BASE}/Login.aspx`;

if (!APRO_USER || !APRO_PASS) {
  console.error("ERROR: APRO_USER + APRO_PASS muessen in .env.local oder als Env-Var gesetzt sein.");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const log = (...x) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...x);
const logDebug = (...x) => DEBUG && console.log(`[debug]`, ...x);

// ---- Browser -------------------------------------------------------------
const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 50 : 0 });
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

if (DEBUG) {
  page.on("response", (r) => logDebug(`${r.status()} ${r.url()}`));
}

// ---- Login ----------------------------------------------------------------
log(`navigating to ${LOGIN_URL}...`);
await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

log("filling login form...");
const userField = page.locator(
  "input[name*='ser' i][type='text'], input[name*='login' i][type='text'], input[type='text']",
).first();
const passField = page.locator("input[type='password']").first();
await userField.waitFor({ state: "visible", timeout: 30_000 });
await userField.fill(APRO_USER);
await passField.fill(APRO_PASS);

const submitBtn = page.locator(
  "input[type='submit'], button[type='submit'], input[value*='Anmeld' i], input[value*='Login' i]",
).first();
await Promise.all([
  page.waitForLoadState("networkidle", { timeout: 60_000 }),
  submitBtn.click(),
]);
log(`logged in. landed on ${page.url()}`);

// ---- Customer-Liste -------------------------------------------------------
// Auf Kundenuebersicht.aspx steht eine ASP.NET GridView mit allen Kunden.
// Spalten: Name | Kontakt | Strasse | PLZ | Ort | Land | E-Mail | Lizenzschluessel | ID
// Die GridView hat die ASP.NET-id `ctl00_CONTENT_ContentGridView` (aus dem ViewState).
log("parsing customer GridView from Kundenuebersicht.aspx...");

function parseGridRows() {
  // GridView wird ohne ctl00_-Prefix gerendert (vermutlich ClientIDMode=Static).
  const grid =
    document.querySelector("#CONTENT_ContentGridView") ||
    document.querySelector("#ctl00_CONTENT_ContentGridView") ||
    document.querySelector("[id$='ContentGridView']");
  if (!grid) return { error: "GridView (CONTENT_ContentGridView) not found" };
  const tbody = grid.querySelector(":scope > tbody") || grid;
  const rows = [...tbody.children].filter((c) => c.tagName === "TR");
  const out = [];
  for (const tr of rows) {
    const cells = [...tr.children]
      .filter((c) => c.tagName === "TD")
      .map((td) => {
        const t = (td.textContent || "").trim();
        return t === " " ? "" : t;
      });
    if (cells.length < 9) continue;
    out.push({
      name: cells[0],
      contact: cells[1],
      street: cells[2],
      zip: cells[3],
      city: cells[4],
      country: cells[5],
      email: cells[6],
      licenseKey: cells[7],
      userId: cells[8],
    });
  }
  return { rows: out };
}

let parseResult = await page.evaluate(parseGridRows);

if (parseResult.error) {
  log(`FEHLER: ${parseResult.error}`);
  if (DEBUG) {
    const gridIds = await page.evaluate(() =>
      [...document.querySelectorAll("[id*='GridView' i], [id*='content_grid' i]")].map((e) => ({
        id: e.id,
        rows: e.querySelectorAll("tr").length,
      })),
    );
    log("Gefundene GridView-IDs:", JSON.stringify(gridIds));
  }
  await browser.close();
  process.exit(2);
}
let customers = parseResult.rows;

if (DEBUG && customers.length > 0) {
  log("=== first parsed customer ===");
  log(JSON.stringify(customers[0], null, 2));
  log("=== end ===");
}

// Pagination: GridView mit __doPostBack('...$ContentGridView', 'Page$N')-Links
async function paginate() {
  let pageIdx = 1;
  while (true) {
    const nextSelector = `a[href*="Page$${pageIdx + 1}"]`;
    const nextCount = await page.locator(nextSelector).count();
    if (nextCount === 0) break;
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.locator(nextSelector).first().click(),
    ]);
    pageIdx++;
    const more = await page.evaluate(parseGridRows);
    if (more.rows && more.rows.length) {
      customers.push(...more.rows);
      log(`  page ${pageIdx}: +${more.rows.length} (total ${customers.length})`);
    }
  }
}
await paginate();

log(`found ${customers.length} customers`);
if (LIMIT && LIMIT < customers.length) {
  log(`--limit ${LIMIT} aktiv — scrape nur die ersten ${LIMIT}`);
  customers = customers.slice(0, LIMIT);
}

// ---- Pro Customer: Lizenzen-GridView -------------------------------------
// Detail-Page = DetailLizenzuebersicht.aspx, navigiert per ?userId= Query-Param.
// Die Lizenzen-GridView hat 9 Spalten (Legacy-Format):
//   Kundenname | Lizenzname | LizenzId | Zertifikat | Modular | Menge | DavonBezahlt | Allokiert | Verbleibend
let firstDetailDumped = false;

function parseLicenseGrid() {
  // Lizenzen-GridView auf der Detail-Page: id="CONTENT_content_grid".
  let grid = document.querySelector("#CONTENT_content_grid");
  if (!grid) {
    // Fallback: erste Tabelle mit "apro." in einer TD-Zelle, aber nicht der
    // ContentTableMaster-Wrapper (der enthaelt die ganze Page).
    for (const t of document.querySelectorAll("table:not(#ContentTableMaster)")) {
      if ([...t.querySelectorAll("td")].some((td) => /apro\./i.test(td.textContent || ""))) {
        grid = t;
        break;
      }
    }
  }
  if (!grid) return [];

  const tbody = grid.querySelector(":scope > tbody") || grid;
  const rows = [...tbody.children].filter((c) => c.tagName === "TR");
  const out = [];
  for (const tr of rows) {
    const cells = [...tr.children]
      .filter((c) => c.tagName === "TD")
      .map((td) => {
        const t = (td.textContent || "").trim();
        return t === " " ? "" : t;
      });
    if (cells.length === 0) continue;
    while (cells.length < 9) cells.push("");
    out.push(cells.slice(0, 9));
  }
  return out;
}

async function fetchLicensesForCustomer(userId) {
  const detailUrl = `${PORTAL_BASE}/DetailLizenzuebersicht.aspx?userId=${userId}`;
  await page.goto(detailUrl, { waitUntil: "networkidle", timeout: 30_000 });

  if (DEBUG && !firstDetailDumped) {
    firstDetailDumped = true;
    const inspect = await page.evaluate(() => {
      return [...document.querySelectorAll("[id*='GridView' i], [id*='ItemList' i], [id*='Repeater' i], table[id]")].map((e) => ({
        id: e.id,
        tag: e.tagName,
        rows: e.querySelectorAll("tr").length,
        sampleTd: e.querySelector("td")?.textContent?.trim().slice(0, 60) || "",
        hasApro: [...e.querySelectorAll("td")].some((td) => /apro\./i.test(td.textContent || "")),
      }));
    });
    log("=== detail-page grids ===");
    for (const g of inspect) log(`  #${g.id} ${g.tag} rows=${g.rows} hasApro=${g.hasApro} td0="${g.sampleTd}"`);
    log("=== end ===");
  }

  return await page.evaluate(parseLicenseGrid);
}

let i = 0;
for (const c of customers) {
  i++;
  try {
    c.licenses = await fetchLicensesForCustomer(c.userId);
    if (i % 25 === 0) log(`  ${i}/${customers.length} customers done`);
  } catch (e) {
    log(`ERR [${i}/${customers.length}] userId ${c.userId}: ${e.message}`);
    c.licenses = [];
  }
}
log(`scraped ${customers.length} customers + licenses`);

// ---- Outputs --------------------------------------------------------------
writeFileSync(join(OUT_DIR, "apro_full.json"), JSON.stringify({ customers }, null, 2));

const csvEscape = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/\r?\n/g, " ").trim();
  return /[",;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const cCols = ["userId", "name", "contact", "street", "zip", "city", "country", "email", "licenseKey", "licenseCount"];
const cRows = [cCols.join(";")];
for (const c of customers) {
  cRows.push(
    [c.userId, c.name, c.contact, c.street, c.zip, c.city, c.country, c.email, c.licenseKey, (c.licenses ?? []).length]
      .map(csvEscape)
      .join(";"),
  );
}
writeFileSync(join(OUT_DIR, "customers.csv"), "﻿" + cRows.join("\n"), "utf-8");

const lCols = [
  "userId",
  "customerName",
  "licenseName",
  "licenseId",
  "modular",
  "lizenzmenge",
  "davonBezahlt",
  "allokiert",
  "verbleibend",
];
const lRows = [lCols.join(";")];
for (const c of customers) {
  for (const lic of c.licenses ?? []) {
    lRows.push(
      [c.userId, lic[0], lic[1], lic[2], lic[4], lic[5], lic[6], lic[7], lic[8]]
        .map(csvEscape)
        .join(";"),
    );
  }
}
writeFileSync(join(OUT_DIR, "licenses.csv"), "﻿" + lRows.join("\n"), "utf-8");

const licenseCounts = new Map();
for (const c of customers) {
  for (const lic of c.licenses ?? []) {
    licenseCounts.set(lic[1], (licenseCounts.get(lic[1]) ?? 0) + 1);
  }
}
const stats = {
  scrapedAt: new Date().toISOString(),
  totalCustomers: customers.length,
  customersWithLicenses: customers.filter((c) => (c.licenses ?? []).length > 0).length,
  customersWithoutLicenses: customers.filter((c) => (c.licenses ?? []).length === 0).length,
  totalLicenses: customers.reduce((s, c) => s + (c.licenses ?? []).length, 0),
  licenseTypes: Object.fromEntries([...licenseCounts.entries()].sort((a, b) => b[1] - a[1])),
};
writeFileSync(join(OUT_DIR, "stats.json"), JSON.stringify(stats, null, 2));
log("stats:", JSON.stringify(stats, null, 2));

await browser.close();
log("done.");
