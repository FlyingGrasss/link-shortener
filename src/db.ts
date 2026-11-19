import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { utcDayKey } from "./time.ts";

export type AppDatabase = Database.Database;

export interface LinkRow {
  slug: string;
  url: string;
  created_at: number;
  clicks: number;
  last_clicked_at: number | null;
}

export interface LinkDto {
  slug: string;
  url: string;
  clicks: number;
  createdAt: string;
  lastClickedAt: string | null;
}

export interface NewLink {
  slug: string;
  url: string;
  createdAt: number;
}

export function openDatabase(file: string): AppDatabase {
  mkdirSync(dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      slug TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      clicks INTEGER NOT NULL DEFAULT 0,
      last_clicked_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS clicks_by_day (
      slug TEXT NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (slug, day)
    );
  `);

  return db;
}

/** Returns false when the slug already exists. */
export function insertLink(db: AppDatabase, link: NewLink): boolean {
  const result = db
    .prepare(
      `INSERT INTO links (slug, url, created_at, clicks, last_clicked_at)
       VALUES (?, ?, ?, 0, NULL)
       ON CONFLICT(slug) DO NOTHING`,
    )
    .run(link.slug, link.url, link.createdAt);

  return result.changes > 0;
}

export function getLink(db: AppDatabase, slug: string): LinkRow | undefined {
  return db
    .prepare(
      "SELECT slug, url, created_at, clicks, last_clicked_at FROM links WHERE slug = ?",
    )
    .get(slug) as LinkRow | undefined;
}

export function listLinks(db: AppDatabase): LinkDto[] {
  const rows = db
    .prepare(
      `SELECT slug, url, created_at, clicks, last_clicked_at
       FROM links
       ORDER BY created_at DESC, slug ASC`,
    )
    .all() as LinkRow[];

  return rows.map((row) => ({
    slug: row.slug,
    url: row.url,
    clicks: row.clicks,
    createdAt: new Date(row.created_at).toISOString(),
    lastClickedAt:
      row.last_clicked_at === null ? null : new Date(row.last_clicked_at).toISOString(),
  }));
}

export function incrementClicks(db: AppDatabase, slug: string, now: number = Date.now()): void {
  const day = utcDayKey(now);

  const apply = db.transaction(() => {
    const updated = db
      .prepare("UPDATE links SET clicks = clicks + 1, last_clicked_at = ? WHERE slug = ?")
      .run(now, slug);

    if (updated.changes === 0) return;

    db.prepare(
      `INSERT INTO clicks_by_day (slug, day, count)
       VALUES (?, ?, 1)
       ON CONFLICT(slug, day) DO UPDATE SET count = count + 1`,
    ).run(slug, day);
  });

  apply();
}

export function getDailyClicks(
  db: AppDatabase,
  slug: string,
  sinceDay: string,
): Map<string, number> {
  const rows = db
    .prepare("SELECT day, count FROM clicks_by_day WHERE slug = ? AND day >= ? ORDER BY day")
    .all(slug, sinceDay) as Array<{ day: string; count: number }>;

  return new Map(rows.map((row) => [row.day, row.count]));
}
