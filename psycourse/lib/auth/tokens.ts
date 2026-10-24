import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// OTP 6 digit. randomInt memakai sumber acak yang aman secara kriptografi (bukan Math.random).
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// Token acak 256 bit untuk sesi dan token reset kata sandi.
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

// Hash untuk token acak panjang (sesi, token reset). SHA-256 cukup karena inputnya
// sudah acak 256 bit, jadi tidak bisa ditebak lewat serangan kamus.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET belum diisi atau kurang dari 32 karakter. Buat dengan: openssl rand -base64 32");
  }
  return secret;
}

// OTP hanya punya 1 juta kemungkinan, jadi SHA-256 biasa bisa ditebak habis dalam
// hitungan detik kalau database bocor. HMAC dengan AUTH_SECRET (yang tidak ada di
// database) menutup celah itu. userId ikut di-hash supaya kode yang sama milik dua
// pengguna menghasilkan hash berbeda.
export function hashOtp(userId: string, code: string): string {
  return createHmac("sha256", authSecret()).update(`${userId}:${code}`).digest("hex");
}

// Perbandingan hash dalam waktu tetap, supaya lamanya proses tidak membocorkan
// seberapa banyak karakter awal yang sudah benar.
export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
