import { coreApi, verifyMidtransSignature } from "@/lib/midtrans";
import { db } from "@/lib/db";
import { apiError, readJson, withErrors } from "@/lib/api";
import {
  mapMidtransStatusToPaymentStatus,
  applyPaymentStatusUpdate,
} from "@/lib/payment-service";

export const GET = async () =>
  Response.json({
    ok: true,
    message: "Endpoint notifikasi pembayaran aktif.",
  });

export const POST = withErrors(async (request: Request) => {
  const notification = await readJson(request);

  if (
    !notification ||
    typeof notification.order_id !== "string" ||
    typeof notification.gross_amount !== "string"
  ) {
    return apiError(
      "INVALID_NOTIFICATION",
      "Payload notifikasi Midtrans tidak lengkap.",
      400,
    );
  }

  // Verifikasi signature key jika ada di payload notifikasi
  if (
    typeof notification.signature_key === "string" &&
    typeof notification.status_code === "string"
  ) {
    const isValidSignature = verifyMidtransSignature(
      notification.order_id,
      notification.status_code,
      notification.gross_amount,
      notification.signature_key,
    );

    if (!isValidSignature) {
      return Response.json(
        { message: "Signature key tidak valid." },
        { status: 403 },
      );
    }
  }

  // Verifikasi status notifikasi langsung ke server Midtrans Core API
  const result = await coreApi.transaction.notification(notification);

  const orderId = result.order_id;
  const amount = Number(result.gross_amount);

  if (typeof orderId !== "string" || !Number.isFinite(amount)) {
    return Response.json(
      { message: "Notifikasi tidak valid." },
      { status: 400 },
    );
  }

  const payment = await db.payment.findUnique({
    where: { orderId },
    include: {
      package: true,
      entitlement: true,
    },
  });

  if (!payment) {
    return Response.json(
      { message: "Pembayaran tidak ditemukan." },
      { status: 404 },
    );
  }

  // Cocokkan nominal dengan data transaksi di database
  if (amount !== payment.jumlah) {
    return Response.json(
      { message: "Nominal pembayaran tidak cocok." },
      { status: 400 },
    );
  }

  const nextStatus = mapMidtransStatusToPaymentStatus(
    result.transaction_status,
    result.fraud_status,
  );

  // Abaikan status yang tidak kita tangani
  if (!nextStatus) {
    return Response.json({ received: true });
  }

  // Terapkan perubahan status dan entitlement secara idempotent dan aman
  await applyPaymentStatusUpdate(payment.id, nextStatus);

  return Response.json({ received: true });
});
