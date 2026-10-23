import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "PsyCourse — Persiapan Tes IQ", description: "Platform belajar dan latihan tes IQ online dengan suasana yang tenang dan terarah." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
