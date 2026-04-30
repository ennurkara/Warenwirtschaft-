// scripts/recon-vectron-cashregister.mjs
//
// One-off Recon: identifiziert den Vectron-Endpoint, der das Master-/Maintenance-
// Passwort einer Kasse liefert. Output landet in data/recon/.
//
// Strategie:
//   1. Login (gleiche Auth-Logik wie scrape-vectron.mjs)
//   2. Navigation zur Operator-Detail (triggert operator-scope grant)
//   3. Direkt-Probe ein paar geratener Endpoints (`/cash-registers/{id}`,
//      `/cash-registers/{id}/maintenance-configuration`, ...)
//   4. Browser navigiert zur Cash-Register-Detail-Page; alle XHRs werden
//      mit URL + Status + (gekuerztem) Response-Body dumped
//   5. Optional: Buttons mit Text "Master", "Passwort", "anzeigen", "show"
//      werden geklickt — die XHR die danach kommt ist der Master-Passwort-Trigger
//
// Verwendung:
//   node scripts/recon-vectron-cashregister.mjs
//   node scripts/recon-vectron-cashregister.mjs --headless        # ohne sichtbaren Browser
//   node scripts/recon-vectron-cashregister.mjs --op <opId> --cr <crId>
//
// Output:
//   data/recon/network-<ts>.jsonl   — eine Zeile pro XHR
//   data/recon/probes-<ts>.json     — Direkt-Probes der geratenen Endpoints
//   data/recon/buttons-<ts>.json    — gefundene UI-Buttons + Klick-Resultate

import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RECON_DIR = join(ROOT, "data", "recon");
mkdirSync(RECON_DIR, { recursive: true });

const args = process.argv.slice(2);
const arg = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : null;
};
const HEADLESS = args.includes("--headless");
const OP_ARG = arg("--op");
const CR_ARG = arg("--cr");

// Default-Test-Sample (aus vectron_states_full.json gepickt)
const TEST_OPERATOR = OP_ARG || "b970c3f8-4c5f-4790-979a-715b77cf9be6";
const TEST_CASH_REGISTER = CR_ARG || "5854745f-e25c-41ea-82f6-f8418bc75ef4";

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
const API_BASE = env.VECTRON_API_BASE || "https://live-backend.vectron.cloud";

if (!VECTRON_USER || !VECTRON_PASS) {
  console.error("ERROR: VECTRON_USER + VECTRON_PASS muessen in .env.local oder als Env-Var gesetzt sein.");
  process.exit(1);
}

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const NETWORK_FILE = join(RECON_DIR, `network-${ts}.jsonl`);
const PROBES_FILE = join(RECON_DIR, `probes-${ts}.json`);
const BUTTONS_FILE = join(RECON_DIR, `buttons-${ts}.json`);

const log = (...x) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...x);

// ---- Browser ------------------------------------------------------------
const browser = await chromium.launch({ headless: HEADLESS, slowMo: HEADLESS ? 0 : 80 });
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
});
const page = await ctx.newPage();

// ---- Captured state -----------------------------------------------------
const captured = { servicePartnerId: null, apiToken: null, spAuthToken: null, authToken: null };

// ---- Network logger -----------------------------------------------------
// Loggt jede Response mit URL, Status, und (bei JSON) gekuerztem Body.
// Speziell relevant: alle Calls auf live-backend.vectron.cloud.
page.on("response", async (resp) => {
  const url = resp.url();
  if (!url.includes("vectron.cloud")) return;
  const req = resp.request();

  let bodySnippet = null;
  let bodyKeys = null;
  let passwordHit = false;
  try {
    const ct = resp.headers()["content-type"] ?? "";
    if (ct.includes("application/json")) {
      const text = await resp.text();
      // Volltext-Suche nach password (case-insensitive) - aber NICHT loggen
      passwordHit = /password|passwort/i.test(text) && !/masterdata/i.test(text);
      if (text.length < 4000) {
        bodySnippet = text;
      } else {
        bodySnippet = text.slice(0, 2000) + " ...[truncated]... " + text.slice(-500);
      }
      try {
        const parsed = JSON.parse(text);
        bodyKeys = Array.isArray(parsed)
          ? `[Array(${parsed.length}) of ${parsed[0] ? Object.keys(parsed[0]).slice(0, 8).join(",") : "?"}]`
          : Object.keys(parsed).slice(0, 12).join(",");
      } catch {}
    }
  } catch {}

  const entry = {
    ts: new Date().toISOString(),
    method: req.method(),
    status: resp.status(),
    url,
    bodyKeys,
    passwordHit,
    bodySnippet,
  };
  appendFileSync(NETWORK_FILE, JSON.stringify(entry) + "\n");

  // SP-ID und Tokens snippen (gleiche Logik wie scrape-vectron.mjs)
  const spMatch =
    url.match(/\/service-partner\/([0-9a-f-]{36})\b/) || url.match(/\/login-api\/users\/([0-9a-f-]{36})\b/);
  if (spMatch && !captured.servicePartnerId) {
    captured.servicePartnerId = spMatch[1];
    log(`captured service-partner-id ${captured.servicePartnerId}`);
  }
});

page.on("request", (req) => {
  const hdrs = req.headers();
  if (hdrs["x-api-token"] && !captured.apiToken) captured.apiToken = hdrs["x-api-token"];
  if (hdrs["x-authorization-token"]) captured.authToken = hdrs["x-authorization-token"];
});

// ---- Login --------------------------------------------------------------
log(`recon target: operator=${TEST_OPERATOR} cashRegister=${TEST_CASH_REGISTER}`);
log("navigating to portal...");
await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

const userField = page.locator("#username, input[name='username'], input[type='email']").first();
const passField = page.locator("#password, input[name='password'], input[type='password']").first();
await userField.waitFor({ state: "visible", timeout: 30_000 });
await userField.fill(VECTRON_USER);
await passField.fill(VECTRON_PASS);

const submitBtn = page.locator("#kc-login, button[type='submit'], input[type='submit']").first();
await Promise.all([
  page.waitForLoadState("networkidle", { timeout: 60_000 }),
  submitBtn.click(),
]);
log("login submitted, settling 3s...");
await page.waitForTimeout(3000);

if (!captured.servicePartnerId || !captured.apiToken || !captured.authToken) {
  log("WARN: auth-state unvollstaendig:", {
    sp: captured.servicePartnerId,
    api: !!captured.apiToken,
    auth: !!captured.authToken,
  });
}
captured.spAuthToken = captured.authToken;

// ---- Operator-Page → grant operator-scope token -------------------------
log(`navigating to operator detail (triggers grant)...`);
const grantPromise = page
  .waitForResponse((r) => r.url().endsWith("/login-api/grant") && r.status() === 200, { timeout: 20_000 })
  .catch(() => null);
await page
  .goto(`${PORTAL_URL}/${captured.servicePartnerId}/operators/${TEST_OPERATOR}`, {
    waitUntil: "commit",
    timeout: 20_000,
  })
  .catch(() => {});
await grantPromise;
await page.waitForTimeout(1500);
const opAuthToken = captured.authToken;
log(`operator-scope grant captured: ${opAuthToken ? opAuthToken.slice(0, 30) + "..." : "MISSING"}`);

// ---- Direkt-Probes auf gerateten Endpoints ------------------------------
log("probing guessed endpoints...");
const probePaths = [
  `/operator-api/v1/operators/${TEST_OPERATOR}/cash-registers/${TEST_CASH_REGISTER}`,
  `/operator-api/v1/operators/${TEST_OPERATOR}/cash-registers/${TEST_CASH_REGISTER}/maintenance-configuration`,
  `/operator-api/v1/operators/${TEST_OPERATOR}/cash-registers/${TEST_CASH_REGISTER}/credentials`,
  `/operator-api/v1/operators/${TEST_OPERATOR}/cash-registers/${TEST_CASH_REGISTER}/master-password`,
  `/operator-api/v1/cash-registers/${TEST_CASH_REGISTER}`,
  `/operator-api/v1/cash-registers/${TEST_CASH_REGISTER}/maintenance-configuration`,
  `/operator-api/v1/cash-registers/${TEST_CASH_REGISTER}/credentials`,
  `/operator-api/v1/cash-registers/${TEST_CASH_REGISTER}/master-password`,
];
const probes = [];
for (const p of probePaths) {
  try {
    const r = await page.request.fetch(`${API_BASE}${p}`, {
      headers: {
        accept: "application/json",
        "x-api-token": captured.apiToken,
        "x-authorization-token": opAuthToken,
      },
    });
    let body = null;
    let passwordHit = false;
    try {
      const text = await r.text();
      passwordHit = /password|passwort/i.test(text) && !/masterdata/i.test(text);
      body = text.slice(0, 1500);
    } catch {}
    probes.push({ path: p, status: r.status(), passwordHit, bodySnippet: body });
    log(`  ${r.status()} ${p}${passwordHit ? "  *** PASSWORD HIT ***" : ""}`);
  } catch (e) {
    probes.push({ path: p, error: e.message });
    log(`  ERR ${p}: ${e.message}`);
  }
}
writeFileSync(PROBES_FILE, JSON.stringify(probes, null, 2));

// ---- Browser-Navigation: Cash-Register-Detail-Page ----------------------
// Geratene URL-Patterns. Erste die "ohne 404" landet wird als Detail betrachtet.
const candidatePaths = [
  `/${captured.servicePartnerId}/operators/${TEST_OPERATOR}/cash-registers/${TEST_CASH_REGISTER}`,
  `/${captured.servicePartnerId}/operators/${TEST_OPERATOR}/devices/${TEST_CASH_REGISTER}`,
  `/${captured.servicePartnerId}/operators/${TEST_OPERATOR}/cash-register/${TEST_CASH_REGISTER}`,
];

let landedOn = null;
for (const p of candidatePaths) {
  log(`trying browser navigate: ${p}`);
  try {
    const resp = await page.goto(`${PORTAL_URL}${p}`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    if (resp && resp.status() < 400) {
      landedOn = p;
      log(`  -> ${resp.status()} (current path on landing)`);
      break;
    }
  } catch (e) {
    log(`  -> err: ${e.message}`);
  }
}
if (!landedOn) {
  log("WARN: keine geratene Cash-Register-Detail-URL hat geladen. Browser bleibt offen — manuell zur Kasse navigieren!");
}
await page.waitForTimeout(3000);

// ---- Suche nach "Anzeigen"-Buttons --------------------------------------
log("searching for password-related buttons/icons...");
const buttonPatterns = [
  "text=/master.*passw|passwort.*master|show.*password|reveal|anzeigen/i",
  "[aria-label*='passw' i]",
  "[aria-label*='reveal' i]",
  "[aria-label*='show' i]",
  "button:has(svg[data-icon='eye'])",
  "button:has-text('anzeigen')",
];
const buttonResults = [];
for (const sel of buttonPatterns) {
  try {
    const loc = page.locator(sel);
    const count = await loc.count();
    if (count > 0) {
      const texts = [];
      for (let i = 0; i < Math.min(count, 5); i++) {
        const text = await loc.nth(i).textContent().catch(() => null);
        const aria = await loc.nth(i).getAttribute("aria-label").catch(() => null);
        texts.push({ index: i, text: (text ?? "").trim().slice(0, 80), aria });
      }
      buttonResults.push({ selector: sel, count, samples: texts });
      log(`  ${count} matches for ${sel}`);
    }
  } catch (e) {
    buttonResults.push({ selector: sel, error: e.message });
  }
}
writeFileSync(BUTTONS_FILE, JSON.stringify(buttonResults, null, 2));

// Manuelle Inspektionsphase: 60s Browser offen halten.
// In dieser Zeit kannst du im Browser auf "Master-Passwort anzeigen" klicken,
// die Network-Datei wird parallel beschrieben.
if (!HEADLESS) {
  log("=================================================================");
  log("Browser bleibt 90s offen. KLICK manuell auf 'Master-Passwort'");
  log("oder einen Passwort-bezogenen Button — alle XHRs werden geloggt.");
  log("=================================================================");
  await page.waitForTimeout(90_000);
}

await browser.close();
log(`done. files written:`);
log(`  ${NETWORK_FILE}`);
log(`  ${PROBES_FILE}`);
log(`  ${BUTTONS_FILE}`);
