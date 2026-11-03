import { AuthError } from "@/lib/auth";

// Helper bersama untuk Route Handler, supaya semua respons mengikuti docs/api-contract.md.

export function apiError(code: string, message: string, status: number, headers?: HeadersInit): Response {
  return Response.json({ error: { code, message } }, { status, headers });
}

export const validationError = (message: string) => apiError("VALIDATION_ERROR", message, 400);

export function tooManyAttempts(retryAfterSec: number): Response {
  const menit = Math.max(1, Math.ceil(retryAfterSec / 60));
  return apiError("TOO_MANY_ATTEMPTS", `Terlalu banyak percobaan. Coba lagi dalam ${menit} menit.`, 429, {
    "Retry-After": String(retryAfterSec),
  });
}

// Isi JSON harus berupa objek. null kalau bukan JSON valid atau bukan objek.
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Alamat IP untuk batas laju. Header x-forwarded-for hanya bisa dipercaya kalau aplikasi
// berada di belakang proxy hosting yang memasangnya; pastikan saat deploy.
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

type PublicUserSource = { id: string; nama: string; email: string; role: string; bahasa: string };

// Hanya field yang aman dikirim ke klien. Jangan pernah menyertakan passwordHash.
export function publicUser(user: PublicUserSource) {
  return { id: user.id, nama: user.nama, email: user.email, role: user.role, bahasa: user.bahasa };
}

export const MENIT = 60 * 1000;

export type RouteContext<T = Record<string, string>> = {
  params: Promise<T>;
};

// Membungkus handler: AuthError menjadi 401/403, error lain menjadi 500 JSON umum
// tanpa stack trace (SEC-10). Detailnya hanya masuk log server.
export function withErrors<TContext = RouteContext>(
  handler: (request: Request, context: TContext) => Promise<Response>,
) {
  return async (request: Request, context: TContext): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof AuthError) return apiError(error.code, error.message, error.status);
      console.error("[api] error tak terduga:", error);
      return apiError("SERVER_ERROR", "Terjadi kesalahan. Coba lagi nanti.", 500);
    }
  };
}
