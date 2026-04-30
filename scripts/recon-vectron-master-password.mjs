// scripts/recon-vectron-master-password.mjs
//
// Recon v3 — KEINE Body-Filter. Wir dumpen JEDE XHR auf vectron.cloud mit
// vollem JSON-Body, plus einem Tag wenn ein 8-stelliger Zahlen-String drinsteht
// (das echte Master-Passwort hat 8 Ziffern, hat der User bestaetigt).
//
// Klick-Pfad im Portal:
//   Operator-Suche -> Operator -> "Filialen" -> Filiale -> "Kassen" ->
//   3-Punkte rechts -> "Masterpasswort anzeigen"
//
// Output: data/recon/all-xhr-<ts>.jsonl

import { chromium } from "playwright";
import { appendFileSync, mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RECON_DIR = join(ROOT, "data", "recon");
mkdirSync(RECON_DIR, { recursive: true });

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
if (!VECTRON_USER || !VECTRON_PASS) {
  console.error("ERROR: VECTRON_USER + VECTRON_PASS muessen in .env.local stehen.");
  process.exit(1);
}

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const NETWORK_FILE = join(RECON_DIR, `all-xhr-${ts}.jsonl`);
const log = (...x) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...x);

const browser = await chromium.launch({ headless: false, slowMo: 60 });
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
});
const page = await ctx.newPage();

let counter = 0;
let eightDigitHits = 0;

page.on("response", async (resp) => {
  const url = resp.url();
  if (!url.includes("vectron.cloud")) return;
  counter++;

  let body = null;
  let has8DigitString = false;
  let bodyContainsPasswordWord = false;
  try {
    const ct = resp.headers()["content-type"] ?? "";
    if (ct.includes("application/json")) {
      const text = await resp.text();
      // 8-stelliges Zahlen-String-Literal: "...":"12345678"
      // Engerer Filter: muss als JSON-string-Wert auftauchen, nicht als Zahl
      // (z.B. customerNumber:14594208 wird ausgeschlossen — kein Quote davor)
      has8DigitString = /:\s*"\d{8}"/m.test(text);
      bodyContainsPasswordWord = /password|passwort|master/i.test(text) && !/masterdata/i.test(text);
      body = text.length < 6000 ? text : text.slice(0, 3000) + " ...[truncated]... " + text.slice(-1000);
    }
  } catch {}

  if (has8DigitString) {
    eightDigitHits++;
    log(`*** 8-DIGIT STRING HIT [#${counter}]: ${resp.request().method()} ${url}`);
  }

  appendFileSync(
    NETWORK_FILE,
    JSON.stringify({
      n: counter,
      ts: new Date().toISOString(),
      method: resp.request().method(),
      status: resp.status(),
      url,
      has8DigitString,
      bodyContainsPasswordWord,
      body,
    }) + "\n",
  );
});

// ---- Login --------------------------------------------------------------
log(`navigating to ${PORTAL_URL}...`);
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

console.log("");
console.log("=================================================================");
console.log("Browser ist da. JETZT bitte folgenden Pfad klicken:");
console.log("");
console.log("  1. Operator suchen (z.B. 'Bäckerei Wurm')");
console.log("  2. Operator anklicken");
console.log("  3. Tab/Link 'Filialen' klicken");
console.log("  4. Eine Filiale anklicken");
console.log("  5. Tab/Link 'Kassen' klicken");
console.log("  6. Bei einer Kasse rechts: 3-Punkte-Menue oeffnen");
console.log("  7. 'Masterpasswort anzeigen' klicken");
console.log("  8. Im Pop-up sollte das 8-stellige Master-Passwort stehen");
console.log("");
console.log("Browser bleibt 10 Min offen.");
console.log("Live-Log: jeder XHR mit '...':'12345678' (8 Ziffern als String)");
console.log("triggert ein '*** 8-DIGIT STRING HIT'.");
console.log("=================================================================");

await page.waitForTimeout(10 * 60 * 1000);
await browser.close();

writeFileSync(
  join(RECON_DIR, `summary-${ts}.json`),
  JSON.stringify({ totalXhrs: counter, eightDigitHits, networkFile: NETWORK_FILE }, null, 2),
);
log(`done. ${counter} XHRs, ${eightDigitHits} 8-digit hits.`);
log(`Log: ${NETWORK_FILE}`);
