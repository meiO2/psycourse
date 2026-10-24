import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_REMEMBER_TTL_MS, SESSION_TTL_MS } from "./constants";
import { generateToken, hashToken, isExpired } from "./tokens";

export type SessionUser = {
  id: string;
  nama: string;
  email: string;
  role: "USER" | "ADMIN";
  bahasa: string;
};

// Membuat sesi di database dan memasang cookie. Hanya boleh dipanggil dari Route Handler
// atau Server Action (cookie tidak bisa diubah saat render halaman).
// Cookie berisi token acak; database hanya menyimpan hash-nya, jadi database bocor
// tidak otomatis membocorkan sesi yang sedang aktif (SEC-11).
export async function createSession(userId: string, rememberMe = false): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + (rememberMe ? SESSION_REMEMBER_TTL_MS : SESSION_TTL_MS));

  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

// Pengguna dari sesi di cookie, atau null kalau tidak ada, kedaluwarsa, atau akun belum terverifikasi.
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, nama: true, email: true, role: true, bahasa: true, emailVerified: true } } },
  });
  if (!session) return null;

  if (isExpired(session.expiresAt)) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!session.user.emailVerified) return null;

  const { emailVerified: _emailVerified, ...user } = session.user;
  return user;
}

// Logout: hapus sesi dari database dan cookie-nya.
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  cookieStore.delete(SESSION_COOKIE);
}

// Dipakai setelah kata sandi diganti: semua perangkat harus login ulang.
export async function destroyAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
