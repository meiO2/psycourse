import { LegalDocumentPage } from "@/components/LegalDocumentPage";
import { privacyEn, privacyId, updatedAt } from "@/lib/legal-documents";

export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      type="privacy"
      title="Kebijakan Privasi / Privacy Policy"
      description="Berlaku untuk penggunaan situs PsyCourse dan layanan persiapan tes IQ."
      updatedAt={updatedAt}
      draftNotice="Draf — belum siap sebagai dokumen final. Informasi ini disusun dari kondisi prototipe dan bukan nasihat hukum. Sebelum publikasi final, lengkapi bentuk badan hukum dan alamat pengelola, daftar penyedia serta lokasi pemrosesan, jadwal retensi, dan mekanisme perlindungan pengguna di bawah umur. Tinjau kebijakan ini dengan penasihat hukum."
      fallbackId={privacyId}
      fallbackEn={privacyEn}
      otherDocument={{ href: "/terms", label: "Ketentuan Layanan / Terms of Service" }}
    />
  );
}
