import Image from "next/image";
import Link from "next/link";
import { cacheLife } from "next/cache";

// Dengan cacheComponents aktif, new Date() langsung di komponen membuat route "Blocking Route".
// Tahun di-cache (cukup diperbarui per hari) supaya footer tetap bisa di-prerender.
async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export default function SiteFooter() {
  return <footer className="site-footer"><div className="container footer-grid"><div><Image src="/psycourse-logo.png" alt="PsyCourse" width={150} height={55} /><p>Temani persiapan tes IQ-mu, satu langkah kecil setiap hari.</p></div><div><strong>Jelajahi</strong><Link href="/#features">Fitur</Link><Link href="/#categories">Kategori tes</Link><Link href="/packages">Paket akses</Link></div><div><strong>Bantuan & legal</strong><Link href="/terms">Ketentuan layanan</Link><Link href="/privacy">Kebijakan privasi</Link><Link href="/settings">Pengaturan akun</Link></div></div><div className="container footer-bottom"><span>© <CurrentYear /> PsyCourse</span><span>Belajar dengan tenang. Bertumbuh dengan percaya diri.</span></div></footer>;
}
