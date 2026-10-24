# Kontrak API Akun (BE1 → FE)

Versi draf 1, 24 Oktober 2026. Pemilik: BE1. Dokumen ini disepakati dulu dengan FE **sebelum** endpoint dibuat, supaya FE bisa memakai data dummy sesuai bentuk di bawah.

Cakupan: autentikasi dan akun (`/api/auth/*`, `/api/me`). Pembayaran, kuis, dan admin punya kontrak sendiri di modul masing-masing.

## 1. Aturan umum

- Prefix `/api`, format JSON (`Content-Type: application/json`).
- Nama field memakai camelCase.
- **Sesi** lewat cookie `psycourse_session`: `HttpOnly`, `SameSite=Lax`, `Secure` di staging/produksi. FE **tidak pernah** membaca atau menyimpan token sesi. Browser mengirimnya otomatis.
- Semua halaman FE yang memanggil endpoint terproteksi memakai `fetch(..., { credentials: "same-origin" })`.
- Respons error selalu berbentuk:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Email atau kata sandi salah." } }
```

`code` dipakai FE untuk logika, `message` boleh ditampilkan langsung ke pengguna. Pesan sengaja umum dan tidak membocorkan apakah sebuah email terdaftar.

| Status | Arti |
|---|---|
| 200 | Berhasil, ada isi |
| 202 | Permintaan diterima, hasil dikirim lewat email (respons sama apa pun kondisi akunnya) |
| 204 | Berhasil, tanpa isi |
| 400 | Data tidak valid (`VALIDATION_ERROR`, `OTP_INVALID`) |
| 401 | Belum login atau login gagal |
| 403 | Dilarang (`EMAIL_NOT_VERIFIED`, `FORBIDDEN`) |
| 429 | Terlalu banyak percobaan (`TOO_MANY_ATTEMPTS`) |
| 500 | Kesalahan server, pesan umum tanpa detail teknis |

### Validasi data masuk

| Field | Aturan |
|---|---|
| `name` | 1 sampai 100 karakter, setelah dipangkas spasi |
| `email` | Format email valid, maksimal 254 karakter, disimpan huruf kecil |
| `password` | Minimal 8 karakter, maksimal 128 |
| `code` (OTP) | Tepat 6 digit angka |
| `bahasa` | `"id"` atau `"en"` |

Konfirmasi kata sandi dicek di browser saja dan **tidak dikirim** ke server.

## 2. Endpoint auth

### 2.1 `POST /api/auth/register`

Dipakai halaman `/register`. Publik.

Request:

```json
{
  "name": "Mei Lestari",
  "email": "mei@example.com",
  "password": "kata-sandi-pengguna",
  "privacyConsent": true
}
```

Respons sukses `202`:

```json
{ "verificationRequired": true }
```

Perilaku server:
- Membuat `User` (belum terverifikasi), baris `Consent`, dan OTP 6 digit yang dikirim ke email.
- Respons **sama persis** walau email sudah terdaftar, supaya tidak membocorkan akun yang ada.
- `privacyConsent` harus `true`, kalau tidak `400 VALIDATION_ERROR`.

Setelah sukses, FE berpindah ke `/verify-otp?mode=register` dan **membawa email** (query atau state).

### 2.2 `POST /api/auth/verify-otp`

Dipakai halaman `/verify-otp`. Publik.

Request:

```json
{ "email": "mei@example.com", "code": "123456", "purpose": "register" }
```

`purpose`: `"register"` atau `"recovery"`.

Respons sukses untuk `purpose: "register"`, `200`, dan cookie sesi ikut diset:

```json
{ "user": { "id": "clx...", "nama": "Mei Lestari", "email": "mei@example.com", "role": "USER", "bahasa": "id" } }
```

FE lalu berpindah ke `/welcome`.

Respons sukses untuk `purpose: "recovery"`, `200`:

```json
{ "resetToken": "token-acak-berumur-pendek" }
```

FE membawa `resetToken` ke `/reset-password`.

Error: `400 OTP_INVALID` (salah, kedaluwarsa, atau sudah dipakai, pesannya sama), `429 TOO_MANY_ATTEMPTS`.

Aturan OTP: berlaku 10 menit, maksimal 5 kali salah, sekali pakai, hanya OTP terbaru yang berlaku.

### 2.3 `POST /api/auth/resend-otp`

Dipakai tombol "Kirim ulang" di `/verify-otp`. Publik. **Endpoint tambahan** yang belum ada di daftar usulan README.

Request:

```json
{ "email": "mei@example.com", "purpose": "register" }
```

Respons `202` dengan isi `{}` apa pun kondisinya. Dibatasi 1 kali per 60 detik per email (`429 TOO_MANY_ATTEMPTS` kalau terlalu cepat). OTP lama otomatis tidak berlaku.

### 2.4 `POST /api/auth/login`

Dipakai halaman `/login` **dan** `/admin` (login admin). Publik.

Request:

```json
{ "email": "mei@example.com", "password": "kata-sandi-pengguna", "rememberMe": false }
```

Respons sukses `200` dan cookie sesi diset:

```json
{ "user": { "id": "clx...", "nama": "Mei Lestari", "email": "mei@example.com", "role": "USER", "bahasa": "id" } }
```

Error:
- `401 INVALID_CREDENTIALS`: email atau kata sandi salah (pesan sama untuk keduanya).
- `403 EMAIL_NOT_VERIFIED`: kata sandi benar tapi akun belum verifikasi OTP. FE mengarahkan ke `/verify-otp?mode=register`.
- `429 TOO_MANY_ATTEMPTS`: lebih dari 5 kali gagal dalam 15 menit untuk kombinasi IP/email.

Masa sesi: 1 hari, atau 30 hari kalau `rememberMe: true`.

**Login admin memakai email**, bukan username. Halaman `/admin` memakai endpoint yang sama. Setelah sukses, FE memeriksa `user.role`:
- `"ADMIN"` → lanjut ke `/admin/dashboard`.
- `"USER"` → tampilkan error "Akun ini bukan administrator" dan panggil `/api/auth/logout`. Pemeriksaan sebenarnya tetap di server pada setiap halaman dan endpoint admin, bukan di FE.

### 2.5 `POST /api/auth/logout`

Terautentikasi. Tanpa body. Respons `204`. Server menghapus sesi dari database dan menghapus cookie.

### 2.6 `POST /api/auth/forgot-password`

Dipakai halaman `/forgot-password`. Publik.

Request:

```json
{ "email": "mei@example.com" }
```

Respons `202` dengan isi `{}`, **selalu sama** walau email tidak terdaftar. Jika akun ada dan terverifikasi, OTP dikirim ke email.

Setelah sukses, FE berpindah ke `/verify-otp` (tanpa `mode=register`) dan membawa email.

### 2.7 `POST /api/auth/reset-password`

Dipakai halaman `/reset-password`. Publik, tapi butuh `resetToken` yang valid.

Request:

```json
{ "resetToken": "token-dari-verify-otp", "password": "kata-sandi-baru" }
```

Respons sukses `204`. Efek: kata sandi diganti, `resetToken` hangus, dan **semua sesi aktif pengguna itu dihapus**. FE berpindah ke `/login`.

Error: `400 OTP_INVALID` kalau token salah atau kedaluwarsa (berlaku 15 menit).

## 3. Endpoint akun

### 3.1 `GET /api/me`

Terautentikasi. Dipakai dashboard (nama dan avatar) dan halaman pengaturan.

Respons `200`:

```json
{
  "id": "clx...",
  "nama": "Mei Lestari",
  "email": "mei@example.com",
  "role": "USER",
  "bahasa": "id",
  "akses": null
}
```

`akses` (paket aktif) diisi BE2 setelah modul pembayaran jadi. Untuk sekarang `null`, dan FE menampilkan "Free". Tanpa sesi: `401 UNAUTHENTICATED`.

### 3.2 `PATCH /api/me`

Terautentikasi. Dipakai `/settings`.

Request (kirim hanya yang diubah):

```json
{ "nama": "Mei L.", "bahasa": "en" }
```

Respons `200`: objek pengguna seperti `GET /api/me`.

**Email tidak bisa diubah di versi 1.** Kolom email di `/settings` ditampilkan tapi dikunci (read-only), karena mengubahnya butuh alur verifikasi ulang yang tidak masuk jadwal.

### 3.3 `DELETE /api/me/data`

Terautentikasi. Dipakai tombol "Minta hapus data" di `/settings`.

Request, untuk konfirmasi identitas:

```json
{ "password": "kata-sandi-pengguna" }
```

Respons sukses `204`. Efek: akun dan semua data terkait dihapus, sesi dan cookie dihapus, FE berpindah ke `/`. Kata sandi salah: `401 INVALID_CREDENTIALS`.

## 4. Proteksi halaman (server)

| Kelompok | Route | Syarat |
|---|---|---|
| Publik | `/`, `/register`, `/login`, `/forgot-password`, `/verify-otp`, `/reset-password`, `/packages`, `/privacy`, `/terms` | Tidak ada |
| Siswa | `/welcome`, `/dashboard`, `/courses/*`, `/tests/*`, `/results/*`, `/history`, `/settings`, `/checkout`, `/payment-history` | Login. Belum login diarahkan ke `/login` |
| Admin | `/admin/dashboard`, `/admin/*` (kecuali `/admin`) | Login dan `role = ADMIN`. Selain itu ditolak |

## 5. Pemetaan ke database

| Endpoint | Tabel yang berubah |
|---|---|
| `register` | `User` (baru), `Consent` (baru), `Token` tipe `OTP_VERIFIKASI_EMAIL` |
| `verify-otp` (register) | `Token.usedAt`, `User.emailVerified`, `Session` (baru) |
| `verify-otp` (recovery) | `Token` tipe `OTP_RESET_PASSWORD` dipakai, `Token` tipe `TOKEN_RESET_PASSWORD` dibuat |
| `login` | `Session` (baru) |
| `logout` | `Session` dihapus |
| `reset-password` | `User.passwordHash`, semua `Session` pengguna dihapus |
| `PATCH /api/me` | `User.nama`, `User.bahasa` |
| `DELETE /api/me/data` | `User` dihapus, tabel lain ikut lewat cascade |

## 6. Yang diminta dari FE

1. `/verify-otp` harus membawa `email` (query atau state), bukan hanya `localStorage`.
2. `/forgot-password` berpindah ke `/verify-otp` setelah submit.
3. `/reset-password` membawa `resetToken`, dan kolom password diberi atribut `name`.
4. Semua `Field` di `/settings` dan `/reset-password` diberi atribut `name`.
5. `/admin`: ganti label "Username" menjadi "Email", panggil `POST /api/auth/login`, lalu cek `role`.
6. `/settings`: kolom email dikunci, tombol hapus data meminta kata sandi.
7. Dashboard: nama dan avatar dari `GET /api/me`, bukan teks tetap "Mei".
8. Hapus `lib/demo-auth.ts`, kunci `psycourse-demo-session`, dan `psycourse-demo-email` setelah auth jalan.
9. Tombol "Kirim ulang" memanggil `POST /api/auth/resend-otp`.

## 7. Batasan laju (rate limit)

| Aksi | Batas |
|---|---|
| Login gagal | 5 kali per 15 menit per IP/email |
| Salah OTP | 5 kali per OTP, lalu OTP hangus |
| Kirim ulang OTP | 1 kali per 60 detik per email |
| Registrasi dan lupa kata sandi | Dibatasi per IP (angka final ditentukan saat implementasi) |

## 8. Belum diputuskan

- Ukuran batas laju registrasi dan lupa kata sandi.
- Endpoint admin untuk mengelola pengguna dan akses (`/admin/access`): usulan BE1 menyediakan fungsi `requireAdmin()` dan BE4 membuat endpoint-nya.
- Teks email OTP dan pengirim email (SMTP).
