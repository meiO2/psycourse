"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import {
  CreditCard,
  ShieldCheck,
  QrCode,
  Landmark,
  Copy,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

import { packages, formatRupiah } from "@/lib/data";
import { Button, PageIntro } from "@/components/UI";

type ActiveCategory = "qris" | "va" | "credit_card";
type VaBank = "bca_va" | "bni_va" | "bri_va" | "mandiri_va" | "permata_va";

interface PaymentInstructionData {
  method: string;
  qrCodeUrl?: string;
  qrString?: string;
  bank?: string;
  vaNumber?: string;
  billerCode?: string;
  billKey?: string;
  redirectUrl?: string;
  maskedCard?: string;
  expiryTime?: string;
}

interface PaymentTransaction {
  paymentId: string;
  orderId: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELED" | "EXPIRED" | string;
  amount: number;
  paymentMethod: string;
  instruction?: PaymentInstructionData;
}

function CheckoutInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const selected =
    packages.find((p) => p.id === params.get("package")) || packages[2];
  const testId = params.get("testId");

  // Selection states
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>("qris");
  const [selectedBank, setSelectedBank] = useState<VaBank>("bca_va");

  // Card form states
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpMonth, setCardExpMonth] = useState("");
  const [cardExpYear, setCardExpYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  // Payment flow states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transaction, setTransaction] = useState<PaymentTransaction | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [vaTab, setVaTab] = useState<"m_banking" | "atm" | "i_banking">("m_banking");
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const pollIntervalRef = useRef<number | null>(null);

  // Polling status pembayaran ketika sedang PENDING
  useEffect(() => {
    if (!transaction || transaction.status !== "PENDING") {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    async function checkStatus() {
      if (!transaction) return;
      try {
        const response = await fetch(
          `/api/payments?paymentId=${encodeURIComponent(transaction.paymentId)}`,
          { cache: "no-store" },
        );
        const result = await response.json();
        if (response.ok && result.data) {
          const nextStatus = result.data.status;
          if (nextStatus !== transaction.status) {
            setTransaction((prev) =>
              prev
                ? {
                    ...prev,
                    status: nextStatus,
                    instruction: result.data.instruction ?? prev.instruction,
                  }
                : null,
            );
          }
        }
      } catch {
        // Abaikan kegagalan jaringan sementara selama polling
      }
    }

    pollIntervalRef.current = window.setInterval(checkStatus, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [transaction]);

  async function handleManualCheckStatus() {
    if (!transaction) return;
    setIsCheckingStatus(true);
    setError("");
    try {
      const response = await fetch(
        `/api/payments?paymentId=${encodeURIComponent(transaction.paymentId)}`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || "Gagal memeriksa status pembayaran.");
      }
      setTransaction((prev) =>
        prev
          ? {
              ...prev,
              status: result.data.status,
              instruction: result.data.instruction ?? prev.instruction,
            }
          : null,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memeriksa status pembayaran.",
      );
    } finally {
      setIsCheckingStatus(false);
    }
  }

  function handleCopy(text: string, key: string) {
    if (navigator?.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  }

  async function handleCreatePayment() {
    setLoading(true);
    setError("");

    try {
      if (!["single", "premium"].includes(selected.id)) {
        throw new Error("Paket ini belum mendukung pembayaran online.");
      }

      if (selected.id === "single" && !testId) {
        throw new Error(
          "ID tes tidak ditemukan. Silakan pilih tes terlebih dahulu.",
        );
      }

      let paymentMethod = "";
      let cardToken: string | undefined = undefined;

      if (activeCategory === "qris") {
        paymentMethod = "qris";
      } else if (activeCategory === "va") {
        paymentMethod = selectedBank;
      } else if (activeCategory === "credit_card") {
        paymentMethod = "credit_card";

        const cleanCard = cardNumber.replace(/\s+/g, "");
        if (cleanCard.length < 13 || cleanCard.length > 19) {
          throw new Error("Nomor kartu kredit/debit tidak valid.");
        }
        if (!cardExpMonth || Number(cardExpMonth) < 1 || Number(cardExpMonth) > 12) {
          throw new Error("Bulan kedaluwarsa kartu harus antara 01 dan 12.");
        }
        if (!cardExpYear || cardExpYear.length < 2) {
          throw new Error("Tahun kedaluwarsa kartu tidak valid.");
        }
        if (!cardCvv || cardCvv.length < 3) {
          throw new Error("Kode CVV kartu tidak valid (3 digit).");
        }

        const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
        if (!clientKey) {
          throw new Error("Kunci klien Midtrans belum dikonfigurasi.");
        }

        // Tokenisasi kartu langsung dari browser ke Midtrans Sandbox API
        // Nomor kartu dan CVV TIDAK PERNAH dikirim ke server PsyCourse!
        const fullYear =
          cardExpYear.length === 2 ? `20${cardExpYear}` : cardExpYear;

        const tokenUrl = new URL("https://api.sandbox.midtrans.com/v2/token");
        tokenUrl.searchParams.set("client_key", clientKey);
        tokenUrl.searchParams.set("card_number", cleanCard);
        tokenUrl.searchParams.set("card_exp_month", cardExpMonth.padStart(2, "0"));
        tokenUrl.searchParams.set("card_exp_year", fullYear);
        tokenUrl.searchParams.set("card_cvv", cardCvv);

        const tokenRes = await fetch(tokenUrl.toString(), { method: "GET" });
        const tokenJson = await tokenRes.json();

        if (tokenJson.status_code !== "200" || !tokenJson.token_id) {
          throw new Error(
            tokenJson.status_message ||
              tokenJson.validation_messages?.[0] ||
              "Gagal melakukan tokenisasi kartu di Midtrans Sandbox.",
          );
        }

        cardToken = tokenJson.token_id;

        // Bersihkan state kartu sensitif di browser
        setCardNumber("");
        setCardCvv("");
      }

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          packageId: selected.id,
          paymentMethod,
          ...(selected.id === "single" ? { testId } : {}),
          ...(cardToken ? { cardToken } : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message ||
            result.message ||
            "Gagal membuat transaksi pembayaran.",
        );
      }

      const paymentData = result.data as PaymentTransaction;
      setTransaction(paymentData);

      // Jika kartu membutuhkan 3DS, buka jendela redirect URL otentikasi
      if (
        paymentMethod === "credit_card" &&
        paymentData.instruction?.redirectUrl
      ) {
        window.open(paymentData.instruction.redirectUrl, "_blank");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memproses pembayaran.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleResetTransaction() {
    setTransaction(null);
    setError("");
  }

  // Format nomor kartu kredit dengan spasi setiap 4 digit
  function handleCardNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
    const formatted = raw.replace(/(\d{4})/g, "$1 ").trim();
    setCardNumber(formatted);
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="container app-topbar-inner">
          <Link href="/dashboard">
            <Image
              src="/psycourse-logo.png"
              alt="PsyCourse"
              width={145}
              height={55}
            />
          </Link>

          <Link className="text-link" href="/packages">
            ← Kembali ke paket
          </Link>
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          <PageIntro
            eyebrow="CHECKOUT RESMI PSYCOURSE"
            title="Selesaikan Pembayaran."
            description="Pilih metode pembayaran aman yang didukung oleh Midtrans Sandbox."
          />

          <div className="two-column">
            {/* KOLOM KIRI: FORM / INSTRUKSI PEMBAYARAN */}
            <section className="panel-card">
              {/* JIKA PEMBAYARAN SUDAH DIBUAT (STATE TRANSAKSI) */}
              {transaction ? (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <h2 style={{ fontSize: 22, margin: 0 }}>Instruksi Pembayaran</h2>
                    <span
                      className={`payment-status-badge ${
                        transaction.status === "PAID"
                          ? "paid"
                          : transaction.status === "PENDING"
                            ? "pending"
                            : "failed"
                      }`}
                    >
                      {transaction.status === "PAID"
                        ? "✓ Pembayaran Berhasil"
                        : transaction.status === "PENDING"
                          ? "⏳ Menunggu Pembayaran"
                          : `Status: ${transaction.status}`}
                    </span>
                  </div>

                  {/* STATUS: BERHASIL (PAID) */}
                  {transaction.status === "PAID" && (
                    <div
                      className="instruction-hero"
                      style={{
                        background: "linear-gradient(135deg, #eafbf0, #f6fff9)",
                        borderColor: "#9be4ba",
                      }}
                    >
                      <CheckCircle2
                        size={52}
                        color="var(--green)"
                        style={{ margin: "0 auto 12px" }}
                      />
                      <h3 style={{ fontSize: 22, margin: "0 0 8px" }}>
                        Pembayaran Berhasil Dikonfirmasi!
                      </h3>
                      <p style={{ color: "var(--muted)", fontSize: 14 }}>
                        Akses paket <strong>{selected.name}</strong> kamu telah aktif.
                        Silakan mulai mengerjakan tes atau buka dashboard.
                      </p>
                      <div
                        className="hero-actions"
                        style={{ justifyContent: "center", marginTop: 20 }}
                      >
                        <Button
                          variant="primary"
                          onClick={() => {
                            startTransition(() => {
                              router.push("/dashboard");
                            });
                          }}
                        >
                          Buka Dashboard →
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            startTransition(() => {
                              router.push("/payment-history");
                            });
                          }}
                        >
                          Lihat Riwayat
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* STATUS: GAGAL / EXPIRED / CANCELED */}
                  {["FAILED", "CANCELED", "EXPIRED"].includes(
                    transaction.status,
                  ) && (
                    <div
                      className="instruction-hero"
                      style={{
                        background: "#fff5f5",
                        borderColor: "#fecaca",
                      }}
                    >
                      <AlertCircle
                        size={48}
                        color="#dc2626"
                        style={{ margin: "0 auto 12px" }}
                      />
                      <h3 style={{ fontSize: 20, color: "#991b1b" }}>
                        Pembayaran{" "}
                        {transaction.status === "EXPIRED"
                          ? "Kedaluwarsa"
                          : transaction.status === "CANCELED"
                            ? "Dibatalkan"
                            : "Gagal"}
                      </h3>
                      <p style={{ color: "var(--muted)", fontSize: 13 }}>
                        Transaksi tidak dapat diselesaikan atau batas waktu telah habis.
                        Kamu dapat membuat transaksi baru dengan metode yang sama atau berbeda.
                      </p>
                      <div style={{ marginTop: 16 }}>
                        <Button
                          variant="primary"
                          onClick={handleResetTransaction}
                        >
                          Coba Lagi
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* STATUS: PENDING (INSTRUKSI PEMBAYARAN) */}
                  {transaction.status === "PENDING" && (
                    <>
                      <div className="notice warning" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <Clock size={18} />
                        <span>
                          Selesaikan pembayaran dalam batas waktu. Halaman ini akan
                          otomatis terkonfirmasi begitu dana diterima server.
                        </span>
                      </div>

                      {/* 1. INSTRUKSI QRIS */}
                      {transaction.paymentMethod === "qris" && (
                        <div style={{ textAlign: "center", margin: "20px 0" }}>
                          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 8 }}>
                            Pindai kode QRIS di bawah ini dengan aplikasi e-wallet atau mobile banking:
                          </p>

                          {transaction.instruction?.qrCodeUrl ? (
                            <div className="qr-code-wrapper">
                              <Image
                                src={transaction.instruction.qrCodeUrl}
                                alt="Midtrans QRIS Code"
                                width={240}
                                height={240}
                                unoptimized
                                style={{ borderRadius: 10 }}
                              />
                            </div>
                          ) : (
                            <div
                              style={{
                                padding: 24,
                                background: "#f8fbf8",
                                borderRadius: 12,
                                border: "1px dashed var(--line)",
                              }}
                            >
                              Kode QRIS siap diproses.
                            </div>
                          )}

                          <div className="instruction-steps" style={{ textAlign: "left", marginTop: 22 }}>
                            <div className="instruction-step">
                              <span className="instruction-step-num">1</span>
                              <div>Buka aplikasi BCA Mobile, GoPay, ShopeePay, Dana, OVO, atau m-Banking pilihanmu.</div>
                            </div>
                            <div className="instruction-step">
                              <span className="instruction-step-num">2</span>
                              <div>Pilih menu <strong>Scan / Bayar QRIS</strong> lalu arahkan kamera ke kode di atas.</div>
                            </div>
                            <div className="instruction-step">
                              <span className="instruction-step-num">3</span>
                              <div>Pastikan merchant bertuliskan <strong>PsyCourse / Midtrans</strong> dan nominal sebesar <strong>{formatRupiah(transaction.amount)}</strong>.</div>
                            </div>
                            <div className="instruction-step">
                              <span className="instruction-step-num">4</span>
                              <div>Konfirmasi pembayaran dengan PIN aplikasi kamu. Status akan langsung diperbarui.</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2. INSTRUKSI VIRTUAL ACCOUNT */}
                      {transaction.paymentMethod.endsWith("_va") && (
                        <div style={{ margin: "20px 0" }}>
                          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
                            Bank Tujuan:
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 12 }}>
                            {transaction.instruction?.bank || "Virtual Account"}
                          </div>

                          {/* Jika Bank Mandiri (E-Channel) */}
                          {transaction.instruction?.billerCode ? (
                            <>
                              <div style={{ marginBottom: 10 }}>
                                <small style={{ color: "var(--muted)" }}>Kode Perusahaan / Biller Code</small>
                                <div className="copy-badge-box">
                                  <code>{transaction.instruction.billerCode}</code>
                                  <button
                                    type="button"
                                    className="button button-outline"
                                    style={{ padding: "6px 12px", fontSize: 12 }}
                                    onClick={() =>
                                      handleCopy(
                                        transaction.instruction?.billerCode || "",
                                        "biller",
                                      )
                                    }
                                  >
                                    <Copy size={13} />
                                    {copiedKey === "biller" ? "Tersalin!" : "Salin"}
                                  </button>
                                </div>
                              </div>

                              <div style={{ marginBottom: 16 }}>
                                <small style={{ color: "var(--muted)" }}>Nomor Tagihan / Bill Key</small>
                                <div className="copy-badge-box">
                                  <code>{transaction.instruction.billKey}</code>
                                  <button
                                    type="button"
                                    className="button button-outline"
                                    style={{ padding: "6px 12px", fontSize: 12 }}
                                    onClick={() =>
                                      handleCopy(
                                        transaction.instruction?.billKey || "",
                                        "billkey",
                                      )
                                    }
                                  >
                                    <Copy size={13} />
                                    {copiedKey === "billkey" ? "Tersalin!" : "Salin"}
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : (
                            /* Bank BCA, BNI, BRI, Permata */
                            <div style={{ marginBottom: 16 }}>
                              <small style={{ color: "var(--muted)" }}>Nomor Virtual Account</small>
                              <div className="copy-badge-box">
                                <code>{transaction.instruction?.vaNumber || "Memuat..."}</code>
                                {transaction.instruction?.vaNumber && (
                                  <button
                                    type="button"
                                    className="button button-outline"
                                    style={{ padding: "6px 12px", fontSize: 12 }}
                                    onClick={() =>
                                      handleCopy(
                                        transaction.instruction?.vaNumber || "",
                                        "va",
                                      )
                                    }
                                  >
                                    <Copy size={13} />
                                    {copiedKey === "va" ? "Tersalin!" : "Salin"}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Tab Panduan Pembayaran VA */}
                          <div className="tab-pills">
                            <button
                              type="button"
                              className={`tab-pill-btn ${vaTab === "m_banking" ? "active" : ""}`}
                              onClick={() => setVaTab("m_banking")}
                            >
                              Mobile Banking
                            </button>
                            <button
                              type="button"
                              className={`tab-pill-btn ${vaTab === "atm" ? "active" : ""}`}
                              onClick={() => setVaTab("atm")}
                            >
                              ATM
                            </button>
                            <button
                              type="button"
                              className={`tab-pill-btn ${vaTab === "i_banking" ? "active" : ""}`}
                              onClick={() => setVaTab("i_banking")}
                            >
                              Internet Banking
                            </button>
                          </div>

                          <div className="instruction-steps">
                            {vaTab === "m_banking" && (
                              <>
                                <div className="instruction-step">
                                  <span className="instruction-step-num">1</span>
                                  <div>Buka aplikasi Mobile Banking bank kamu lalu masuk ke menu <strong>Transfer / Bayar</strong>.</div>
                                </div>
                                <div className="instruction-step">
                                  <span className="instruction-step-num">2</span>
                                  <div>Pilih menu <strong>Virtual Account</strong> atau <strong>Tagihan</strong>.</div>
                                </div>
                                <div className="instruction-step">
                                  <span className="instruction-step-num">3</span>
                                  <div>Masukkan nomor Virtual Account di atas dan pastikan nominal tagihan sesuai.</div>
                                </div>
                                <div className="instruction-step">
                                  <span className="instruction-step-num">4</span>
                                  <div>Konfirmasi transaksi dan masukkan PIN akun mobile banking kamu.</div>
                                </div>
                              </>
                            )}

                            {vaTab === "atm" && (
                              <>
                                <div className="instruction-step">
                                  <span className="instruction-step-num">1</span>
                                  <div>Masukkan kartu ATM dan PIN kamu pada mesin ATM.</div>
                                </div>
                                <div className="instruction-step">
                                  <span className="instruction-step-num">2</span>
                                  <div>Pilih menu <strong>Transaksi Lainnya</strong> → <strong>Transfer</strong> → <strong>Ke Rek Virtual Account</strong>.</div>
                                </div>
                                <div className="instruction-step">
                                  <span className="instruction-step-num">3</span>
                                  <div>Masukkan nomor Virtual Account yang tertera dan periksa rincian pembayaran.</div>
                                </div>
                                <div className="instruction-step">
                                  <span className="instruction-step-num">4</span>
                                  <div>Selesaikan transaksi dan simpan struk pembayaran sebagai bukti.</div>
                                </div>
                              </>
                            )}

                            {vaTab === "i_banking" && (
                              <>
                                <div className="instruction-step">
                                  <span className="instruction-step-num">1</span>
                                  <div>Login ke portal Internet Banking bank kamu.</div>
                                </div>
                                <div className="instruction-step">
                                  <span className="instruction-step-num">2</span>
                                  <div>Pilih menu <strong>Pembayaran / Tagihan</strong> → <strong>Virtual Account</strong>.</div>
                                </div>
                                <div className="instruction-step">
                                  <span className="instruction-step-num">3</span>
                                  <div>Ketik nomor Virtual Account di atas lalu verifikasi token pengamanmu.</div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 3. INSTRUKSI KARTU KREDIT */}
                      {transaction.paymentMethod === "credit_card" && (
                        <div style={{ margin: "20px 0" }}>
                          <p style={{ color: "var(--muted)", fontSize: 13 }}>
                            Transaksi kartu kredit sedang diverifikasi oleh Midtrans Sandbox.
                          </p>

                          {transaction.instruction?.redirectUrl && (
                            <div className="notice warning" style={{ marginTop: 12 }}>
                              <p style={{ margin: "0 0 10px", fontSize: 13 }}>
                                Otentikasi 3D Secure diperlukan untuk menyelesaikan transaksi kartu.
                              </p>
                              <a
                                href={transaction.instruction.redirectUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="button button-primary"
                                style={{ display: "inline-flex" }}
                              >
                                Selesaikan Otentikasi 3DS ↗
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ACTIONS: MANUAL CHECK & CANCEL */}
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          marginTop: 26,
                          paddingTop: 18,
                          borderTop: "1px solid var(--line)",
                        }}
                      >
                        <Button
                          variant="primary"
                          onClick={handleManualCheckStatus}
                          disabled={isCheckingStatus}
                        >
                          <RefreshCw
                            size={14}
                            className={isCheckingStatus ? "spin" : ""}
                          />
                          {isCheckingStatus ? "Memeriksa..." : "Periksa Status Sekarang"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleResetTransaction}
                        >
                          Ganti Metode Pembayaran
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* SEBELUM TRANSAKSI: FORM PEMILIHAN METODE */
                <div>
                  <h2 style={{ fontSize: 21 }}>Pilih Metode Pembayaran</h2>
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>
                    Pilih salah satu metode pembayaran resmi di bawah ini.
                    Semua transaksi terenkripsi dan diproses melalui Midtrans Sandbox.
                  </p>

                  <div className="payment-method-grid">
                    {/* METODE 1: QRIS */}
                    <div
                      className={`payment-card-option ${
                        activeCategory === "qris" ? "selected" : ""
                      }`}
                      onClick={() => setActiveCategory("qris")}
                    >
                      <div className="payment-card-head">
                        <input
                          type="radio"
                          name="payment_cat"
                          checked={activeCategory === "qris"}
                          onChange={() => setActiveCategory("qris")}
                          style={{ accentColor: "var(--green)" }}
                        />
                        <span className="option-icon">
                          <QrCode size={20} />
                        </span>
                        <div>
                          <strong>QRIS (Semua E-Wallet & Mobile Banking)</strong>
                          <br />
                          <small>
                            GoPay, ShopeePay, Dana, OVO, BCA QRIS, Livin&apos;, BRImo, &amp; seluruh aplikasi QRIS
                          </small>
                        </div>
                      </div>
                    </div>

                    {/* METODE 2: VIRTUAL ACCOUNT (TRANSFER BANK) */}
                    <div
                      className={`payment-card-option ${
                        activeCategory === "va" ? "selected" : ""
                      }`}
                      onClick={() => setActiveCategory("va")}
                    >
                      <div className="payment-card-head">
                        <input
                          type="radio"
                          name="payment_cat"
                          checked={activeCategory === "va"}
                          onChange={() => setActiveCategory("va")}
                          style={{ accentColor: "var(--green)" }}
                        />
                        <span className="option-icon">
                          <Landmark size={20} />
                        </span>
                        <div>
                          <strong>Transfer Virtual Account (Bank VA)</strong>
                          <br />
                          <small>
                            Verifikasi otomatis tanpa perlu upload bukti transfer
                          </small>
                        </div>
                      </div>

                      {/* Sub-Pilihan Bank VA */}
                      {activeCategory === "va" && (
                        <div
                          className="va-bank-list"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {[
                            { id: "bca_va", name: "BCA VA" },
                            { id: "bni_va", name: "BNI VA" },
                            { id: "bri_va", name: "BRI VA" },
                            { id: "mandiri_va", name: "Mandiri Bill" },
                            { id: "permata_va", name: "Permata VA" },
                          ].map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              className={`va-bank-item ${
                                selectedBank === b.id ? "active" : ""
                              }`}
                              onClick={() => setSelectedBank(b.id as VaBank)}
                            >
                              <span>◈</span>
                              {b.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* METODE 3: KARTU KREDIT / DEBIT */}
                    <div
                      className={`payment-card-option ${
                        activeCategory === "credit_card" ? "selected" : ""
                      }`}
                      onClick={() => setActiveCategory("credit_card")}
                    >
                      <div className="payment-card-head">
                        <input
                          type="radio"
                          name="payment_cat"
                          checked={activeCategory === "credit_card"}
                          onChange={() => setActiveCategory("credit_card")}
                          style={{ accentColor: "var(--green)" }}
                        />
                        <span className="option-icon">
                          <CreditCard size={20} />
                        </span>
                        <div>
                          <strong>Kartu Kredit / Debit Online</strong>
                          <br />
                          <small>Visa, Mastercard, JCB (3D Secure Sandbox)</small>
                        </div>
                      </div>

                      {/* Form Input Kartu Kredit */}
                      {activeCategory === "credit_card" && (
                        <div
                          className="card-input-grid"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="col-span-2">
                            <label className="field">
                              <span>Nomor Kartu</span>
                              <input
                                type="text"
                                placeholder="4811 1111 1111 1114 (Contoh Sandbox)"
                                value={cardNumber}
                                onChange={handleCardNumberChange}
                                maxLength={19}
                              />
                            </label>
                          </div>
                          <div>
                            <label className="field">
                              <span>Bulan Kedaluwarsa (MM)</span>
                              <input
                                type="text"
                                placeholder="12"
                                value={cardExpMonth}
                                onChange={(e) =>
                                  setCardExpMonth(
                                    e.target.value.replace(/\D/g, "").slice(0, 2),
                                  )
                                }
                                maxLength={2}
                              />
                            </label>
                          </div>
                          <div>
                            <label className="field">
                              <span>Tahun (YY atau YYYY)</span>
                              <input
                                type="text"
                                placeholder="28"
                                value={cardExpYear}
                                onChange={(e) =>
                                  setCardExpYear(
                                    e.target.value.replace(/\D/g, "").slice(0, 4),
                                  )
                                }
                                maxLength={4}
                              />
                            </label>
                          </div>
                          <div className="col-span-2">
                            <label className="field">
                              <span>Kode Keamanan (CVV)</span>
                              <input
                                type="password"
                                placeholder="123"
                                value={cardCvv}
                                onChange={(e) =>
                                  setCardCvv(
                                    e.target.value.replace(/\D/g, "").slice(0, 4),
                                  )
                                }
                                maxLength={4}
                              />
                            </label>
                            <small
                              style={{
                                color: "var(--muted)",
                                fontSize: 11,
                                marginTop: 4,
                                display: "block",
                              }}
                            >
                              🔒 Tokenisasi aman langsung ke Midtrans Sandbox. Nomor kartu tidak disimpan di database.
                            </small>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="notice warning" role="alert" style={{ marginTop: 16 }}>
                      {error}
                    </div>
                  )}

                  <div style={{ marginTop: 14 }}>
                    <Button
                      className="form-submit"
                      onClick={handleCreatePayment}
                      disabled={loading}
                    >
                      {loading ? (
                        "Memproses Pembayaran..."
                      ) : (
                        <>
                          Bayar Sekarang ({formatRupiah(selected.price)}) <ArrowRight size={16} />
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="auth-mini">
                    <span>
                      <ShieldCheck size={18} />
                    </span>
                    Transaksi diproses secara aman oleh Midtrans Core API Sandbox.
                  </div>
                </div>
              )}
            </section>

            {/* KOLOM KANAN: RINGKASAN PESANAN */}
            <aside className="panel-card">
              <h2 style={{ fontSize: 21 }}>Ringkasan Pesanan</h2>

              <div className="list-row">
                <div>
                  <strong>{selected.name}</strong>
                  <small>{selected.duration}</small>
                </div>
                <strong>{formatRupiah(selected.price)}</strong>
              </div>

              {selected.id === "single" && testId && (
                <div className="list-row">
                  <div>
                    <strong>ID Tes Pilihan</strong>
                    <small>Tes Premium Bertimer</small>
                  </div>
                  <span className="pill">{testId}</span>
                </div>
              )}

              <div className="list-row">
                <span style={{ color: "var(--muted)" }}>Subtotal</span>
                <strong>{formatRupiah(selected.price)}</strong>
              </div>

              <div className="list-row">
                <span style={{ color: "var(--muted)" }}>Biaya Layanan</span>
                <strong style={{ color: "var(--green)" }}>Gratis</strong>
              </div>

              <div className="list-row">
                <span style={{ color: "var(--muted)" }}>Total Tagihan</span>
                <strong style={{ fontSize: 20, color: "var(--green-dark)" }}>
                  {formatRupiah(selected.price)}
                </strong>
              </div>

              <div style={{ marginTop: 20 }}>
                <Button
                  href="/payment-history"
                  variant="outline"
                  className="form-submit"
                >
                  Lihat Riwayat Pembayaran
                </Button>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutInner />
    </Suspense>
  );
}
