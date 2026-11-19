import { randomBytes } from "node:crypto";

const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const MAX_UNBIASED_BYTE = 256 - (256 % BASE62_ALPHABET.length);

export const SLUG_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;
export const GENERATED_SLUG_LENGTH = 6;

/** Generates a cryptographically random base62 slug without modulo bias. */
export function generateSlug(length: number = GENERATED_SLUG_LENGTH): string {
  let slug = "";

  while (slug.length < length) {
    const bytes = randomBytes(length - slug.length + 8);
    for (const byte of bytes) {
      if (byte >= MAX_UNBIASED_BYTE) continue;
      slug += BASE62_ALPHABET[byte % BASE62_ALPHABET.length];
      if (slug.length === length) break;
    }
  }

  return slug;
}
