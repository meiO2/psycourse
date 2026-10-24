import Link from "next/link";
import { ReactNode } from "react";
export function Button({ children, href, variant = "primary", type = "button", onClick, className = "", disabled = false }: { children: ReactNode; href?: string; variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"; type?: "button" | "submit" | "reset"; onClick?: () => void; className?: string; disabled?: boolean }) {
  const cls = `button button-${variant} ${className}`;
  return href ? <Link className={cls} href={href}>{children}</Link> : <button className={cls} type={type} onClick={onClick} disabled={disabled}>{children}</button>;
}
export function SectionHeading({ eyebrow, title, description, center = false }: { eyebrow?: string; title: string; description?: string; center?: boolean }) {
  return <div className={`section-heading ${center ? "center" : ""}`}>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2>{description && <p>{description}</p>}</div>;
}
export function PageIntro({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <div className="page-intro">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>;
}
export function Field({ label, type = "text", placeholder, required = true, name }: { label: string; type?: string; placeholder?: string; required?: boolean; name?: string }) {
  return <label className="field"><span>{label}</span><input name={name} type={type} placeholder={placeholder} required={required} /></label>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">✦</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}
