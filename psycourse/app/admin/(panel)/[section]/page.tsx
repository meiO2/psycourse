import { notFound } from "next/navigation";
import AdminSectionView, { adminSections } from "./section-view";

export default async function AdminSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!adminSections.includes(section)) notFound();
  return <AdminSectionView section={section} />;
}
