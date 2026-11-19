import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://localhost:4200";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

const slug = `e2e-${Date.now().toString(36)}`;
const out = { steps: [], errors, slug };
const step = async (name, fn) => {
  try { await fn(); out.steps.push({ name, ok: true }); }
  catch (e) { out.steps.push({ name, ok: false, error: String(e).slice(0, 250) }); throw e; }
};

try {
  await step("landing renders", async () => {
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByText(/Kısa bağlantı oluştur/).first().waitFor({ timeout: 15000 });
  });

  await step("create short link", async () => {
    await page.locator("#url").fill("https://example.com/bir-cok-uzun-baglanti?deneme=1");
    await page.locator("#slug").fill(slug);
    await page.locator("#submit").click();
    await page.locator("#result").waitFor({ state: "visible", timeout: 15000 });
    out.shortUrl = await page.locator("#short-url").inputValue();
    out.created = out.shortUrl.includes(slug);
    if (!out.created) throw new Error("slug not in result");
  });

  await step("redirect works", async () => {
    const res = await page.request.get(`${base}/${slug}`, { maxRedirects: 0 });
    out.redirectStatus = res.status();
    out.location = res.headers()["location"] ?? null;
    if (res.status() !== 302 || !out.location?.includes("example.com")) {
      throw new Error(`status ${res.status()} location ${out.location}`);
    }
  });

  await step("stats page shows clicks", async () => {
    await page.goto(`${base}/${slug}+`, { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    out.statsText = body.replace(/\s+/g, " ").slice(0, 220);
    if (!/tıklan|Tıkla/i.test(body)) throw new Error("no click counts on stats page");
  });
} catch {}

out.title = await page.title().catch(() => null);
console.log(JSON.stringify(out, null, 2));
await browser.close();
