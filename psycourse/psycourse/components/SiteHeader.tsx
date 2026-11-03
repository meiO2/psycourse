 "use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="site-header"><div className="container nav-wrap">
    <Link href="/" className="brand" aria-label="PsyCourse beranda"><Image src="/psycourse-logo.png" alt="PsyCourse" width={174} height={64} priority /></Link>
    <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Buka navigasi">{open ? <X /> : <Menu />}</button>
    <nav className={open ? "nav-links nav-open" : "nav-links"}>
      <Link href="/#features" onClick={() => setOpen(false)}>Fitur</Link><Link href="/#categories" onClick={() => setOpen(false)}>Kategori</Link><Link href="/packages" onClick={() => setOpen(false)}>Paket</Link>
      <Link className="nav-login" href="/login">Masuk</Link><Link className="button button-primary nav-cta" href="/register">Mulai Sekarang <span>↗</span></Link>
    </nav>
  </div></header>;
}
