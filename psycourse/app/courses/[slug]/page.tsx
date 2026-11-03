import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Clock, BookOpen, Brain, LockKeyhole, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { categories } from "@/lib/data";
import { Button, PageIntro } from "@/components/UI";

export const instant = false;

export function generateStaticParams() { return categories.map((c) => ({ slug: c.slug })); }

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();
  const user = await requireUser();
  const [tests, entitlements] = await Promise.all([
    db.test.findMany({ where: { category: { slug }, status: "AKTIF" }, select: { id: true, slug: true, tipe: true } }),
    db.entitlement.findMany({ where: { userId: user.id, OR: [{ berakhir: null }, { berakhir: { gt: new Date() } }] }, select: { packageId: true, testId: true } }),
  ]);
  const test2 = tests.find((test) => test.tipe === "TEST_2");
  const hasPremium = entitlements.some((item) => item.packageId === "premium");
  const hasSingle = test2 ? entitlements.some((item) => item.packageId === "single" && item.testId === test2.id) : false;
  const canUseTest2 = hasPremium || hasSingle;
  const test2Href = canUseTest2 ? `/tests/${test2?.slug ?? `${slug}-test-2`}` : `/packages?testId=${encodeURIComponent(test2?.slug ?? `${slug}-test-2`)}`;
  return <div className="app-shell"><header className="app-topbar"><div className="container app-topbar-inner"><Link href="/dashboard"><Image src="/psycourse-logo.png" alt="PsyCourse" width={145} height={55}/></Link><Link className="text-link" href="/dashboard"><ArrowLeft size={14} style={{verticalAlign:"middle"}}/> Dashboard</Link></div></header><main className="app-main"><div className="container"><div className="course-hero"><div><span className="eyebrow">KATEGORI TES</span><h1>{category.title}</h1><p>{category.description} Pilih jenis latihan yang paling sesuai dengan kebutuhanmu saat ini.</p></div><div className="course-hero-symbol">{category.icon}</div></div><PageIntro eyebrow="Pilih pengalaman" title="Mulai dari mana hari ini?" description="Akses tes premium aktif otomatis setelah pembayaran terkonfirmasi."/><div className="test-option"><div className="test-option-left"><span className="option-icon"><BookOpen/></span><div><h3>Test 1 — Tes tanpa timer</h3><p>10 soal · Satu percobaan resmi</p></div></div><div className="option-actions"><span className="pill">Free</span><Button href={`/tests/${slug}-test-1`}>Mulai tes <ArrowUpRight size={15}/></Button></div></div><div className="test-option"><div className="test-option-left"><span className="option-icon" style={{background:"#fff4c9",color:"#7e6100"}}><Clock/></span><div><h3>Test 2 — Tes bertimer</h3><p>10 soal · Timer aktif · {canUseTest2 ? "Akses aktif" : "Memerlukan paket premium"}</p></div></div><div className="option-actions">{canUseTest2 ? <span className="pill">Aktif</span> : <span className="pill yellow">Premium</span>}<Button href={test2Href} variant={canUseTest2 ? "primary" : "outline"}>{canUseTest2 ? "Mulai tes" : <><LockKeyhole size={15}/> Buka akses</>}</Button></div></div><div className="test-option"><div className="test-option-left"><span className="option-icon" style={{background:"#f0eaff",color:"#6c48bc"}}><Brain/></span><div><h3>Practice Question Bank</h3><p>Latihan berulang dari lima kategori</p></div></div><div className="option-actions">{hasPremium ? <span className="pill">Aktif</span> : <span className="pill yellow">Premium</span>}<Button href={hasPremium ? `/tests/${slug}-practice` : "/packages"} variant="outline">{hasPremium ? "Mulai latihan" : <><LockKeyhole size={15}/> Buka akses</>}</Button></div></div><section className="panel-card" style={{marginTop:24}}><div className="panel-head"><h2>Akses tersimpan di akun</h2><CheckCircle2 color="#0EBB5A"/></div><p style={{color:"var(--muted)",fontSize:13}}>Pembelian yang berstatus PAID otomatis membuat entitlement di database dan dapat digunakan selama masa aktif paket.</p></section></div></main></div>;
}
