const MAX_URL_LENGTH = 2048;

export type UrlValidation =
  | { ok: true; url: string }
  | { ok: false; message: string };

export function validateTargetUrl(raw: unknown): UrlValidation {
  if (typeof raw !== "string") {
    return { ok: false, message: "Hedef bağlantı metin olarak gönderilmeli." };
  }

  const value = raw.trim();
  if (!value) {
    return { ok: false, message: "Hedef bağlantı gerekli." };
  }
  if (value.length > MAX_URL_LENGTH) {
    return { ok: false, message: `Hedef bağlantı en fazla ${MAX_URL_LENGTH} karakter olabilir.` };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, message: "Geçerli bir bağlantı adresi girin." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, message: "Yalnızca http:// veya https:// adresleri kabul edilir." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, message: "Bağlantı adresi kullanıcı adı veya parola içeremez." };
  }

  return { ok: true, url: parsed.href };
}

/** Defense in depth for rows that may have been altered outside the API. */
export function isSafeRedirectUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
