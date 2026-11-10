
    "use client";

    import Link from "next/link";
    import { useState, type ReactNode } from "react";
    import { LockKeyhole, X } from "lucide-react";

    export default function PaywallNoticeButton({
    href,
    children = "Buka akses",
    }: {
    href: string;
    children?: ReactNode;
    }) {
    const [showNotice, setShowNotice] = useState(false);

    return (
        <>
        <button
            type="button"
            className="button button-outline"
            onClick={() => setShowNotice(true)}
        >
            <LockKeyhole size={15} /> {children}
        </button>

        {showNotice && (
            <div
            role="status"
            aria-live="polite"
            style={{
                position: "fixed",
                right: 24,
                bottom: 24,
                zIndex: 1000,
                width: "min(420px, calc(100vw - 32px))",
                padding: 20,
                borderRadius: 16,
                background: "#ffffff",
                border: "1px solid #dce8df",
                boxShadow: "0 12px 40px rgba(20, 50, 30, 0.16)",
                color: "#17251d",
            }}
            >
            <button
                type="button"
                aria-label="Tutup notifikasi"
                onClick={() => setShowNotice(false)}
                style={{
                position: "absolute",
                top: 12,
                right: 12,
                border: 0,
                background: "transparent",
                cursor: "pointer",
                color: "#66736b",
                }}
            >
                <X size={18} />
            </button>

            <strong style={{ display: "block", marginBottom: 6 }}>
                Kamu masih menggunakan akun Free
            </strong>

            <p style={{
                margin: "0 0 14px",
                color: "#66736b",
                fontSize: 14,
                lineHeight: 1.5
            }}>
                Konten ini hanya tersedia untuk pengguna dengan
                akses berbayar. Pilih paket untuk membuka latihan ini.
            </p>

            <Link
                href={href}
                className="button button-primary"
                style={{ display: "inline-flex", textDecoration: "none" }}
            >
                Lihat paket akses
            </Link>
            </div>
        )}
        </>
    );
    }
