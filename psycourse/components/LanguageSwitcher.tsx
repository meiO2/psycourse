"use client";
import { useEffect, useSyncExternalStore } from "react";

// Lightweight bilingual UI layer for this frontend prototype. The chosen language is
// persisted locally; production projects should move these strings into next-intl/i18next.
const translations: Record<string, string> = {
"Persiapan tes IQ, dengan cara yang lebih tenang":"IQ test preparation, at a calmer pace",
"Kenali potensimu.":"Discover your potential.", "Tumbuh percaya diri.":"Grow your confidence.",
"Persiapkan dirimu menghadapi tes IQ dengan latihan yang terarah, pengalaman belajar yang nyaman, dan progres yang bisa kamu pantau.":"Prepare for IQ tests with focused practice, a comfortable learning experience, and progress you can track.",
"Mulai Belajar Gratis":"Start Learning for Free", "Kenali PsyCourse":"Discover PsyCourse", "Belajar sesuai ritmemu sendiri":"Learn at your own pace",
"Kenapa PsyCourse?":"Why PsyCourse?", "Persiapan yang terasa lebih terarah.":"A more focused way to prepare.",
"Bangun rasa percaya diri lewat latihan yang terstruktur, bukan tekanan untuk selalu sempurna.":"Build confidence through structured practice, without the pressure to be perfect.",
"Belajar sesuai ritmemu":"Learn at your own pace", "Mulai dari latihan tanpa batas waktu, lalu coba tes bertimer saat kamu sudah siap.":"Start with untimed practice, then try a timed test when you feel ready.",
"Latihan dalam satu tempat":"Practice in one place", "Jelajahi lima kategori soal dan temukan area yang ingin kamu kembangkan.":"Explore five question categories and find the skills you want to develop.",
"Pantau progresmu":"Track your progress", "Lihat hasil dan riwayat latihan untuk membantumu menyusun langkah berikutnya.":"Review your results and practice history to plan your next steps.",
"Kategori tes":"Test categories", "Temukan cara berpikirmu.":"Explore how you think.", "Setiap kategori memberi kesempatan untuk melatih kemampuan yang berbeda.":"Each category gives you a chance to practise a different skill.",
"Cara kerja":"How it works", "Mulai dari langkah sederhana.":"Start with simple steps.", "Buat akunmu":"Create your account", "Daftar dengan email dan siapkan ruang untuk mulai belajar.":"Sign up with your email and make room to start learning.",
"Pilih latihan":"Choose a practice", "Mulai dari Test 1 tanpa timer, atau jelajahi bank soal latihan.":"Start with untimed Test 1 or explore the practice question bank.", "Lihat progres":"Review your progress", "Periksa skor dan riwayat untuk memahami perkembanganmu.":"Review your scores and history to understand your progress.",
"Siap memulai langkah pertamamu?":"Ready to take your first step?", "Mulai gratis dan kenali pengalaman belajar PsyCourse.":"Start for free and explore the PsyCourse learning experience.", "Buat Akun Gratis":"Create a Free Account",
"Fitur":"Features", "Kategori":"Categories", "Paket":"Plans", "Masuk":"Log in", "Mulai Sekarang":"Get Started",
"Kembali ke beranda":"Back to home", "Buat akun":"Create an account", "Isi data berikut untuk memulai perjalanan belajarmu.":"Fill in the details below to begin your learning journey.",
"Nama lengkap":"Full name", "Masukkan nama lengkap":"Enter your full name", "Kata sandi":"Password", "Konfirmasi kata sandi":"Confirm password", "Ulangi kata sandi":"Re-enter password", "Sudah punya akun?":"Already have an account?", "Daftar sekarang":"Sign up now", "Daftar dan lanjutkan":"Sign up and continue",
"Selamat datang kembali":"Welcome back", "Masuk ke akun PsyCourse-mu.":"Log in to your PsyCourse account.", "Email":"Email", "Alamat email":"Email address", "Masukkan kata sandi":"Enter your password", "Tetap masuk":"Remember me", "Lupa kata sandi?":"Forgot password?", "Masuk dengan akun demo":"Continue with demo account", "Belum punya akun?":"Don't have an account?",
"Lupa kata sandi":"Forgot password", "Kami akan mengirimkan kode verifikasi ke emailmu.":"We'll send a verification code to your email.", "Email terdaftar":"Registered email", "Kirim kode verifikasi":"Send verification code", "Ingat kata sandimu?":"Remember your password?",
"Verifikasi email":"Verify your email", "Masukkan enam digit kode OTP yang dikirim ke emailmu.":"Enter the six-digit OTP sent to your email.", "Kode OTP":"OTP code", "Verifikasi kode":"Verify code", "Kirim ulang":"Resend code",
"Akun berhasil dibuat!":"Your account has been created!", "Selamat bergabung di PsyCourse. Sekarang kamu bisa mulai menjelajahi latihan.":"Welcome to PsyCourse. You can now explore the practice activities.", "Masuk ke dashboard":"Go to dashboard",
"DASHBOARD PELAJAR":"STUDENT DASHBOARD", "Halo, selamat datang!":"Hello, welcome!", "Siap meluangkan sedikit waktu untuk mengasah kemampuanmu hari ini?":"Ready to spend a little time sharpening your skills today?", "Mulai latihan":"Start practising", "Lihat website":"View website", "Tes diselesaikan":"Tests completed", "Kategori tersedia":"Available categories", "Rata-rata skor":"Average score", "Akses akun":"Account access", "Jelajahi kategori":"Explore categories", "Lihat semua":"View all", "Riwayat latihan":"Practice history", "Belum ada latihan":"No practice yet", "Hasil tes yang sudah kamu kerjakan akan muncul di sini.":"Your completed test results will appear here.", "Akses cepat":"Quick access", "Paket akses":"Access plans", "Riwayat tes":"Test history", "Pengaturan":"Settings", "Riwayat bayar":"Payment history", "Keluar":"Sign out", "Siap naik level?":"Ready to level up?", "Lihat paket premium":"View premium plans", "Tips hari ini":"Today's tip",
"PILIH AKSES":"CHOOSE ACCESS", "Paket yang sesuai dengan tujuanmu.":"A plan that fits your goals.", "Mulai secara gratis atau buka lebih banyak ruang untuk berlatih.":"Start for free or unlock more room to practise.", "Gratis":"Free", "Selamanya":"Forever", "Satu kali pembelian":"One-time purchase", "Akses selama 30 hari":"30-day access", "Mulai gratis":"Start for free", "Pilih Single Test":"Choose Single Test", "Pilih Premium":"Choose Premium",
"Pengaturan akun":"Account settings", "Kelola informasi, preferensi, dan privasi akunmu.":"Manage your account information, preferences, and privacy.", "Informasi pribadi":"Personal information", "Preferensi":"Preferences", "Privasi & data":"Privacy & data", "Simpan perubahan":"Save changes", "Bahasa antarmuka":"Interface language", "Kebijakan privasi":"Privacy Policy", "Ketentuan layanan":"Terms of Service", "Minta hapus data":"Request data deletion",
"Riwayat pembayaran":"Payment history", "Periksa transaksi dan status pembayaran paketmu.":"Review your transactions and plan payment statuses.", "Belum ada transaksi":"No transactions yet", "Lihat paket akses":"View access plans", "Belum ada riwayat tes":"No test history yet", "Selesaikan latihan pertamamu untuk mulai melihat riwayat dan skor.":"Complete your first practice to start seeing your history and scores.",
"Admin masuk":"Admin login", "Gunakan akun administrator untuk melanjutkan.":"Use an administrator account to continue.", "Masuk ke admin":"Log in to admin", "Dashboard admin":"Admin dashboard", "Kelola platform":"Manage platform", "Kelola kategori":"Manage categories", "Kelola versi tes":"Manage test versions", "Kelola pertanyaan":"Manage questions", "Kontrol akses":"Access control", "Kelola kebijakan":"Manage policies", "Mode prototipe":"Prototype mode",
"Lanjutkan progres yang sudah kamu mulai.":"Continue the progress you've already made.", "Ruang untuk belajar dan berkembang.":"A space to learn and grow.", "Satu langkah kecil tetap berarti.":"Every small step matters.", "Kembali":"Back", "Sebelumnya":"Previous", "Berikutnya":"Next", "Kirim jawaban":"Submit answers", "HASIL LATIHAN":"PRACTICE RESULTS", "Bagus sudah menyelesaikan tes!":"Well done completing the test!", "Terus berlatih":"Keep practising", "Pilih tes":"Choose a test", "Kembali ke dashboard":"Back to dashboard",
"Baca ketentuan layanan":"Read the Terms of Service", "Baca kebijakan privasi":"Read the Privacy Policy", "Selesaikan pilihanmu.":"Complete your selection.", "Metode pembayaran":"Payment method", "Ringkasan pesanan":"Order summary", "Lanjutkan pembayaran demo":"Continue demo payment", "Status pembayaran nyata harus diverifikasi oleh server.":"Real payment status must be verified by the server.",
"Kembali ke paket":"Back to plans", "ADMINISTRATION":"ADMINISTRATION", "Dashboard":"Dashboard", "Overview":"Overview", "Aksi":"Actions", "Tambah data":"Add data", "Edit":"Edit", "Hapus":"Delete", "Buka halaman":"Open page"
};
function translateTree(root: Node, english: boolean) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = []; while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const original = node.textContent || "";
    const trimmed = original.trim();
    if (!trimmed) continue;
    if (english) {
      const replacement = translations[trimmed];
      if (replacement) node.textContent = original.replace(trimmed, replacement);
    } else {
      const entry = Object.entries(translations).find(([, en]) => en === trimmed);
      if (entry) node.textContent = original.replace(trimmed, entry[0]);
    }
  }
}
// Bahasa disimpan di localStorage. useSyncExternalStore membacanya tanpa setState di dalam
// useEffect (aturan react-hooks/set-state-in-effect) dan ikut berubah saat tab lain mengubahnya.
const LANGUAGE_EVENT = "psycourse-language-change";
function subscribeLanguage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(LANGUAGE_EVENT, onChange);
  return () => { window.removeEventListener("storage", onChange); window.removeEventListener(LANGUAGE_EVENT, onChange); };
}
const getEnglish = () => localStorage.getItem("psycourse-language") === "en";
const getEnglishOnServer = () => false;

// Teks halaman diterjemahkan dengan mengubah DOM langsung (di luar React). Kalau itu terjadi
// sebelum React selesai menyambungkan (hydrate) halaman, React menemukan teks yang berbeda dari
// yang ia render ("Features" padahal "Fitur") dan melempar error hydration. Jadi penerjemahan
// pertama ditunda sampai halaman selesai dimuat dan browser idle; setelah itu langsung jalan.
let hydrated = false;
function afterHydration(callback: () => void): () => void {
  if (hydrated) { callback(); return () => {}; }
  let cancelled = false;
  let handle: number | undefined;
  let usedIdle = false;
  const run = () => {
    const fire = () => { if (cancelled) return; hydrated = true; callback(); };
    // Safari belum punya requestIdleCallback, jadi pakai setTimeout sebagai gantinya.
    usedIdle = typeof window.requestIdleCallback === "function";
    handle = usedIdle ? window.requestIdleCallback(fire, { timeout: 1000 }) : window.setTimeout(fire, 300);
  };
  if (document.readyState === "complete") run(); else window.addEventListener("load", run, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", run);
    if (handle !== undefined) { if (usedIdle) window.cancelIdleCallback(handle); else window.clearTimeout(handle); }
  };
}

export default function LanguageSwitcher() {
  const english = useSyncExternalStore(subscribeLanguage, getEnglish, getEnglishOnServer);
  useEffect(() => {
    let observer: MutationObserver | undefined;
    const cancel = afterHydration(() => {
      document.documentElement.lang = english ? "en" : "id";
      translateTree(document.body, english);
      if (!english) return;
      observer = new MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(node => translateTree(node, true)));
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    return () => { cancel(); observer?.disconnect(); };
  }, [english]);
  function toggle() {
    localStorage.setItem("psycourse-language", english ? "id" : "en");
    window.dispatchEvent(new Event(LANGUAGE_EVENT));
  }
  return <button type="button" className="language-switcher" onClick={toggle} aria-label="Switch language">{english ? "🇬🇧 EN" : "🇮🇩 ID"} <span>⌄</span></button>;
}
