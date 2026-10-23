export type Category = { slug: string; title: string; subtitle: string; icon: string; color: string; description: string };
export const categories: Category[] = [
  { slug: "logika", title: "Logika & Pola", subtitle: "Kenali pola dan hubungan", icon: "◈", color: "green", description: "Latihan mengenali pola, urutan, dan hubungan logis." },
  { slug: "numerik", title: "Penalaran Numerik", subtitle: "Angka dan perhitungan", icon: "＋", color: "yellow", description: "Asah kemampuan memahami angka dan menyelesaikan masalah numerik." },
  { slug: "verbal", title: "Penalaran Verbal", subtitle: "Bahasa dan pemahaman", icon: "Aa", color: "mint", description: "Uji pemahaman kata, analogi, dan hubungan bahasa." },
  { slug: "spasial", title: "Visual & Spasial", subtitle: "Bentuk dan rotasi", icon: "⬡", color: "peach", description: "Berlatih memvisualisasikan bentuk, arah, dan rotasi." },
  { slug: "memori", title: "Memori & Konsentrasi", subtitle: "Fokus dan ingatan", icon: "◎", color: "lavender", description: "Latihan menjaga fokus dan mengingat informasi." }
];
export const packages = [
  { id: "free", name: "Free Access", price: 0, priceLabel: "Gratis", duration: "Selamanya", featured: false, description: "Coba platform dan kenali format tes.", features: ["Akses Test 1 (untimed)", "Pengenalan kategori dan format soal", "Akses halaman utama dan profil"] },
  { id: "single", name: "Single Test", price: 19000, priceLabel: "Rp19.000", duration: "Satu kali pembelian", featured: false, description: "Coba satu tes premium tanpa berlangganan.", features: ["Akses satu Test 2 bertimer", "Hasil dan skor tes", "Ringkasan performa"] },
  { id: "premium", name: "Premium Access", price: 49000, priceLabel: "Rp49.000", duration: "Akses selama 30 hari", featured: true, description: "Berlatih lebih menyeluruh sebelum mengikuti tes.", features: ["Akses Test 2 bertimer", "Practice question bank dari lima kategori", "Hasil dan riwayat tes selama periode akses", "Pembahasan soal jika fitur tersedia"] }
];
export const sampleQuestions = [
  { question: "Perhatikan urutan berikut: 2, 4, 8, 16, ... Angka berikutnya adalah?", choices: ["18", "24", "32", "36"], answer: 2, explanation: "Setiap angka dikalikan 2, sehingga 16 × 2 = 32." },
  { question: "Jika semua bunga adalah tanaman dan mawar adalah bunga, maka mawar adalah...", choices: ["Hewan", "Tanaman", "Benda mati", "Tidak dapat ditentukan"], answer: 1, explanation: "Mawar termasuk bunga, dan semua bunga termasuk tanaman." },
  { question: "Pilih pasangan yang memiliki hubungan paling mirip: Buku : Membaca", choices: ["Garpu : Makan", "Sepatu : Tidur", "Meja : Berlari", "Pintu : Menulis"], answer: 0, explanation: "Buku digunakan untuk membaca, seperti garpu digunakan untuk makan." },
  { question: "Lanjutkan pola huruf: A, C, E, G, ...", choices: ["H", "I", "J", "K"], answer: 1, explanation: "Pola melompati satu huruf: A, C, E, G, I." },
  { question: "Mana yang berbeda dari kelompok ini?", choices: ["Segitiga", "Persegi", "Lingkaran", "Kubus"], answer: 3, explanation: "Kubus adalah bangun ruang tiga dimensi, sedangkan yang lain bangun datar." }
];
export const formatRupiah = (amount: number) => amount === 0 ? "Gratis" : `Rp${amount.toLocaleString("id-ID")}`;
