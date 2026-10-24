import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateOtp, generateToken, hashOtp, hashToken, isExpired, safeEqualHex } from "./tokens";

const SECRET = "rahasia-uji-coba-yang-panjangnya-lebih-dari-32-karakter";
let originalSecret: string | undefined;

beforeEach(() => {
  originalSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = SECRET;
});
afterEach(() => {
  if (originalSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = originalSecret;
});

describe("generateOtp", () => {
  it("selalu 6 digit angka, termasuk yang diawali nol", () => {
    for (let i = 0; i < 500; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });
});

describe("generateToken / hashToken", () => {
  it("token acak dan unik", () => {
    expect(generateToken()).not.toBe(generateToken());
    expect(generateToken().length).toBeGreaterThanOrEqual(43); // 32 byte base64url
  });
  it("hash deterministik, 64 hex, dan berbeda dari token asli", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toBe(token);
  });
});

describe("hashOtp", () => {
  it("deterministik untuk userId dan kode yang sama", () => {
    expect(hashOtp("user-1", "123456")).toBe(hashOtp("user-1", "123456"));
  });
  it("beda pengguna dengan kode sama menghasilkan hash berbeda", () => {
    expect(hashOtp("user-1", "123456")).not.toBe(hashOtp("user-2", "123456"));
  });
  it("beda kode menghasilkan hash berbeda", () => {
    expect(hashOtp("user-1", "123456")).not.toBe(hashOtp("user-1", "123457"));
  });
  it("beda AUTH_SECRET menghasilkan hash berbeda", () => {
    const a = hashOtp("user-1", "123456");
    process.env.AUTH_SECRET = "rahasia-lain-yang-juga-lebih-dari-32-karakter-panjangnya";
    expect(hashOtp("user-1", "123456")).not.toBe(a);
  });
  it("melempar error kalau AUTH_SECRET kosong atau terlalu pendek", () => {
    delete process.env.AUTH_SECRET;
    expect(() => hashOtp("user-1", "123456")).toThrow(/AUTH_SECRET/);
    process.env.AUTH_SECRET = "pendek";
    expect(() => hashOtp("user-1", "123456")).toThrow(/AUTH_SECRET/);
  });
});

describe("isExpired", () => {
  const now = new Date("2026-10-24T10:00:00Z");
  it("false sebelum batas waktu", () => {
    expect(isExpired(new Date("2026-10-24T10:00:01Z"), now)).toBe(false);
  });
  it("true tepat di batas waktu dan sesudahnya", () => {
    expect(isExpired(now, now)).toBe(true);
    expect(isExpired(new Date("2026-10-24T09:59:59Z"), now)).toBe(true);
  });
  it("OTP 10 menit: masih berlaku di menit ke-9, kedaluwarsa di menit ke-10", () => {
    const dibuat = new Date("2026-10-24T10:00:00Z");
    const berakhir = new Date(dibuat.getTime() + 10 * 60 * 1000);
    expect(isExpired(berakhir, new Date("2026-10-24T10:09:00Z"))).toBe(false);
    expect(isExpired(berakhir, new Date("2026-10-24T10:10:00Z"))).toBe(true);
  });
});

describe("safeEqualHex", () => {
  it("true untuk hash sama, false untuk beda atau beda panjang", () => {
    const h = hashToken("abc");
    expect(safeEqualHex(h, h)).toBe(true);
    expect(safeEqualHex(h, hashToken("abd"))).toBe(false);
    expect(safeEqualHex(h, "abcd")).toBe(false);
  });
});
