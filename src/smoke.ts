import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.ts";
import { openDatabase } from "./db.ts";

const TARGET_URL = "https://example.com/hello?x=1&y=2";
const ADMIN_TOKEN = "smoke-token";

function pass(message: string): void {
  console.log(`  ✓ ${message}`);
}

function check(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
  pass(message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface LinkListResponse {
  links?: unknown;
}

async function fetchClicks(
  baseUrl: string,
  slug: string,
): Promise<{ found: boolean; clicks: number }> {
  const response = await fetch(
    `${baseUrl}/api/links?token=${encodeURIComponent(ADMIN_TOKEN)}`,
  );
  const body = (await response.json()) as LinkListResponse;
  const links = Array.isArray(body.links)
    ? (body.links as Array<Record<string, unknown>>)
    : [];
  const link = links.find((entry) => entry.slug === slug);

  return {
    found: link !== undefined,
    clicks: typeof link?.clicks === "number" ? link.clicks : -1,
  };
}

async function main(): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), "link-shortener-smoke-"));
  const db = openDatabase(join(tempDir, "links.db"));
  let server: Server | undefined;

  try {
    const app = createApp({ db, adminToken: ADMIN_TOKEN });
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    console.log("Smoke test: kısa bağlantı akışı\n");

    const createResponse = await fetch(`${baseUrl}/api/links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: TARGET_URL }),
    });
    check(createResponse.status === 201, `POST /api/links 201 döndü (${createResponse.status})`);

    const created = (await createResponse.json()) as {
      slug?: unknown;
      shortUrl?: unknown;
    };
    const slug = typeof created.slug === "string" ? created.slug : "";
    check(/^[A-Za-z0-9]{6}$/.test(slug), `6 karakterlik base62 slug üretildi (${slug})`);
    check(
      created.shortUrl === `${baseUrl}/${slug}`,
      `shortUrl istek origin'ini kullanıyor (${String(created.shortUrl)})`,
    );

    for (const attempt of [1, 2]) {
      const redirectResponse = await fetch(`${baseUrl}/${slug}`, {
        redirect: "manual",
      });
      check(redirectResponse.status === 302, `${attempt}. yönlendirme 302 döndü`);
      check(
        redirectResponse.headers.get("location") === TARGET_URL,
        `${attempt}. yönlendirme doğru Location başlığını verdi`,
      );
      await redirectResponse.text();
    }

    let clicks = -1;
    let found = false;
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const state = await fetchClicks(baseUrl, slug);
      clicks = state.clicks;
      found = state.found;
      if (found && clicks === 2) break;
      await delay(50);
    }
    check(found, "Bağlantı liste API'sinde kayıt bulundu");
    check(clicks === 2, `Tıklama sayısı 2 (gerçek: ${clicks})`);

    const statsResponse = await fetch(`${baseUrl}/${slug}+`);
    const statsHtml = await statsResponse.text();
    check(statsResponse.status === 200, "İstatistik sayfası 200 döndü");
    check(
      statsHtml.includes("Bağlantı istatistikleri"),
      "İstatistik sayfası Türkçe başlığı içeriyor",
    );
    check(
      statsHtml.includes("https://example.com/hello?x=1&amp;y=2"),
      "İstatistik sayfası hedef URL'yi HTML olarak kaçırıyor",
    );

    const unauthorized = await fetch(`${baseUrl}/api/links`);
    check(unauthorized.status === 401, "Token olmadan liste API'si 401 döndü");
    await unauthorized.text();

    const invalidResponse = await fetch(`${baseUrl}/api/links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "javascript:alert(1)" }),
    });
    check(invalidResponse.status === 400, "javascript: hedefi 400 ile reddedildi");
    const invalidBody = (await invalidResponse.json()) as { error?: unknown };
    check(
      invalidBody.error === "invalid_url",
      "Geçersiz URL hata kodu invalid_url",
    );

    const dataResponse = await fetch(`${baseUrl}/api/links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "data:text/html,merhaba" }),
    });
    check(dataResponse.status === 400, "data: hedefi 400 ile reddedildi");
    await dataResponse.text();

    const customResponse = await fetch(`${baseUrl}/api/links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/ozel", slug: "davet-2026" }),
    });
    const customBody = (await customResponse.json()) as { slug?: unknown };
    check(customResponse.status === 201, "Özel slug ile bağlantı oluşturuldu");
    check(customBody.slug === "davet-2026", "Özel slug korunuyor");

    const duplicateResponse = await fetch(`${baseUrl}/api/links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/baska", slug: "davet-2026" }),
    });
    check(duplicateResponse.status === 409, "Kullanılan slug 409 ile reddedildi");
    await duplicateResponse.text();

    const badSlugResponse = await fetch(`${baseUrl}/api/links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/kisa", slug: "ab" }),
    });
    check(badSlugResponse.status === 400, "Geçersiz slug 400 ile reddedildi");
    await badSlugResponse.text();

    const reservedResponse = await fetch(`${baseUrl}/api/links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/api", slug: "api" }),
    });
    check(reservedResponse.status === 400, "Ayrılmış api slug'ı 400 ile reddedildi");
    await reservedResponse.text();

    const missingResponse = await fetch(`${baseUrl}/bilinmeyen-slug`);
    const missingHtml = await missingResponse.text();
    check(missingResponse.status === 404, "Bilinmeyen slug 404 döndü");
    check(missingHtml.includes("Bağlantı bulunamadı"), "404 sayfası Türkçe");

    let rateLimitResponse: Response | undefined;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/links`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: `https://example.com/limit-${attempt}` }),
      });
      await response.text();
      if (response.status === 429) {
        rateLimitResponse = response;
        break;
      }
      check(response.status === 201, `Sınır öncesi istek ${attempt + 1} kabul edildi`);
    }
    check(rateLimitResponse !== undefined, "Dakikada 10 istek sınırı 429 döndü");
    check(
      rateLimitResponse !== undefined &&
        rateLimitResponse.headers.get("retry-after") !== null,
      "429 yanıtı Retry-After başlığı içeriyor",
    );

    console.log("\nSmoke test başarılı.");
  } finally {
    const activeServer = server;
    if (activeServer) {
      await new Promise<void>((resolve) => {
        activeServer.close(() => resolve());
        activeServer.closeAllConnections();
      });
    }
    db.close();
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error("\nSmoke test başarısız:");
  console.error(error);
  process.exitCode = 1;
});
