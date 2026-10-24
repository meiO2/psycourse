import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

// Pemeriksaan AWAL saja: ada atau tidaknya cookie sesi. Proxy tidak membuka database dan
// tidak memeriksa peran, jadi cookie palsu atau kedaluwarsa tetap lolos sampai sini.
// Keamanan sebenarnya ada di tiap endpoint (requireUser / requireAdmin) dan di halaman
// yang membaca /api/me, yang membuang pengguna tanpa sesi valid ke /login.
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const isAdminArea = request.nextUrl.pathname.startsWith("/admin");
  return NextResponse.redirect(new URL(isAdminArea ? "/admin" : "/login", request.url));
}

export const config = {
  matcher: [
    "/welcome",
    "/dashboard/:path*",
    "/courses/:path*",
    "/tests/:path*",
    "/results/:path*",
    "/history",
    "/settings",
    "/checkout",
    "/payment-history",
    "/admin/:path+", // semua halaman admin kecuali /admin (halaman login admin)
  ],
};
