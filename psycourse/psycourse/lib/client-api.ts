// Pemanggil API untuk halaman (sisi browser). Semua halaman auth memakai ini supaya
// penanganan error seragam dan mengikuti format error di docs/api-contract.md.

export type ApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  /** Pesan siap tampil ke pengguna, null kalau berhasil. */
  error: string | null;
  /** Kode error dari server (mis. EMAIL_NOT_VERIFIED), untuk logika halaman. */
  code: string | null;
};

type ErrorBody = { error?: { code?: string; message?: string } };

export async function api<T = unknown>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    const failure = (data as ErrorBody | null)?.error;
    return {
      ok: response.ok,
      status: response.status,
      data: data as T | null,
      error: response.ok ? null : (failure?.message ?? "Terjadi kesalahan. Coba lagi."),
      code: failure?.code ?? null,
    };
  } catch {
    return { ok: false, status: 0, data: null, error: "Tidak dapat terhubung ke server. Periksa koneksi internetmu.", code: "NETWORK" };
  }
}

export const RESET_TOKEN_KEY = "psycourse-reset-token";
