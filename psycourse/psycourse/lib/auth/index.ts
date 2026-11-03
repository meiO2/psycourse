// Pintu masuk modul auth untuk modul lain (BE2, BE3, BE4).
//
//   import { getCurrentUser, requireUser, requireAdmin } from "@/lib/auth";
//
// Di Route Handler:
//   const user = await requireUser();      // melempar AuthError kalau belum login
//   const admin = await requireAdmin();    // melempar AuthError kalau bukan ADMIN
// Tangkap dengan authErrorResponse(e) untuk menjadi respons 401/403 sesuai kontrak API.
import "server-only";
import { cache } from "react";
import { getSessionUser, type SessionUser } from "./session";

export { createSession, destroySession, destroyAllSessions, type SessionUser } from "./session";
export { hashPassword, verifyPassword, verifyPasswordOrDummy, validatePassword } from "./password";
export { issueOtp, verifyOtp, issueResetToken, consumeResetToken, type OtpType } from "./otp";

export class AuthError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN",
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

// cache(): beberapa pemanggilan dalam satu permintaan hanya sekali ke database.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => getSessionUser());

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("UNAUTHENTICATED", 401, "Silakan masuk terlebih dahulu.");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AuthError("FORBIDDEN", 403, "Kamu tidak punya akses ke halaman ini.");
  return user;
}

// Mengubah AuthError menjadi respons JSON sesuai format error di kontrak API.
// Error lain dilempar ulang supaya tidak tertelan.
export function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  throw error;
}
