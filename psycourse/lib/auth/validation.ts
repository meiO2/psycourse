// Validasi data masuk sesuai docs/api-contract.md bagian 1. Semua menerima `unknown`
// (isi JSON dari klien tidak bisa dipercaya) dan mengembalikan nilai bersih, atau null.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

export function parseName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  return name.length >= 1 && name.length <= 100 ? name : null;
}

export function parseOtpCode(raw: unknown): string | null {
  return typeof raw === "string" && /^\d{6}$/.test(raw) ? raw : null;
}

export type Bahasa = "id" | "en";

export function parseBahasa(raw: unknown): Bahasa | null {
  return raw === "id" || raw === "en" ? raw : null;
}
