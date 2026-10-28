import "server-only";
import { CoreApiChargeResponse } from "midtrans-client";
import { db } from "@/lib/db";
import { coreApi, getStoredPaymentInstruction, PaymentInstruction, AllowedPaymentMethod } from "@/lib/midtrans";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELED" | "EXPIRED";

export function mapMidtransStatusToPaymentStatus(
  transactionStatus: string,
  fraudStatus?: string,
): PaymentStatus | null {
  switch (transactionStatus) {
    case "settlement":
      return "PAID";
    case "capture":
      if (fraudStatus === "accept") return "PAID";
      if (fraudStatus === "deny") return "FAILED";
      return "PENDING";
    case "pending":
      return "PENDING";
    case "deny":
      return "FAILED";
    case "cancel":
      return "CANCELED";
    case "expire":
      return "EXPIRED";
    default:
      return null;
  }
}

/**
 * Menyelesaikan pembayaran secara idempotent dan memberikan entitlement jika status berubah menjadi PAID.
 */
export async function applyPaymentStatusUpdate(
  paymentId: string,
  nextStatus: PaymentStatus,
) {
  return await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        package: true,
        entitlement: true,
      },
    });

    if (!payment) {
      throw new Error("Pembayaran tidak ditemukan.");
    }

    // Status PAID bersifat final, tidak boleh diubah lagi
    if (payment.status === "PAID") {
      return payment;
    }

    // Status terminal lain tidak boleh diturunkan kembali ke PENDING
    if (
      (payment.status === "FAILED" ||
        payment.status === "CANCELED" ||
        payment.status === "EXPIRED") &&
      nextStatus === "PENDING"
    ) {
      return payment;
    }

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        ...(nextStatus === "PAID" ? { paidAt: new Date() } : {}),
      },
      include: {
        package: true,
        entitlement: true,
      },
    });

    // Jika pembayaran berhasil dan belum ada entitlement, buat entitlement
    if (nextStatus === "PAID" && !updated.entitlement) {
      const startedAt = new Date();
      const duration = updated.package.durasiHari;
      const expiresAt =
        duration != null
          ? new Date(startedAt.getTime() + duration * 24 * 60 * 60 * 1000)
          : null;

      await tx.entitlement.create({
        data: {
          userId: updated.userId,
          packageId: updated.packageId,
          paymentId: updated.id,
          testId: updated.testId,
          mulai: startedAt,
          berakhir: expiresAt,
        },
      });
    }

    return updated;
  });
}

/**
 * Memeriksa status transaksi ke Midtrans dan menyinkronkan status pembayaran di DB jika perlu.
 */
export async function syncPaymentStatus(orderId: string, currentPaymentId: string) {
  try {
    const midtransRes = await coreApi.transaction.status(orderId);
    const targetStatus = mapMidtransStatusToPaymentStatus(
      midtransRes.transaction_status,
      midtransRes.fraud_status,
    );

    if (targetStatus) {
      await applyPaymentStatusUpdate(currentPaymentId, targetStatus);
    }

    return {
      midtransStatus: midtransRes.transaction_status,
      targetStatus,
      raw: midtransRes,
    };
  } catch {
    // Jika koneksi ke Midtrans gagal, tetap gunakan status lokal
    return null;
  }
}

/**
 * Mengambil instruksi pembayaran baik dari cache memory maupun dari status respons Midtrans.
 */
export function extractInstructionFromStatus(
  method: AllowedPaymentMethod,
  statusRes?: CoreApiChargeResponse | null,
  fallbackOrderId?: string,
): PaymentInstruction | undefined {
  if (fallbackOrderId) {
    const cached = getStoredPaymentInstruction(fallbackOrderId);
    if (cached) return cached;
  }

  if (!statusRes) return undefined;

  const instruction: PaymentInstruction = {
    method,
    expiryTime: statusRes.expiry_time,
  };

  if (method === "qris") {
    const qrAction = statusRes.actions?.find(
      (a) => a.name === "generate-qr-code",
    );
    instruction.qrCodeUrl = qrAction?.url;
    instruction.qrString = statusRes.qr_string;
  } else if (["bca_va", "bni_va", "bri_va"].includes(method)) {
    const vaItem = statusRes.va_numbers?.[0];
    instruction.bank = vaItem?.bank ?? method.replace("_va", "").toUpperCase();
    instruction.vaNumber = vaItem?.va_number;
  } else if (method === "permata_va") {
    instruction.bank = "PERMATA";
    instruction.vaNumber = statusRes.permata_va_number ?? statusRes.va_numbers?.[0]?.va_number;
  } else if (method === "mandiri_va") {
    instruction.bank = "MANDIRI";
    instruction.billerCode = statusRes.biller_code;
    instruction.billKey = statusRes.bill_key;
  } else if (method === "credit_card") {
    instruction.redirectUrl = statusRes.redirect_url;
    instruction.maskedCard = statusRes.masked_card;
    instruction.bank = statusRes.bank;
  }

  return instruction;
}
