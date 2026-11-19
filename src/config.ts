import { resolve } from "node:path";

export const DEFAULT_PORT = 4200;
export const DEFAULT_ADMIN_TOKEN = "dev-token";

export interface Config {
  port: number;
  dbPath: string;
  baseUrl?: string;
  adminToken: string;
  usingDefaultAdminToken: boolean;
  trustProxy: boolean;
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rawAdminToken = env.ADMIN_TOKEN?.trim();
  const adminToken = rawAdminToken || DEFAULT_ADMIN_TOKEN;

  return {
    port: parsePort(env.PORT),
    dbPath: resolve(process.cwd(), env.DB_PATH?.trim() || "data/links.db"),
    baseUrl: normalizeBaseUrl(env.BASE_URL),
    adminToken,
    usingDefaultAdminToken: !rawAdminToken,
    trustProxy: parseBoolean(env.TRUST_PROXY),
  };
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_PORT;

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT 1 ile 65535 arasında bir tam sayı olmalı (verilen: ${raw}).`);
  }
  return port;
}

function normalizeBaseUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`BASE_URL geçerli bir adres değil: ${value}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("BASE_URL yalnızca http:// veya https:// ile başlayabilir.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("BASE_URL kullanıcı adı veya parola içeremez.");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("BASE_URL sorgu dizesi veya çapa içeremez.");
  }

  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
}

function parseBoolean(raw: string | undefined): boolean {
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}
