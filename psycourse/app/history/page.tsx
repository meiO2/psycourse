import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageIntro } from "@/components/UI";

export const instant = false;

export default async function History() {
  await connection();
  const user = await requireUser();
  const attempts = await db.attempt.findMany({
    where: { userId: user.id, status: { in: ["SELESAI", "KEDALUWARSA"] } },
    include: { test: { include: { category: { select: { judul: true } } } } },
    orderBy: { selesaiPada: "desc" },
  });
  return <div className="app-shell"><header className="app-topbar"><div className="container app-topbar-inner"><Link href="/dashboard"><Image src="/psycourse-logo.png" alt="PsyCourse" width={145} height={55}/></Link><Link className="text-link" href="/dashboard">Dashboard →</Link></div></header><main className="app-main"><div className="container"><PageIntro eyebrow="PROGRES BELAJAR" title="Riwayat tes" description="Semua tes yang telah kamu selesaikan akan dirangkum di sini."/>{attempts.length === 0 ? <div className="empty-state"><div className="empty-icon">◷</div><h3>Belum ada riwayat tes</h3><p>Selesaikan latihan pertamamu untuk mulai melihat riwayat dan skor.</p><Link className="button button-primary" href="/courses/logika">Mulai latihan</Link></div> : <section className="panel-card"><div className="table-scroll"><table><thead><tr><th>Kategori</th><th>Tes</th><th>Skor</th><th>Status</th></tr></thead><tbody>{attempts.map((attempt)=><tr key={attempt.id}><td>{attempt.test.category.judul}</td><td>{attempt.test.tipe}</td><td>{attempt.skor ?? "—"} / {attempt.totalSoal}</td><td>{attempt.status}</td></tr>)}</tbody></table></div></section>}</div></main></div>;
}
