// scripts/scrape-vectron.mjs
//
// Headless Scraper fuer das myVectron Service-Partner-Portal.
//
// Output:
//   data/vectron-operators/operators_full.json   — pro Operator: operator + sites + summary
//   data/vectron-operators/cash_registers_full.csv — flache CSV mit einer Zeile pro Kasse
//   data/vectron-operators/vectron_states_full.json — Status-Monitor Snapshot (alle Kassen)
//   data/vectron-operators/vectron_export/<operatorId>.json — pro-Operator Detail-Dump
//
// Auth-Flow:
//   1. Playwright steuert Chromium auf service.vectron.cloud
//   2. Login-Formular (Keycloak) ausfuellen
//   3. Aus den Network-Responses einen statischen `x-api-token` (Service-Partner)
//      sowie pro Operator einen `x-authorization-token` aus POST /login-api/grant abgreifen
//   4. Sub-Calls per page.request.get() — Browser-Context wegen Thrift-Sequence-IDs
//
// Modi:
//   --debug    Headed mode + Network-Logger (URL/Status/x-headers) auf stdout.
//              Erste Iterationen damit fahren, Endpunkte verifizieren.
//   --headed   Headed ohne Network-Spam.
//   --limit N  Nur die ersten N Operator scrapen (Smoke-Test).
//
// Env:
//   VECTRON_USER, VECTRON_PASS  — Portal-Credentials
//   VECTRON_PORTAL_URL          — optional, default "https://service.vectron.cloud"

import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "data", "vectron-operators");
const EXPORT_DIR = join(OUT_DIR, "vectron_export");

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

const VECTRON_USER = env.VECTRON_USER;
const VECTRON_PASS = env.VECTRON_PASS;
const PORTAL_URL = env.VECTRON_PORTAL_URL || "https://service.vectron.cloud";
// Backend-Host fuer alle API-Calls (XHR-Network), unterscheidet sich vom Portal-Host.
const API_BASE = env.VECTRON_API_BASE || "https://live-backend.vectron.cloud";

if (!VECTRON_USER || !VECTRON_PASS) {
  console.error("ERROR: VECTRON_USER + VECTRON_PASS muessen in .env.local oder als Env-Var gesetzt sein.");
  process.exit(1);
}

// ---- Setup -------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(EXPORT_DIR, { recursive: true });

const log = (...x) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...x);
const logDebug = (...x) => DEBUG && console.log(`[debug]`, ...x);

// ---- Captured state -----------------------------------------------------
// Vectron-Auth nutzt zwei Custom-Header:
//   x-api-token            statisch, vom Frontend hardcoded (JWT signed by login-service)
//   x-authorization-token  "keycloak-bearer eyJ..." — dynamisch, ~5min TTL
//
// Der x-authorization-token kann zwei Scopes haben:
//   - Service-Partner-Scope (nach Login)         → fuer /partner-api/* Calls
//   - Operator-Scope (nach POST /login-api/grant) → fuer /operator-api/* Calls
// Der Browser tauscht den Token bei Navigation zur Operator-Detail. Wir muessen beide
// Varianten festhalten, weil page.on("request") jeden frischen Token sieht.
const captured = {
  servicePartnerId: null,
  apiToken: null,
  spAuthToken: null,  // Service-Partner-Scope (vor jedem Grant noch gueltig)
  authToken: null,    // aktueller Token (kann SP oder Operator sein)
};

// ---- Browser ------------------------------------------------------------
const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 100 : 0 });
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
});

const page = await ctx.newPage();

// Auth-Header + Grant-Request-Body sniffen.
let grantBodyDumped = false;
page.on("request", (req) => {
  const hdrs = req.headers();
  const url = req.url();
  if (hdrs["x-api-token"] && !captured.apiToken) {
    captured.apiToken = hdrs["x-api-token"];
    log(`captured x-api-token`);
  }
  if (hdrs["x-authorization-token"]) {
    captured.authToken = hdrs["x-authorization-token"];
  }
  // Den ersten Grant-Request-Body loggen — damit wir lernen, wie der korrekt aufgebaut ist.
  if (DEBUG && !grantBodyDumped && url.endsWith("/login-api/grant") && req.method() === "POST") {
    grantBodyDumped = true;
    log(`=== POST /login-api/grant body+headers ===`);
    log(`  body: ${req.postData() ?? "(none)"}`);
    for (const [k, v] of Object.entries(hdrs)) {
      if (k.toLowerCase().includes("token") || k === "content-type") {
        log(`  ${k}: ${v.slice(0, 60)}`);
      }
    }
    log(`=== end ===`);
  }
});

// Network-Logger: Service-Partner-UUID aus URL-Pattern ableiten + im --debug die API-Calls dumpen.
page.on("response", async (resp) => {
  const url = resp.url();
  const status = resp.status();

  // Treffer auf /login-api/users/<uuid>/... oder /partner-api/v1/service-partner/<uuid>/...
  const spMatch =
    url.match(/\/service-partner\/([0-9a-f-]{36})\b/) ||
    url.match(/\/login-api\/users\/([0-9a-f-]{36})\b/);
  if (spMatch && !captured.servicePartnerId) {
    captured.servicePartnerId = spMatch[1];
    log(`captured service-partner-id ${captured.servicePartnerId}`);
  }

  if (DEBUG && (url.includes("/api/") || url.includes("-api/") || url.includes("/v1/"))) {
    logDebug(`${status} ${url}`);
  }
});

// ---- Login --------------------------------------------------------------
log("navigating to portal...");
await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

// Keycloak Login-Form. Selectoren defensiv: id, name, oder ARIA fallback.
log("filling login...");
const userField = page.locator(
  "#username, input[name='username'], input[type='email']",
).first();
const passField = page.locator(
  "#password, input[name='password'], input[type='password']",
).first();

await userField.waitFor({ state: "visible", timeout: 30_000 });
await userField.fill(VECTRON_USER);
await passField.fill(VECTRON_PASS);

// Submit-Button: id=kc-login, oder type=submit fallback
const submitBtn = page.locator(
  "#kc-login, button[type='submit'], input[type='submit']",
).first();
await Promise.all([
  page.waitForLoadState("networkidle", { timeout: 60_000 }),
  submitBtn.click(),
]);

// Falls noch ein 2FA / Consent-Screen — hier muesste man iterativ erweitern.
// In der ersten Recon-Phase rein durchgehen lassen; wenn das Skript blockt,
// im --debug-Mode anschauen.

log("logged in. settling...");
await page.waitForTimeout(3000);

if (!captured.servicePartnerId || !captured.apiToken || !captured.authToken) {
  console.error("FEHLER: Auth-State unvollstaendig nach Login:", {
    servicePartnerId: captured.servicePartnerId,
    apiToken: captured.apiToken ? "ok" : "MISSING",
    authToken: captured.authToken ? "ok" : "MISSING",
  });
  await browser.close();
  process.exit(2);
}
// Den nach-dem-Login Token als SP-Scope einfrieren — den brauchen wir spaeter fuer
// service-partner-Endpoints (er wird durch spaetere Navigationen ueberschrieben).
captured.spAuthToken = captured.authToken;
log(`auth ready: api-token + sp-auth-token captured`);

// ---- API-Helpers --------------------------------------------------------

// Wrapper um page.request.fetch() — haengt x-api-token + x-authorization-token an.
// Bei 401 triggern wir einen Browser-Side fetch der die Keycloak-Refresh-Logik
// im Frontend laufen laesst; danach steht ein frischer x-authorization-token im Sniffer.
function authHeaders(token, extra = {}) {
  return {
    accept: "application/json",
    "x-api-token": captured.apiToken,
    "x-authorization-token": token,
    ...extra,
  };
}

// SP-scoped Calls (service-partner Endpoints).
async function api(path, init = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const resp = await page.request.fetch(url, {
    ...init,
    headers: authHeaders(captured.spAuthToken, init.headers),
  });
  if (resp.status() === 401) {
    log("401 (sp) — refreshing via reload...");
    await page.goto(`${PORTAL_URL}/${captured.servicePartnerId}/operators`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    captured.spAuthToken = captured.authToken;
    await page.waitForTimeout(500);
    return await page.request.fetch(url, {
      ...init,
      headers: authHeaders(captured.spAuthToken, init.headers),
    });
  }
  return resp;
}

async function apiJson(path, init = {}) {
  const resp = await api(path, init);
  if (!resp.ok()) {
    throw new Error(`HTTP ${resp.status()} on ${path}: ${await resp.text()}`);
  }
  return await resp.json();
}

// ---- Operator-Liste ----------------------------------------------------
// FIXME: konkreter Pfad muss per --debug verifiziert werden.
// Erwartet: GET /partner-api/v1/service-partner/<id>/operators (oder aehnlich)
log("fetching operator list...");
let operators = [];
const operatorListPaths = [
  `/partner-api/v1/service-partner/${captured.servicePartnerId}/operators`,
  `/operator-api/v1/operators`,
  `/partner-api/v1/operators`,
];
for (const candidate of operatorListPaths) {
  try {
    const data = await apiJson(candidate);
    if (Array.isArray(data) && data.length > 0) {
      operators = data;
      log(`got ${operators.length} operators from ${candidate}`);
      break;
    }
    if (data && Array.isArray(data.operators) && data.operators.length > 0) {
      operators = data.operators;
      log(`got ${operators.length} operators from ${candidate} (.operators)`);
      break;
    }
    if (data && Array.isArray(data.content) && data.content.length > 0) {
      operators = data.content;
      log(`got ${operators.length} operators from ${candidate} (.content)`);
      break;
    }
  } catch (e) {
    logDebug(`tried ${candidate}: ${e.message}`);
  }
}
if (operators.length === 0) {
  console.error("FEHLER: keine Operatoren-Liste gefunden. Run mit --debug, schau im Network-Tab nach dem Endpunkt.");
  await browser.close();
  process.exit(3);
}


if (LIMIT && LIMIT < operators.length) {
  log(`--limit ${LIMIT} aktiv: scrape nur die ersten ${LIMIT} Operator`);
  operators = operators.slice(0, LIMIT);
}

// ---- Status-Monitor (alle Kassen auf einmal) ---------------------------
log("fetching status-monitor (all cash registers)...");
let statesFull = { cashRegisterStates: [] };
try {
  statesFull = await apiJson(
    `/partner-api/v1/service-partner/${captured.servicePartnerId}/cash-register-states?pageSize=10000`,
  );
  log(`got ${statesFull.cashRegisterStates?.length ?? 0} cash-register-states`);
} catch (e) {
  log(`WARN: status-monitor failed: ${e.message}`);
}
writeFileSync(join(OUT_DIR, "vectron_states_full.json"), JSON.stringify(statesFull));

// Status-Monitor in Map fuer schnellen Lookup beim CSV-Build
const stateByCashRegisterId = new Map();
for (const st of statesFull.cashRegisterStates ?? []) {
  stateByCashRegisterId.set(st.cashRegisterId, st);
}

// ---- Pro Operator: grant token + Detail-Daten --------------------------
// Pro-Operator: Navigation zur Operator-Detail-Page triggert das Frontend einen Grant
// gegen /login-api/grant zu machen — der Response setzt einen operator-scoped
// x-authorization-token, der dann fuer /operator-api/* Calls noetig ist.
async function fetchOperatorDetails(operatorId) {
  // waitUntil "commit" statt "networkidle" — wir brauchen nicht alle Sub-Resources.
  // Stattdessen warten wir explizit auf den /login-api/grant-Response, weil DAS
  // der Trigger fuer den frischen operator-scoped x-authorization-token ist.
  const grantPromise = page
    .waitForResponse(
      (r) => r.url().endsWith("/login-api/grant") && r.status() === 200,
      { timeout: 20_000 },
    )
    .catch(() => null);

  await page
    .goto(`${PORTAL_URL}/${captured.servicePartnerId}/operators/${operatorId}`, {
      waitUntil: "commit",
      timeout: 20_000,
    })
    .catch(() => {});
  await grantPromise;
  // Der page.on("request")-Sniffer hat captured.authToken jetzt aktualisiert.
  // Kurze Atempause damit JS-Code-Bahnen vollstaendig durch sind.
  await page.waitForTimeout(50);

  const opAuthToken = captured.authToken;
  const safeJson = async (p) => {
    const r = await page.request.fetch(`${API_BASE}${p}`, {
      headers: authHeaders(opAuthToken),
    });
    if (!r.ok()) {
      logDebug(`opCall ${p} -> ${r.status()}`);
      return null;
    }
    return await r.json();
  };

  const [opData, sitesData, summaryData, fiscalData] = await Promise.all([
    safeJson(`/operator-api/v1/operators/${operatorId}`),
    safeJson(`/operator-api/v1/operators/${operatorId}/sites?limit=9999`),
    safeJson(`/operator-api/v1/operators/${operatorId}/cash-register-summary`),
    safeJson(`/operator-api/v1/operators/${operatorId}/fiscal-data-summary?timeZone=Europe/Berlin`),
  ]);

  return {
    operator: opData,
    sites: Array.isArray(sitesData) ? sitesData : sitesData?.content ?? [],
    "cash-register-summary": summaryData ?? [],
    "fiscal-data-summary": fiscalData ?? [],
  };
}

const operatorsFull = [];
let i = 0;
for (const opMeta of operators) {
  i++;
  const operatorId = opMeta.operatorId || opMeta.id || opMeta.uuid;
  if (!operatorId) {
    log(`WARN [${i}/${operators.length}]: kein operatorId in entry — skip: ${JSON.stringify(opMeta).slice(0, 200)}`);
    continue;
  }
  try {
    const details = await fetchOperatorDetails(operatorId);
    const merged = {
      operatorId,
      name: opMeta.name || opMeta.companyName || details.operator?.companyName || null,
      ...details,
    };
    operatorsFull.push(merged);
    writeFileSync(join(EXPORT_DIR, `${operatorId}.json`), JSON.stringify(merged));
    if (i % 10 === 0 || i === operators.length) log(`  ${i}/${operators.length} operators done`);
  } catch (e) {
    log(`ERR [${i}/${operators.length}] operator ${operatorId}: ${e.message}`);
  }
}
log(`scraped ${operatorsFull.length}/${operators.length} operators`);

writeFileSync(join(OUT_DIR, "operators_full.json"), JSON.stringify(operatorsFull, null, 2));

// ---- CSV-Build ----------------------------------------------------------
const csvHeader = [
  "operatorId",
  "operatorCompanyName",
  "operatorCustomerNumber",
  "operatorActive",
  "operatorDisabled",
  "operatorLastHeartbeat",
  "operatorContractStillActive",
  "siteUuid",
  "siteNo",
  "siteName",
  "siteCity",
  "cashRegisterId",
  "serialNumber",
  "cashRegisterNumber",
  "fiscalIdentifier",
  "name",
  "login",
  "connectId",
  "maintenancePassword",
  "brand",
  "type",
  "version",
  "operatingSystem",
  "platform",
  "language",
  "lastHeartbeat",
  "lastInvoice",
  "tseSerialNumber",
  "tseExpirationDate",
];

function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const csvRows = [csvHeader.join(";")];
for (const opFull of operatorsFull) {
  const op = opFull.operator || {};
  const sites = opFull.sites || [];
  const summaries = opFull["cash-register-summary"] || [];
  const contractStillActive = !op.disabled && op.released !== false;

  for (const site of sites) {
    // cashRegisters fuer dieses Site aus dem Status-Monitor ziehen
    const cashRegistersAtSite = [...stateByCashRegisterId.values()].filter(
      (st) => st.siteId === site.siteUuid,
    );
    if (cashRegistersAtSite.length === 0) {
      // Site ohne erkannte Kassen — eine Leerzeile schreiben (Operator-Zeile)
      csvRows.push(
        [
          op.operatorId,
          op.companyName,
          op.customerNumber,
          op.active,
          op.disabled,
          op.lastHeartbeat || "",
          contractStillActive,
          site.siteUuid,
          site.siteNo || "",
          site.name || "",
          site.address?.city || "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]
          .map(csvCell)
          .join(";"),
      );
      continue;
    }
    for (const cr of cashRegistersAtSite) {
      csvRows.push(
        [
          op.operatorId,
          op.companyName,
          op.customerNumber,
          op.active,
          op.disabled,
          op.lastHeartbeat || "",
          contractStillActive,
          site.siteUuid,
          site.siteNo || "",
          site.name || "",
          site.address?.city || "",
          cr.cashRegisterId,
          cr.serialNumber,
          cr.cashRegisterNumber || "",
          cr.fiscalIdentifier || "",
          cr.cashRegisterName || "",
          cr.login || "",
          cr.connectId || "",
          cr.maintenancePassword || "",
          cr.brand || "",
          cr.type || "",
          cr.version || "",
          cr.operatingSystem || "",
          cr.platform || "",
          cr.language || "",
          cr.lastHeartbeatReceivedAt?.slice(0, 10) || "",
          cr.lastInvoiceReceivedAt?.slice(0, 10) || "",
          cr.tseSerialNumber || "",
          cr.tseExpirationDate || "",
        ]
          .map(csvCell)
          .join(";"),
      );
    }
  }
}

writeFileSync(join(OUT_DIR, "cash_registers_full.csv"), csvRows.join("\n"));

// ---- Stats ---------------------------------------------------------------
const stats = {
  scrapedAt: new Date().toISOString(),
  totalOperators: operators.length,
  scrapedOperators: operatorsFull.length,
  totalCashRegisters: statesFull.cashRegisterStates?.length ?? 0,
  contractStillActive: operatorsFull.filter((o) => !o.operator?.disabled).length,
};
writeFileSync(join(OUT_DIR, "stats_full.json"), JSON.stringify(stats, null, 2));
log("stats:", stats);

await browser.close();
log("done.");
