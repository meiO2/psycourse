import bcrypt from "bcryptjs";
import { BCRYPT_COST, PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from "./constants";

// Mengembalikan pesan error untuk pengguna, atau null kalau kata sandi valid.
export function validatePassword(plain: string): string | null {
  if (plain.length < PASSWORD_MIN_LENGTH) return `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  if (Buffer.byteLength(plain, "utf8") > PASSWORD_MAX_BYTES) return "Kata sandi terlalu panjang.";
  return null;
}

// SEC-01: kata sandi hanya disimpan sebagai hash bcrypt, tidak pernah disimpan atau di-log apa adanya.
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Hash palsu untuk dibandingkan saat email tidak ditemukan. Tanpa ini, login dengan
// email yang tidak terdaftar selesai jauh lebih cepat daripada email terdaftar, dan
// selisih waktunya bisa dipakai menebak email mana yang punya akun.
let dummyHash: Promise<string> | undefined;

export async function verifyPasswordOrDummy(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (hash) return verifyPassword(plain, hash);
  dummyHash ??= hashPassword("kata-sandi-palsu-untuk-menyamakan-waktu");
  await verifyPassword(plain, await dummyHash);
  return false;
}
