import { createHash, timingSafeEqual } from "node:crypto";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import {
  getDailyClicks,
  getLink,
  incrementClicks,
  insertLink,
  listLinks,
} from "./db.ts";
import type { AppDatabase } from "./db.ts";
import { TokenBucketRateLimiter } from "./rate-limit.ts";
import { generateSlug, SLUG_PATTERN } from "./slug.ts";
import { lastUtcDays } from "./time.ts";
import { isSafeRedirectUrl, validateTargetUrl } from "./url.ts";
import { landingPage, notFoundPage, serverErrorPage, statsPage } from "./views.ts";

const MAX_SLUG_ATTEMPTS = 10;
const RESERVED_SLUGS = new Set(["api"]);

export interface CreateAppOptions {
  db: AppDatabase;
  adminToken: string;
  baseUrl?: string;
  trustProxy?: boolean;
  rateLimitCapacity?: number;
  rateLimitWindowMs?: number;
}

export function createApp(options: CreateAppOptions): express.Express {
  const app = express();
  const capacity = options.rateLimitCapacity ?? 10;
  const limiter = new TokenBucketRateLimiter(capacity, options.rateLimitWindowMs ?? 60_000);

  app.disable("x-powered-by");
  app.set("case sensitive routing", true);
  if (options.trustProxy) app.set("trust proxy", 1);

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    next();
  });

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(landingPage());
  });

  app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });

  const enforceRateLimit = (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const decision = limiter.take(key);

    res.setHeader("RateLimit-Limit", String(capacity));
    res.setHeader("RateLimit-Remaining", String(decision.remaining));

    if (!decision.allowed) {
      res.setHeader("Retry-After", String(decision.retryAfterSeconds));
      res.status(429).json({
        error: "rate_limited",
        message: "Çok fazla bağlantı isteği. Lütfen biraz sonra tekrar deneyin.",
      });
      return;
    }

    next();
  };

  app.post(
    "/api/links",
    requireJson,
    enforceRateLimit,
    express.json({ limit: "16kb" }),
    (req, res) => {
      const body: unknown = req.body;
      if (!isRecord(body)) {
        res.status(400).json({
          error: "invalid_body",
          message: "İstek gövdesi bir JSON nesnesi olmalı.",
        });
        return;
      }

      const urlResult = validateTargetUrl(body.url);
      if (!urlResult.ok) {
        res.status(400).json({ error: "invalid_url", message: urlResult.message });
        return;
      }

      const slugValue = body.slug;
      let slug: string;

      if (slugValue === undefined || slugValue === null) {
        slug = "";
        for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
          const candidate = generateSlug();
          if (
            insertLink(options.db, {
              slug: candidate,
              url: urlResult.url,
              createdAt: Date.now(),
            })
          ) {
            slug = candidate;
            break;
          }
        }

        if (!slug) {
          res.status(500).json({
            error: "slug_generation_failed",
            message: "Kısa bağlantı oluşturulamadı. Lütfen tekrar deneyin.",
          });
          return;
        }
      } else {
        if (typeof slugValue !== "string" || !SLUG_PATTERN.test(slugValue)) {
          res.status(400).json({
            error: "invalid_slug",
            message:
              "Kısa ad 3–32 karakter olmalı; yalnızca harf, rakam, tire ve alt çizgi içerebilir.",
          });
          return;
        }

        if (RESERVED_SLUGS.has(slugValue.toLowerCase())) {
          res.status(400).json({
            error: "invalid_slug",
            message: "Bu kısa ad ayrılmış. Başka bir ad deneyin.",
          });
          return;
        }

        const inserted = insertLink(options.db, {
          slug: slugValue,
          url: urlResult.url,
          createdAt: Date.now(),
        });

        if (!inserted) {
          res.status(409).json({
            error: "slug_taken",
            message: "Bu kısa ad kullanılıyor. Başka bir ad deneyin.",
          });
          return;
        }

        slug = slugValue;
      }

      const shortUrl = `${resolveBaseUrl(req, options.baseUrl)}/${slug}`;
      res.status(201).json({ slug, shortUrl });
    },
  );

  app.get("/api/links", (req, res) => {
    const token = req.query.token;
    if (typeof token !== "string" || !tokensMatch(token, options.adminToken)) {
      res.status(401).json({
        error: "unauthorized",
        message: "Geçersiz veya eksik yönetim belirteci.",
      });
      return;
    }

    res.json({ links: listLinks(options.db) });
  });

  app.all("/api/links", (_req, res) => {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({
      error: "method_not_allowed",
      message: "Bu metot desteklenmiyor.",
    });
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: "not_found",
      message: "API yolu bulunamadı.",
    });
  });

  // Stats convention: /{slug}+
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }

    const match = /^\/([A-Za-z0-9_-]{3,32})\+$/.exec(req.path);
    if (!match) {
      next();
      return;
    }

    const slug = match[1];
    if (!slug) {
      next();
      return;
    }

    const link = getLink(options.db, slug);
    if (!link) {
      res.status(404).type("html").send(notFoundPage());
      return;
    }

    const days = lastUtcDays(14);
    const daily = getDailyClicks(options.db, slug, days[0] ?? "");

    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(statsPage(link, daily));
  });

  app.get("/:slug", (req, res) => {
    const slug = req.params.slug;
    const link = getLink(options.db, slug);

    if (!link || !isSafeRedirectUrl(link.url)) {
      res.status(404).type("html").send(notFoundPage());
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, link.url);

    // better-sqlite3 is synchronous, so defer the write until after the
    // redirect response is handed to the socket.
    const clickedAt = Date.now();
    setImmediate(() => {
      try {
        incrementClicks(options.db, link.slug, clickedAt);
      } catch (error) {
        console.error("[click] tıklama kaydedilemedi:", error);
      }
    });
  });

  app.use((_req, res) => {
    res.status(404).type("html").send(notFoundPage());
  });

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const errorType = readErrorType(error);
    const isApi = req.path === "/api" || req.path.startsWith("/api/");

    if (isApi) {
      if (errorType === "entity.too.large") {
        res.status(413).json({
          error: "payload_too_large",
          message: "İstek gövdesi çok büyük.",
        });
        return;
      }
      if (errorType === "entity.parse.failed") {
        res.status(400).json({
          error: "invalid_json",
          message: "İstek gövdesi geçerli JSON değil.",
        });
        return;
      }
      if (errorType === "charset.unsupported") {
        res.status(415).json({
          error: "unsupported_charset",
          message: "Desteklenmeyen karakter kodlaması.",
        });
        return;
      }
    }

    console.error(`[server] ${req.method} ${req.path} işlenemedi:`, error);
    if (isApi) {
      res.status(500).json({
        error: "internal_error",
        message: "Beklenmeyen bir hata oluştu.",
      });
      return;
    }

    res.status(500).type("html").send(serverErrorPage());
  });

  return app;
}

function requireJson(req: Request, res: Response, next: NextFunction): void {
  if (!req.is("application/json")) {
    res.status(415).json({
      error: "unsupported_media_type",
      message: "İstek gövdesi application/json olmalı.",
    });
    return;
  }
  next();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveBaseUrl(req: Request, configured: string | undefined): string {
  if (configured) return configured;
  const host = req.get("host");
  return host ? `${req.protocol}://${host}` : "http://localhost";
}

function tokensMatch(provided: string, expected: string): boolean {
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

function readErrorType(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "type" in error) {
    const type = (error as { type?: unknown }).type;
    if (typeof type === "string") return type;
  }
  return undefined;
}
