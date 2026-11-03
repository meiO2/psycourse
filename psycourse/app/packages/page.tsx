"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { packages, formatRupiah } from "@/lib/data";
import { Button, PageIntro } from "@/components/UI";

function PackagesContent() {
  const params = useSearchParams();
  const testId = params.get("testId");

  return <div className="app-shell"><header className="app-topbar"><div className="container app-topbar-inner"><Link href="/"><Image src="/psycourse-logo.png" alt="PsyCourse" width={145} height={55}/></Link><Link className="text-link" href="/dashboard">Dashboard →</Link></div></header><main className="app-main"><div className="container"><PageIntro eyebrow="PILIH AKSES" title="Paket yang sesuai dengan tujuanmu." description="Mulai secara gratis atau buka lebih banyak ruang untuk berlatih. Harga berikut mengikuti rancangan awal pada dokumen produk dan masih berupa rekomendasi."/><div className="pricing-grid">{packages.map(p=>{const checkoutParams=new URLSearchParams({package:p.id});if(testId)checkoutParams.set("testId",testId);const isSingleWithoutTest=p.id==="single"&&!testId;const href=p.price===0?"/dashboard":isSingleWithoutTest?"/dashboard":`/checkout?${checkoutParams.toString()}`;return <article className={`package-card ${p.featured?"featured":""}`} key={p.id}>{p.featured&&<span className="recommended">REKOMENDASI UTAMA</span>}<h2>{p.name}</h2><div className="package-price">{formatRupiah(p.price)}</div><div className="package-duration">{p.duration}</div><p className="package-desc">{p.description}</p><ul className="package-features">{p.features.map(f=><li key={f}>{f}</li>)}</ul><Button href={href} variant={p.featured?"primary":"outline"}>{p.price===0?"Mulai gratis":isSingleWithoutTest?"Pilih tes terlebih dahulu":p.id==="single"?"Pilih Single Test":"Pilih Premium"} <span>→</span></Button></article>})}</div><p style={{color:"var(--muted)",fontSize:12,marginTop:24}}>Catatan: transaksi di situs ini belum diproses. Integrasikan Midtrans Sandbox di sisi server sebelum menerima pembayaran.</p></div></main></div>;
}

export default function PackagesPage() {
  return <Suspense><PackagesContent /></Suspense>;
}
