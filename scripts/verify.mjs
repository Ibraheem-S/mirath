/**
 * One-shot verification: serves dist/ statically, loads the app in headless
 * Chrome, captures console errors and desktop+mobile screenshots, tears down.
 * Run `npm run build` first. Usage: node scripts/verify.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer-core";

const PORT = 7199;
const APP_URL = `http://127.0.0.1:${PORT}/`;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = path.join(DIST, urlPath === "/" ? "index.html" : urlPath);
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file)) file = path.join(DIST, "index.html"); // SPA fallback
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

const log = (m) => { console.log(`[verify] ${m}`); };

try {
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  log(`static server on ${APP_URL}`);

  log("launching chrome…");
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    protocolTimeout: 60000,
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  log("desktop pass…");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await delay(3000);
  await page.screenshot({ path: path.join(ROOT, "verify-desktop-top.png") });
  await page.evaluate(() => document.getElementById("results")?.scrollIntoView());
  await delay(700);
  await page.screenshot({ path: path.join(ROOT, "verify-desktop-results.png") });

  // smoke-test interactions: set debts above the estate → insolvency error must appear
  log("interaction smoke test…");
  await page.evaluate(() => {
    const input = document.querySelector("input[aria-label='Debts']");
    if (!input) throw new Error("debts input not found");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "99999999");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await delay(600);
  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasInsolvencyError = bodyText.toLowerCase().includes("insolvent");

  // PDF will-document check: fill testator name, click download, expect a file
  log("PDF will download test…");
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await delay(2500);
  const downloadDir = path.join(ROOT, "verify-downloads");
  fs.mkdirSync(downloadDir, { recursive: true });
  const client = await page.createCDPSession();
  await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
  await page.evaluate(() => {
    const input = [...document.querySelectorAll("input")].find(
      (i) => i.placeholder && i.placeholder.includes("Amina"),
    );
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "Test Testator");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await delay(300);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Download the will as PDF"),
    );
    btn?.click();
  });
  let pdfName = null;
  for (let i = 0; i < 20; i++) {
    await delay(400);
    pdfName = fs.readdirSync(downloadDir).find((f) => f.endsWith(".pdf"));
    if (pdfName) break;
  }
  const pdfOk = !!pdfName && fs.statSync(path.join(downloadDir, pdfName)).size > 5000;

  // tooltip check: hovering a circled-i must reveal the math marginalia
  const tipButton = await page.$("#results button[aria-label^='Why']");
  let tooltipShown = false;
  if (tipButton) {
    await tipButton.hover();
    await delay(700);
    tooltipShown = await page.evaluate(
      () => !!document.querySelector("[data-radix-popper-content-wrapper], [role='tooltip']"),
    );
  }

  // ================= account framework flow =================
  log("account flow test…");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await delay(2500);

  const clickButton = (text) =>
    page.evaluate((t) => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(t));
      if (!btn) throw new Error(`button not found: ${t}`);
      btn.click();
    }, text);
  const typeInto = (selector, value) =>
    page.evaluate(
      ({ s, v }) => {
        const input = document.querySelector(s);
        if (!input) throw new Error(`input not found: ${s}`);
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, v);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      },
      { s: selector, v: value },
    );

  // 1. open dialog, create account with consent
  await clickButton("Account");
  await delay(600);
  await typeInto("input[aria-label='Your name']", "Amina Verify");
  await page.evaluate(() => document.querySelector("input[aria-label='Consent']")?.click());
  await delay(300);
  await clickButton("Create local account");
  await delay(1000);
  const accountCreated = await page.evaluate(() => !!localStorage.getItem("mirath.account.v1"));

  // 2. add a designee (first one defaults to executor role)
  await clickButton("Add designee");
  await delay(400);
  await typeInto("input[aria-label='Designee name']", "Khalid Verify");
  await delay(1000); // 600ms debounced persist
  const designeeSaved = await page.evaluate(() =>
    (localStorage.getItem("mirath.account.v1") ?? "").includes("Khalid Verify"),
  );
  await page.screenshot({ path: path.join(ROOT, "verify-account-dialog.png") });

  // 3. export JSON → machine-readable portability file (GDPR Art. 20)
  await clickButton("Export JSON");
  let jsonName = null;
  for (let i = 0; i < 15; i++) {
    await delay(400);
    jsonName = fs.readdirSync(downloadDir).find((f) => f.endsWith(".json"));
    if (jsonName) break;
  }
  let exportOk = false;
  if (jsonName) {
    try {
      exportOk =
        JSON.parse(fs.readFileSync(path.join(downloadDir, jsonName), "utf8")).displayName ===
        "Amina Verify";
    } catch { exportOk = false; }
  }

  // 4. reload → profile restores: name in header trigger, will fields prefilled
  await page.reload({ waitUntil: "domcontentloaded" });
  await delay(2500);
  const persisted = await page.evaluate(() => document.body.innerText.includes("Amina Verify"));
  const prefilled = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll("input")];
    const testator = inputs.find((i) => i.placeholder?.includes("Amina bint"));
    const executor = inputs.find((i) => i.placeholder?.includes("my brother Khalid"));
    return testator?.value === "Amina Verify" && executor?.value === "Khalid Verify";
  });

  // 5. reopen dialog → erase everything (GDPR Art. 17), storage must be empty
  await clickButton("Amina Verify");
  await delay(600);
  await clickButton("Erase everything");
  await delay(400);
  await clickButton("Yes, erase");
  await delay(600);
  const erased = await page.evaluate(() => !localStorage.getItem("mirath.account.v1"));
  const backToAnonymous = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Account");
    return !!btn;
  });

  log("mobile pass…");
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await delay(3000);
  await page.screenshot({ path: path.join(ROOT, "verify-mobile-top.png") });
  await page.evaluate(() => document.getElementById("results")?.scrollIntoView());
  await delay(700);
  await page.screenshot({ path: path.join(ROOT, "verify-mobile-results.png") });

  await browser.close();
  console.log("CONSOLE_ERRORS:", errors.length ? "\n" + errors.join("\n---\n") : "none");
  console.log("INSOLVENCY_ERROR_BANNER:", hasInsolvencyError ? "shown ✓" : "MISSING ✗");
  console.log("TOOLTIP_ON_HOVER:", tooltipShown ? "shown ✓" : "MISSING ✗");
  console.log("WILL_PDF_DOWNLOAD:", pdfOk ? `ok ✓ (${pdfName})` : "MISSING ✗");
  console.log("ACCOUNT_CREATE:", accountCreated ? "persisted ✓" : "FAILED ✗");
  console.log("ACCOUNT_DESIGNEE_SAVED:", designeeSaved ? "persisted ✓" : "FAILED ✗");
  console.log("ACCOUNT_EXPORT_JSON:", exportOk ? `ok ✓ (${jsonName})` : "MISSING ✗");
  console.log("ACCOUNT_RESTORE_ON_RELOAD:", persisted ? "restored ✓" : "FAILED ✗");
  console.log("WILL_FIELDS_PREFILLED:", prefilled ? "prefilled ✓" : "FAILED ✗");
  console.log("ACCOUNT_ERASE:", erased && backToAnonymous ? "erased, anonymous ✓" : "FAILED ✗");
  console.log("DONE");
} finally {
  server.close();
}
