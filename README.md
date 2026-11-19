# kısa

Small, self-contained URL shortener built with Node.js 26, TypeScript, Express 5, better-sqlite3, and server-rendered HTML/CSS. No React, no bundler, no external services.

## Requirements

- Node.js 26 or newer
- pnpm (tested with pnpm 12)

## Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:4200.

For a production-style start:

```bash
pnpm install --prod
pnpm start
```

`pnpm start` runs `node src/index.ts`; Node 26 strips the TypeScript types at runtime, so there is no build step. `pnpm dev` uses `tsx watch` for reloads, and `pnpm smoke` uses `tsx` to run the checks.

## Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `tsx watch src/index.ts` | Development server with reload |
| `start` | `node src/index.ts` | Run the server with Node's native TypeScript support |
| `typecheck` | `tsc --noEmit` | Strict TypeScript check |
| `smoke` | `tsx src/smoke.ts` | End-to-end smoke test on a temporary port and database |

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4200` | HTTP port. |
| `BASE_URL` | unset | Public origin used to build `shortUrl`, for example `https://kisa.example.com`. When unset, the request origin is used. |
| `ADMIN_TOKEN` | `dev-token` | Token for `GET /api/links`. A startup warning is printed when the default is used. Set this in production. |
| `DB_PATH` | `./data/links.db` | SQLite file path. The parent directory is created automatically. |
| `TRUST_PROXY` | unset | Set to `1` when the app sits behind exactly one trusted reverse proxy, so client IP and protocol come from forwarded headers. |

Example (PowerShell):

```powershell
$env:PORT = "4200"
$env:BASE_URL = "https://kisa.example.com"
$env:ADMIN_TOKEN = "replace-with-a-long-random-token"
pnpm dev
```

Example (bash):

```bash
PORT=4200 BASE_URL=https://kisa.example.com ADMIN_TOKEN=replace-me pnpm dev
```

## API

All API errors use a stable shape:

```json
{ "error": "invalid_url", "message": "Yalnızca http:// veya https:// adresleri kabul edilir." }
```

### Create a link

```bash
curl -sS -X POST http://localhost:4200/api/links \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com/very/long/path?ref=newsletter"}'
```

```json
{
  "slug": "aB3dE9",
  "shortUrl": "http://localhost:4200/aB3dE9"
}
```

- `201 Created` on success.
- `url` must be a valid `http://` or `https://` URL (maximum 2048 characters). `javascript:`, `data:`, and URLs containing credentials are rejected with `400 invalid_url`.
- `slug` is optional. When omitted, a random 6-character base62 slug is generated with collision retries.
- A supplied slug must match `^[a-zA-Z0-9_-]{3,32}$`. Taken slugs return `409 slug_taken`. The slug `api` is reserved.
- Requests must use `application/json`; other media types return `415`.
- Link creation uses an in-memory token bucket with a capacity of 10 that refills at 10 requests per minute per IP. Exhausted clients get `429` with `Retry-After`.

### List links

```bash
curl -sS "http://localhost:4200/api/links?token=dev-token"
```

```json
{
  "links": [
    {
      "slug": "aB3dE9",
      "url": "https://example.com/very/long/path?ref=newsletter",
      "clicks": 3,
      "createdAt": "2026-11-19T08:12:08.015Z",
      "lastClickedAt": "2026-11-19T08:14:31.220Z"
    }
  ]
}
```

Links are sorted newest first. `lastClickedAt` is `null` until the first click. A missing or wrong token returns `401`.

### Follow a short link

```bash
curl -i http://localhost:4200/aB3dE9
```

Returns `302` with the validated target in `Location`. Redirects are sent with `Cache-Control: no-store`; click counting happens just after the response is handed off (`setImmediate`) so it does not delay the redirect.

### Stats page

Open `http://localhost:4200/aB3dE9+` in a browser. The literal trailing `+` is the stats convention; Express 5's path syntax treats wildcard suffixes differently, so a small pattern middleware handles `/{slug}+` instead of relying on the old `/:slug+` form.

The page shows the slug, target, total clicks, creation time, last click time, and an inline SVG sparkline of clicks per UTC day for the last 14 days. It is fully server-rendered, uses no chart library, and escapes all stored values.

Unknown slugs and routes return a Turkish `404` page.

## Storage

`data/links.db` is created on first start, with WAL mode and a busy timeout.

```sql
CREATE TABLE links (
  slug TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  last_clicked_at INTEGER
);

CREATE TABLE clicks_by_day (
  slug TEXT NOT NULL,
  day TEXT NOT NULL,           -- YYYY-MM-DD (UTC)
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (slug, day)
);
```

Both the total and the daily counter are updated in one transaction. A click may appear in the list/stats a few milliseconds after the redirect because the write is deferred.

## Security notes

- Only `http:` and `https:` targets are stored and redirected to; stored URLs are re-validated before redirect as defense in depth.
- All HTML output is escaped, including the stats page target URL.
- SQL uses prepared statements throughout.
- Admin tokens are compared in constant time with SHA-256 hashes.
- Responses set `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, and a restrictive CSP.
- The admin token is passed in the query string because that is the v1 contract. Query strings can land in proxy access logs, so redact `token` at the proxy or disable query logging for `/api/links`.

## Smoke test

```bash
pnpm smoke
```

The script boots the app on port `0` (an ephemeral localhost port) with a temporary SQLite database, then:

1. creates a link and checks the generated 6-character base62 slug and `shortUrl`;
2. requests the short link twice with `redirect: "manual"`, asserting `302` and the exact `Location`;
3. polls the list API until the click count reaches 2;
4. checks the stats page renders and escapes the target URL;
5. rejects `javascript:` and `data:` targets with `400`;
6. checks custom slugs, duplicate slugs, token protection, and the Turkish `404` page;
7. exhausts the per-IP creation limit and asserts a `429` with `Retry-After`.

It uses only loopback networking and cleans up the temporary database and server. Exit code `0` means every assertion passed.

## Deployment note

SQLite and the in-memory rate limiter make this a single-process application:

- Deploy to a Node 26 host with a persistent, writable volume mounted at `data/` (or point `DB_PATH` at one). Do not use an ephemeral/serverless filesystem or scale to multiple instances that each write their own database.
- Put the app behind an HTTPS reverse proxy. Set `ADMIN_TOKEN` to a long random value, set `BASE_URL` to the public origin, and set `TRUST_PROXY=1` if the proxy is the only hop. Make sure the proxy forwards `Host` and `X-Forwarded-Proto`.
- Run `pnpm install --prod` and `pnpm start` under a process manager (systemd, pm2, Docker, and so on).
- Back up `data/links.db` together with its `-wal` and `-shm` files, or use SQLite's online backup mechanism.
- Point the platform health check at `GET /`, which returns the landing page with `200`.
- The rate limit resets on restart and is per process. If you later need multiple instances, move storage to a shared database and rate limiting to a shared store.
