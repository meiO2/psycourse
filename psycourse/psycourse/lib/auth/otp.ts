import { db } from "@/lib/db";
import { OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS, RESET_TOKEN_TTL_MS } from "./constants";
import { generateOtp, generateToken, hashOtp, hashToken, isExpired, safeEqualHex } from "./tokens";

export type OtpType = "OTP_VERIFIKASI_EMAIL" | "OTP_RESET_PASSWORD";

export type IssueOtpResult = { ok: true; code: string } | { ok: false; retryAfterSec: number };

// Membuat OTP baru dan mengembalikan kodenya agar pemanggil bisa mengirimnya lewat email.
// Kode asli tidak disimpan, hanya hash-nya. OTP lama otomatis tidak berlaku.
export async function issueOtp(userId: string, type: OtpType, now: Date = new Date()): Promise<IssueOtpResult> {
  const last = await db.token.findFirst({ where: { userId, type }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last) {
    const waitMs = last.createdAt.getTime() + OTP_RESEND_COOLDOWN_MS - now.getTime();
    if (waitMs > 0) return { ok: false, retryAfterSec: Math.ceil(waitMs / 1000) };
  }

  const code = generateOtp();
  await db.$transaction([
    db.token.deleteMany({ where: { userId, type } }),
    db.token.create({
      data: { userId, type, tokenHash: hashOtp(userId, code), expiresAt: new Date(now.getTime() + OTP_TTL_MS) },
    }),
  ]);
  return { ok: true, code };
}

// true hanya kalau kode benar, belum kedaluwarsa, belum dipakai, dan percobaan belum habis.
// Semua kegagalan mengembalikan false tanpa membedakan sebabnya (kontrak: OTP_INVALID).
export async function verifyOtp(userId: string, type: OtpType, code: string, now: Date = new Date()): Promise<boolean> {
  const token = await db.token.findFirst({ where: { userId, type, usedAt: null }, orderBy: { createdAt: "desc" } });
  if (!token || isExpired(token.expiresAt, now)) return false;

  // Percobaan dihitung dulu secara atomik, baru kode dibandingkan. Jadi permintaan
  // paralel pun tidak bisa menebak lebih dari OTP_MAX_ATTEMPTS kali.
  const { attempts } = await db.token.update({
    where: { id: token.id },
    data: { attempts: { increment: 1 } },
    select: { attempts: true },
  });
  if (attempts > OTP_MAX_ATTEMPTS) return false;
  if (!safeEqualHex(token.tokenHash, hashOtp(userId, code))) return false;

  // Hanya satu dari dua permintaan benar yang bersamaan yang bisa menandai token terpakai.
  const used = await db.token.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: now } });
  return used.count === 1;
}

// Token reset kata sandi, diberikan setelah OTP recovery benar. Mengembalikan token asli
// (satu-satunya kesempatan melihatnya); database hanya menyimpan hash-nya.
export async function issueResetToken(userId: string, now: Date = new Date()): Promise<string> {
  const token = generateToken();
  await db.$transaction([
    db.token.deleteMany({ where: { userId, type: "TOKEN_RESET_PASSWORD" } }),
    db.token.create({
      data: {
        userId,
        type: "TOKEN_RESET_PASSWORD",
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
      },
    }),
  ]);
  return token;
}

// Menukar token reset dengan userId, dan menandainya terpakai. null kalau tidak valid.
export async function consumeResetToken(token: string, now: Date = new Date()): Promise<string | null> {
  const row = await db.token.findFirst({
    where: { type: "TOKEN_RESET_PASSWORD", tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: now } },
  });
  if (!row) return null;
  const used = await db.token.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  return used.count === 1 ? row.userId : null;
}
