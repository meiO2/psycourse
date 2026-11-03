import { db } from "@/lib/db";

export type RateLimitResult = { limited: boolean; retryAfterSec: number };

type Row = { hits: number; windowStart: Date };

function retryAfter(row: Row, windowMs: number, now: Date): number {
  return Math.max(1, Math.ceil((row.windowStart.getTime() + windowMs - now.getTime()) / 1000));
}

// Mencatat satu percobaan, lalu cek apakah sudah melewati batas. Untuk aturan "maksimal N
// kali per jendela waktu": percobaan ke-N masih lolos, ke-(N+1) ditolak.
// Penambahan dilakukan dalam satu perintah SQL, jadi permintaan paralel tidak bisa
// menyelip dan melewati batas.
export async function hit(key: string, max: number, windowMs: number, now: Date = new Date()): Promise<RateLimitResult> {
  const expiredBefore = new Date(now.getTime() - windowMs);
  const rows = await db.$queryRaw<Row[]>`
    INSERT INTO "RateLimit" ("key", "hits", "windowStart")
    VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "hits" = CASE WHEN "RateLimit"."windowStart" <= ${expiredBefore} THEN 1 ELSE "RateLimit"."hits" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" <= ${expiredBefore} THEN ${now} ELSE "RateLimit"."windowStart" END
    RETURNING "hits", "windowStart"`;
  const row = rows[0];
  return { limited: row.hits > max, retryAfterSec: retryAfter(row, windowMs, now) };
}

// Hanya memeriksa, tanpa mencatat. Dipakai untuk login: diperiksa sebelum mencoba, dan
// hanya percobaan yang GAGAL yang dicatat lewat hit(). Terblokir kalau sudah ada `max` kegagalan.
export async function check(key: string, max: number, windowMs: number, now: Date = new Date()): Promise<RateLimitResult> {
  const row = await db.rateLimit.findUnique({ where: { key } });
  if (!row || row.windowStart.getTime() + windowMs <= now.getTime()) return { limited: false, retryAfterSec: 0 };
  return { limited: row.hits >= max, retryAfterSec: retryAfter(row, windowMs, now) };
}

export async function reset(key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}
