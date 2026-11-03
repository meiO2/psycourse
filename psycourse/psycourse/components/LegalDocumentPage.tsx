"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageIntro } from "@/components/UI";

type Section = { title: string; body: string };
type PublishedPolicy = { version: string; id: string; en: string; publishedAt: string | null };

type LegalDocumentPageProps = {
  type: "terms" | "privacy";
  title: string;
  description: string;
  updatedAt: string;
  draftNotice: string;
  fallbackId: Section[];
  fallbackEn: Section[];
  otherDocument: { href: string; label: string };
};

export function LegalDocumentPage({
  type,
  title,
  description,
  updatedAt,
  draftNotice,
  fallbackId,
  fallbackEn,
  otherDocument,
}: LegalDocumentPageProps) {
  const [published, setPublished] = useState<PublishedPolicy | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadPublishedPolicy() {
      try {
        const response = await fetch(`/api/legal/${type}`, { cache: "no-store" });
        const result: PublishedPolicy & { error?: { code?: string; message?: string } } = await response.json();
        if (!response.ok) {
          if (response.status !== 404 || result.error?.code !== "POLICY_NOT_PUBLISHED") {
            throw new Error(result.error?.message || "Gagal memuat dokumen hukum terbaru.");
          }
          return;
        }
        if (active) setPublished(result);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Gagal memuat dokumen hukum terbaru.");
      }
    }

    void loadPublishedPolicy();
    return () => {
      active = false;
    };
  }, [type]);

  const publishedDate = published?.publishedAt
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(published.publishedAt))
    : null;

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="container app-topbar-inner">
          <Link href="/" aria-label="PsyCourse home">
            <Image src="/psycourse-logo.png" alt="PsyCourse" width={145} height={55} />
          </Link>
          <Link href="/register" className="button button-primary">
            Buat akun / Create account
          </Link>
        </div>
      </header>
      <main className="app-main">
        <div className="container legal-copy">
          <PageIntro eyebrow="LEGAL / HUKUM" title={title} description={description} />
          {loadError && <div className="notice warning" role="alert">{loadError} Menampilkan salinan dokumen yang tersedia.</div>}
          {published ? (
            <>
              <p>
                <strong>Versi:</strong> {published.version}
                {publishedDate && <> · <strong>Diterbitkan:</strong> {publishedDate}</>}
              </p>
              <h2>Versi Bahasa Indonesia</h2>
              {published.id.split(/\r?\n(?:[ \t]*\r?\n)+/).filter(Boolean).map((paragraph, index) => (
                <p key={`id-${index}-${paragraph.slice(0, 24)}`} style={{ whiteSpace: "pre-wrap" }}>{paragraph}</p>
              ))}
              <h2>English version</h2>
              {published.en.split(/\r?\n(?:[ \t]*\r?\n)+/).filter(Boolean).map((paragraph, index) => (
                <p key={`en-${index}-${paragraph.slice(0, 24)}`} style={{ whiteSpace: "pre-wrap" }}>{paragraph}</p>
              ))}
            </>
          ) : (
            <>
              <div className="notice warning">{draftNotice}</div>
              <h2>Versi Bahasa Indonesia</h2>
              <p><strong>Terakhir diperbarui:</strong> {updatedAt}</p>
              {fallbackId.map((section) => (
                <section key={section.title}>
                  <h2>{section.title}</h2>
                  <p>{section.body}</p>
                </section>
              ))}
              <h2>English version</h2>
              <p><strong>Last updated:</strong> {updatedAt}</p>
              {fallbackEn.map((section) => (
                <section key={section.title}>
                  <h2>{section.title}</h2>
                  <p>{section.body}</p>
                </section>
              ))}
            </>
          )}
          <p>
            <Link href={otherDocument.href}>{otherDocument.label} →</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
