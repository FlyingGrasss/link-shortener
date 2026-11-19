import type { LinkRow } from "./db.ts";
import { lastUtcDays } from "./time.ts";

const SITE_NAME = "kısa";

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const numberFormatter = new Intl.NumberFormat("tr-TR");

const STYLES = `
:root {
  color-scheme: light;
  --page: #ffffff;
  --subtle: #f7f7f8;
  --text: #18181b;
  --muted: #71717a;
  --border: #e4e4e7;
  --focus: #2563eb;
  --danger: #b91c1c;
  --success: #15803d;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--page);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 1rem;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; text-underline-offset: .18em; }
.wrap { width: 100%; max-width: 44rem; margin: 0 auto; padding: 1.25rem 1.25rem 4rem; }
.site { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 0 2.5rem; }
.brand { font-size: 1.125rem; font-weight: 700; letter-spacing: -.03em; text-decoration: none; }
.brand span { color: var(--muted); }
.nav-link { font-size: .875rem; color: var(--muted); text-decoration: none; }
.nav-link:hover { color: var(--text); }
.eyebrow { margin: 0 0 .5rem; color: var(--muted); font-size: .75rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
h1 { margin: 0 0 .75rem; font-size: clamp(1.75rem, 5vw, 2.5rem); line-height: 1.15; letter-spacing: -.035em; }
h2 { margin: 0; font-size: 1.0625rem; letter-spacing: -.01em; }
.lede { max-width: 36rem; margin: 0 0 2rem; color: var(--muted); }
.card { border: 1px solid var(--border); border-radius: .75rem; padding: 1.25rem; }
.field { margin-bottom: 1rem; }
label { display: block; margin-bottom: .375rem; font-size: .9375rem; font-weight: 600; }
input[type="url"], input[type="text"] {
  width: 100%;
  min-height: 2.5rem;
  padding: .5rem .75rem;
  border: 1px solid var(--border);
  border-radius: .5rem;
  background: #fff;
  color: var(--text);
  font: inherit;
}
input::placeholder { color: var(--muted); }
input:focus-visible, a:focus-visible, button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
input[aria-invalid="true"] { border-color: var(--danger); }
.help { margin: .375rem 0 0; color: var(--muted); font-size: .8125rem; }
button, .button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  padding: .5rem 1rem;
  border: 1px solid transparent;
  border-radius: .5rem;
  background: var(--text);
  color: #fff;
  font: inherit;
  font-size: .9375rem;
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
}
button:hover, .button:hover { background: #27272a; }
button.secondary, .button.secondary { background: #fff; color: var(--text); border-color: var(--border); }
button.secondary:hover, .button.secondary:hover { background: var(--subtle); }
button:disabled { opacity: .55; cursor: not-allowed; }
.status { min-height: 1.5rem; margin: .875rem 0 0; font-size: .875rem; }
.status.error { color: var(--danger); }
.status.success { color: var(--success); }
.notice { margin: 1.25rem 0 0; padding: .75rem 1rem; border: 1px solid var(--border); border-radius: .5rem; background: var(--subtle); color: var(--muted); font-size: .875rem; }
.result { margin-top: 1.25rem; border: 1px solid var(--border); border-radius: .75rem; padding: 1.25rem; background: var(--subtle); }
.result h2 { margin-bottom: 1rem; }
.result-row { display: flex; gap: .5rem; align-items: stretch; }
.result-row input { flex: 1; min-width: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .875rem; background: #fff; }
.actions { display: flex; flex-wrap: wrap; gap: .625rem; margin-top: 1.5rem; }
.target { margin: 0 0 1.5rem; color: var(--muted); overflow-wrap: anywhere; }
.target span { display: inline-block; margin-right: .375rem; color: var(--text); font-size: .8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
.slug-title { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: clamp(1.5rem, 5vw, 2rem); overflow-wrap: anywhere; }
.metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; margin: 0 0 1.5rem; }
.metric { min-width: 0; padding: 1rem; border: 1px solid var(--border); border-radius: .75rem; }
.metric dt { color: var(--muted); font-size: .8125rem; }
.metric dd { margin: .25rem 0 0; font-size: 1.375rem; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.metric dd.date { font-size: .875rem; font-weight: 500; line-height: 1.45; letter-spacing: 0; }
.spark-card { margin-bottom: 1.5rem; }
.spark-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: .25rem 1rem; margin-bottom: 1rem; }
.spark-head p { margin: 0; color: var(--muted); font-size: .8125rem; }
.spark-head strong { color: var(--text); font-variant-numeric: tabular-nums; }
.spark { margin: 0; }
.spark-chart { padding-top: .25rem; border-bottom: 1px solid var(--border); }
.spark-chart svg { display: block; width: 100%; height: 72px; }
.spark-axis { display: flex; justify-content: space-between; margin-top: .5rem; color: var(--muted); font-size: .75rem; font-variant-numeric: tabular-nums; }
.spark-total { margin: .5rem 0 0; color: var(--muted); font-size: .8125rem; }
.spark-total strong { color: var(--text); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
[hidden] { display: none !important; }
@media (max-width: 560px) {
  .wrap { padding-bottom: 2.5rem; }
  .metrics { grid-template-columns: 1fr; }
  .result-row { flex-direction: column; }
}
@media (prefers-reduced-motion: reduce) {
  * { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
}
`;

const LANDING_SCRIPT = `
(function () {
  "use strict";

  var form = document.getElementById("create-form");
  var urlInput = document.getElementById("url");
  var slugInput = document.getElementById("slug");
  var submitButton = document.getElementById("submit");
  var status = document.getElementById("form-status");
  var result = document.getElementById("result");
  var shortInput = document.getElementById("short-url");
  var shortLink = document.getElementById("short-link");
  var copyButton = document.getElementById("copy");

  if (!form || !urlInput || !slugInput || !submitButton || !status || !result || !shortInput || !shortLink || !copyButton) {
    return;
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = kind ? "status " + kind : "status";
  }

  function markInvalid(input, invalid) {
    if (invalid) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (submitButton.disabled) return;

    markInvalid(urlInput, false);
    markInvalid(slugInput, false);
    result.hidden = true;

    var target = urlInput.value.trim();
    if (!target) {
      markInvalid(urlInput, true);
      setStatus("Hedef bağlantı gerekli.", "error");
      urlInput.focus();
      return;
    }

    var parsed = null;
    try {
      parsed = new URL(target);
    } catch (error) {
      parsed = null;
    }
    if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
      markInvalid(urlInput, true);
      setStatus("Yalnızca http:// veya https:// ile başlayan geçerli bir adres girin.", "error");
      urlInput.focus();
      return;
    }

    var slug = slugInput.value.trim();
    if (slug && !/^[a-zA-Z0-9_-]{3,32}$/.test(slug)) {
      markInvalid(slugInput, true);
      setStatus("Kısa ad 3–32 karakter olmalı; yalnızca harf, rakam, tire ve alt çizgi kullanın.", "error");
      slugInput.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Kısaltılıyor…";
    setStatus("", "");

    try {
      var payload = { url: target };
      if (slug) payload.slug = slug;

      var response = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      var data = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }

      if (!response.ok) {
        var message = data && typeof data.message === "string"
          ? data.message
          : "Bağlantı oluşturulamadı. Lütfen tekrar deneyin.";
        setStatus(message, "error");
        return;
      }

      if (!data || typeof data.shortUrl !== "string") {
        setStatus("Sunucudan beklenmeyen bir yanıt geldi. Lütfen tekrar deneyin.", "error");
        return;
      }

      shortInput.value = data.shortUrl;
      shortLink.href = data.shortUrl;
      result.hidden = false;
      setStatus("Kısa bağlantınız hazır.", "success");
      copyButton.focus();
    } catch (error) {
      setStatus("Sunucuya ulaşılamadı. Lütfen tekrar deneyin.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Kısalt";
    }
  });

  copyButton.addEventListener("click", async function () {
    var value = shortInput.value;
    if (!value) return;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(value);
      } else {
        shortInput.select();
        if (!document.execCommand("copy")) throw new Error("copy failed");
      }
      setStatus("Panoya kopyalandı.", "success");
    } catch (error) {
      shortInput.select();
      setStatus("Kopyalanamadı; bağlantıyı seçip elle kopyalayın.", "error");
    }
  });
})();
`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function layout(options: { title: string; body: string; script?: string }): string {
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="description" content="Basit, takip edilebilir kısa bağlantılar.">
  <title>${escapeHtml(options.title)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="wrap">
    ${options.body}
  </div>
  ${options.script ? `<script>${options.script}</script>` : ""}
</body>
</html>`;
}

function siteHeader(action = ""): string {
  return `<header class="site">
    <a class="brand" href="/">kısa<span>.</span></a>
    ${action}
  </header>`;
}

function formatDateTime(epoch: number | null): string {
  if (epoch === null) return "Henüz tıklanmadı";
  return `${dateTimeFormatter.format(new Date(epoch))} UTC`;
}

function formatShortDate(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return shortDateFormatter.format(new Date(Date.UTC(year, month - 1, date)));
}

export function landingPage(): string {
  const body = `${siteHeader()}
  <main>
    <p class="eyebrow">Basit ve takip edilebilir</p>
    <h1>Kısa bağlantı oluştur</h1>
    <p class="lede">Uzun adresleri yapıştırın; paylaşması kolay, tıklamaları sayılan kısa bir bağlantı alın.</p>

    <section class="card" aria-labelledby="form-title">
      <h2 id="form-title" class="sr-only">Bağlantı formu</h2>
      <form id="create-form" novalidate>
        <div class="field">
          <label for="url">Hedef bağlantı</label>
          <input id="url" name="url" type="url" inputmode="url" autocomplete="url" placeholder="https://example.com/uzun-adres" required aria-describedby="url-help form-status">
          <p id="url-help" class="help">http:// veya https:// ile başlayan tam adres.</p>
        </div>
        <div class="field">
          <label for="slug">İsteğe bağlı kısa ad</label>
          <input id="slug" name="slug" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="ornek-ad" aria-describedby="slug-help form-status">
          <p id="slug-help" class="help">3–32 karakter; harf, rakam, tire ve alt çizgi.</p>
        </div>
        <button id="submit" type="submit">Kısalt</button>
      </form>
      <p id="form-status" class="status" role="status" aria-live="polite"></p>
    </section>

    <section id="result" class="result" hidden aria-labelledby="result-title">
      <h2 id="result-title">Bağlantınız hazır</h2>
      <label for="short-url">Kısa bağlantı</label>
      <div class="result-row">
        <input id="short-url" type="text" readonly>
        <button id="copy" class="secondary" type="button">Kopyala</button>
      </div>
      <p class="help"><a id="short-link" href="/" target="_blank" rel="noopener noreferrer">Bağlantıyı aç</a></p>
    </section>

    <noscript>
      <p class="notice">Formu kullanmak için tarayıcınızda JavaScript etkin olmalı.</p>
    </noscript>
  </main>`;

  return layout({
    title: "Kısa bağlantı oluştur — kısa",
    body,
    script: LANDING_SCRIPT,
  });
}

function sparkline(daily: Map<string, number>): string {
  const days = lastUtcDays(14);
  const points = days.map((day) => ({ day, count: daily.get(day) ?? 0 }));
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const peak = points.reduce((max, point) => Math.max(max, point.count), 0);
  const max = Math.max(1, peak);
  const width = 280;
  const height = 68;
  const padding = 10;
  const step = points.length > 1 ? width / (points.length - 1) : width;

  const coordinates = points.map((point, index) => ({
    ...point,
    x: index * step,
    y: padding + (1 - point.count / max) * (height - padding * 2),
  }));

  const linePoints = coordinates
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const areaPoints = `0,${height} ${linePoints} ${width},${height}`;
  const stroke = total === 0 ? "#d4d4d8" : "#18181b";

  const summary =
    total === 0
      ? "Son 14 günde tıklama yok."
      : `Son 14 günde toplam ${numberFormatter.format(total)} tıklama. En yüksek gün ${numberFormatter.format(peak)} tıklama.`;

  return `<figure class="spark">
    <div class="spark-chart" role="img" aria-label="${escapeHtml(summary)}">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <polygon points="${areaPoints}" fill="#f4f4f5"></polygon>
        <polyline points="${linePoints}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline>
      </svg>
    </div>
    <figcaption class="spark-axis">
      <span>${escapeHtml(formatShortDate(days[0] ?? ""))}</span>
      <span>Bugün</span>
    </figcaption>
    <p class="spark-total">Son 14 günde <strong>${numberFormatter.format(total)}</strong> tıklama</p>
  </figure>`;
}

export function statsPage(link: LinkRow, daily: Map<string, number>): string {
  const body = `${siteHeader('<a class="nav-link" href="/">Yeni bağlantı</a>')}
  <main>
    <p class="eyebrow">Bağlantı istatistikleri</p>
    <h1 class="slug-title">/${escapeHtml(link.slug)}</h1>
    <p class="target"><span>Hedef</span><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(link.url)}</a></p>

    <dl class="metrics">
      <div class="metric">
        <dt>Tıklama</dt>
        <dd>${numberFormatter.format(link.clicks)}</dd>
      </div>
      <div class="metric">
        <dt>Oluşturulma</dt>
        <dd class="date">${escapeHtml(formatDateTime(link.created_at))}</dd>
      </div>
      <div class="metric">
        <dt>Son tıklama</dt>
        <dd class="date">${escapeHtml(formatDateTime(link.last_clicked_at))}</dd>
      </div>
    </dl>

    <section class="card spark-card" aria-labelledby="spark-title">
      <div class="spark-head">
        <h2 id="spark-title">Son 14 gün</h2>
        <p>Tüm zamanlar: <strong>${numberFormatter.format(link.clicks)}</strong> tıklama</p>
      </div>
      ${sparkline(daily)}
    </section>

    <div class="actions">
      <a class="button" href="/${escapeHtml(link.slug)}">Kısa bağlantıya git</a>
      <a class="button secondary" href="/">Yeni bağlantı</a>
    </div>
  </main>`;

  return layout({
    title: `/${link.slug} istatistikleri — ${SITE_NAME}`,
    body,
  });
}

export function notFoundPage(): string {
  const body = `${siteHeader()}
  <main>
    <p class="eyebrow">404</p>
    <h1>Bağlantı bulunamadı</h1>
    <p class="lede">Bu kısa bağlantı silinmiş ya da hiç oluşturulmamış olabilir.</p>
    <a class="button" href="/">Ana sayfaya dön</a>
  </main>`;

  return layout({
    title: "Bağlantı bulunamadı — kısa",
    body,
  });
}

export function serverErrorPage(): string {
  const body = `${siteHeader()}
  <main>
    <p class="eyebrow">500</p>
    <h1>Bir şeyler ters gitti</h1>
    <p class="lede">İstek işlenemedi. Lütfen birkaç saniye sonra tekrar deneyin.</p>
    <a class="button" href="/">Ana sayfaya dön</a>
  </main>`;

  return layout({
    title: "Bir hata oluştu — kısa",
    body,
  });
}
