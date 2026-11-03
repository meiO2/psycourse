import { withErrors } from "@/lib/api";
import { destroySession } from "@/lib/auth";

// Aman dipanggil tanpa login (idempotent): hasilnya tetap 204.
export const POST = withErrors(async () => {
  await destroySession();
  return new Response(null, { status: 204 });
});
