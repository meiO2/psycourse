import { LegalDocumentPage } from "@/components/LegalDocumentPage";
import { termsEn, termsId, updatedAt } from "@/lib/legal-documents";

export default function TermsPage() {
  return (
    <LegalDocumentPage
      type="terms"
      title="Ketentuan Layanan / Terms of Service"
      description="Ketentuan penggunaan situs PsyCourse dan layanan persiapan tes IQ."
      updatedAt={updatedAt}
      draftNotice="Draf — belum siap sebagai dokumen final. Informasi ini disusun dari kondisi prototipe dan bukan nasihat hukum. Sebelum layanan produksi atau pembayaran nyata diaktifkan, pastikan identitas hukum dan alamat pengelola, aturan refund, perlindungan pengguna di bawah umur, serta penyedia layanan sudah ditetapkan dan tinjau dokumen ini dengan penasihat hukum."
      fallbackId={termsId}
      fallbackEn={termsEn}
      otherDocument={{ href: "/privacy", label: "Kebijakan Privasi / Privacy Policy" }}
    />
  );
}
