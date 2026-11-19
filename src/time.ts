const DAY_MS = 86_400_000;

export function utcDayKey(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/** Returns UTC day keys ending with today, oldest first. */
export function lastUtcDays(count: number, now: number = Date.now()): string[] {
  const today = new Date(now);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  return Array.from({ length: count }, (_, index) =>
    new Date(todayUtc - (count - 1 - index) * DAY_MS).toISOString().slice(0, 10),
  );
}
