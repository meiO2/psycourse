import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRupiah } from "@/lib/data";
import { PageIntro } from "@/components/UI";

export const instant = false;

export default async function PaymentHistory() {
  await connection();
  const user = await requireUser();
  const payments = await db.payment.findMany({
    where: { userId: user.id },
    include: { package: { select: { nama: true } } },
    orderBy: { createdAt: "desc" },
  });

  return <div className="app-shell"><header className="app-topbar"><div className="container app-topbar-inner"><Link href="/dashboard"><Image src="/psycourse-logo.png" alt="PsyCourse" width={145} height={55}/></Link><Link className="text-link" href="/dashboard">Dashboard →</Link></div></header><main className="app-main"><div className="container"><PageIntro eyebrow="AKUN" title="Riwayat pembayaran" description="Periksa transaksi dan status pembayaran paketmu."/>{payments.length === 0 ? <div className="empty-state"><div className="empty-icon">↗</div><h3>Belum ada transaksi</h3><p>Transaksi yang kamu buat akan muncul di halaman ini.</p><Link className="button button-primary" href="/packages">Lihat paket akses</Link></div> : <section className="panel-card"><div className="table-scroll"><table><thead><tr><th>Paket</th><th>Total</th><th>Status</th><th>Tanggal</th></tr></thead><tbody>{payments.map((payment)=><tr key={payment.id}><td><strong>{payment.package.nama}</strong><small>{payment.orderId}</small></td><td>{formatRupiah(payment.jumlah)}</td><td><span className={`pill ${payment.status === "PAID" ? "" : "yellow"}`}>{payment.status}</span></td><td>{payment.createdAt.toLocaleDateString("id-ID")}</td></tr>)}</tbody></table></div></section>}</div></main></div>;
}
