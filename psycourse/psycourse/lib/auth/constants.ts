// Angka-angka aturan auth. Sesuai docs/api-contract.md bagian 1, 2, dan 7.
const MENIT = 60 * 1000;
const HARI = 24 * 60 * MENIT;

export const SESSION_COOKIE = "psycourse_session";
export const SESSION_TTL_MS = 1 * HARI;
export const SESSION_REMEMBER_TTL_MS = 30 * HARI; // saat "Tetap masuk" dicentang

export const OTP_TTL_MS = 10 * MENIT;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const RESET_TOKEN_TTL_MS = 15 * MENIT;

export const BCRYPT_COST = 12;

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt hanya membaca 72 byte pertama dan diam-diam memotong sisanya, jadi
// kata sandi lebih panjang ditolak, bukan dipotong.
export const PASSWORD_MAX_BYTES = 72;
