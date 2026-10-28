import { randomUUID } from "node:crypto";
import { CoreApiChargeResponse } from "midtrans-client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, readJson, withErrors } from "@/lib/api";
import {
  chargeCoreTransaction,
  isAllowedPaymentMethod,
  AllowedPaymentMethod,
} from "@/lib/midtrans";
import {
  applyPaymentStatusUpdate,
  syncPaymentStatus,
  extractInstructionFromStatus,
} from "@/lib/payment-service";

export const POST = withErrors(async (request: Request) => {
  const user = await requireUser();
  const body = await readJson(request);

  if (!body) {
    return apiError("VALIDATION_ERROR", "Body request tidak valid.", 400);
  }

  const packageId = body.packageId;
  const testId = body.testId;
  const paymentMethod = body.paymentMethod;
  const cardToken = body.cardToken;
  const authenticationId = body.authenticationId;

  if (
    typeof packageId !== "string" ||
    !["single", "premium"].includes(packageId)
  ) {
    return apiError(
      "VALIDATION_ERROR",
      "Pilih paket pembayaran yang valid.",
      400,
    );
  }

  if (!isAllowedPaymentMethod(paymentMethod)) {
    return apiError(
      "VALIDATION_ERROR",
      "Metode pembayaran tidak valid atau tidak didukung di Midtrans Sandbox.",
      400,
    );
  }

  if (paymentMethod === "credit_card" && (typeof cardToken !== "string" || !cardToken)) {
    return apiError(
      "VALIDATION_ERROR",
      "Token kartu diperlukan untuk pembayaran kartu kredit/debit.",
      400,
    );
  }

  if (packageId === "single" && typeof testId !== "string") {
    return apiError("VALIDATION_ERROR", "Pilih tes yang ingin dibeli.", 400);
  }

  if (packageId === "premium" && testId !== undefined) {
    return apiError(
      "VALIDATION_ERROR",
      "Paket premium tidak memerlukan testId.",
      400,
    );
  }

  const selectedPackage = await db.package.findFirst({
    where: {
      id: packageId,
      aktif: true,
    },
  });

  if (!selectedPackage) {
    return apiError(
      "PACKAGE_NOT_FOUND",
      "Paket tidak ditemukan atau tidak aktif.",
      604,
    );
  }

  let selectedTest: { id: string } | null = null;
  if (packageId === "single") {
    selectedTest = await db.test.findFirst({
      where: {
        OR: [{ id: testId as string }, { slug: testId as string }],
        tipe: "TEST_2",
        status: "AKTIF",
      },
      select: { id: true },
    });

    if (!selectedTest) {
      return apiError(
        "TEST_NOT_FOUND",
        "Tes tidak ditemukan atau tidak tersedia untuk dibeli.",
        404,
      );
    }
  }

  if (
    !Number.isSafeInteger(selectedPackage.harga) ||
    selectedPackage.harga <= 0
  ) {
    return apiError("INVALID_PACKAGE_PRICE", "Harga paket belum valid.", 400);
  }

  const orderId = `PC-${randomUUID()}`;

  // Harga selalu diambil dari database, bukan dari input browser.
  const payment = await db.payment.create({
    data: {
      userId: user.id,
      packageId: selectedPackage.id,
      testId: packageId === "single" ? selectedTest?.id ?? null : null,
      orderId,
      jumlah: selectedPackage.harga,
      metode: paymentMethod,
      status: "PENDING",
    },
  });

  try {
    const { raw, instruction } = await chargeCoreTransaction({
      orderId: payment.orderId,
      amount: payment.jumlah,
      paymentMethod,
      customer: {
        firstName: user.nama || "User",
        email: user.email,
      },
      item: {
        id: selectedPackage.id,
        name: selectedPackage.nama,
        price: payment.jumlah,
      },
      creditCard:
        paymentMethod === "credit_card"
          ? {
              tokenId: cardToken as string,
              authenticationId:
                typeof authenticationId === "string" ? authenticationId : undefined,
            }
          : undefined,
    });

    // Tangani status awal kartu kredit jika langsung settlement / deny
    if (raw.transaction_status === "capture" && raw.fraud_status === "accept") {
      await applyPaymentStatusUpdate(payment.id, "PAID");
    } else if (raw.transaction_status === "deny") {
      await applyPaymentStatusUpdate(payment.id, "FAILED");
    }

    return Response.json(
      {
        data: {
          paymentId: payment.id,
          orderId: payment.orderId,
          status: payment.status,
          amount: payment.jumlah,
          paymentMethod,
          instruction,
          rawStatus: raw.transaction_status,
        },
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    // Jika panggilan Core API gagal, tandai transaksi FAILED agar tidak menggantung sebagai PENDING palsu
    await db.payment
      .update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      })
      .catch(() => null);

    const errorMessage =
      err instanceof Error ? err.message : "Gagal memproses pembayaran melalui Core API.";

    return apiError("CORE_API_ERROR", errorMessage, 502);
  }
});

export const GET = withErrors(async (request: Request) => {
  const user = await requireUser();
  const paymentId = new URL(request.url).searchParams.get("paymentId");

  if (!paymentId) {
    return apiError("VALIDATION_ERROR", "ID pembayaran wajib diisi.", 400);
  }

  const payment = await db.payment.findFirst({
    where: { id: paymentId, userId: user.id },
    select: {
      id: true,
      orderId: true,
      status: true,
      jumlah: true,
      metode: true,
      createdAt: true,
      package: { select: { nama: true } },
    },
  });

  if (!payment) {
    return apiError("PAYMENT_NOT_FOUND", "Pembayaran tidak ditemukan.", 404);
  }

  let currentStatus = payment.status;
  let statusResult: CoreApiChargeResponse | null = null;

  // Jika status masih PENDING, sinkronkan dengan status realtime Midtrans
  if (currentStatus === "PENDING") {
    const syncRes = await syncPaymentStatus(payment.orderId, payment.id);
    if (syncRes?.targetStatus) {
      currentStatus = syncRes.targetStatus;
      statusResult = syncRes.raw;
    }
  }

  const method = payment.metode as AllowedPaymentMethod;
  const instruction = extractInstructionFromStatus(
    method,
    statusResult,
    payment.orderId,
  );

  return Response.json({
    data: {
      id: payment.id,
      orderId: payment.orderId,
      status: currentStatus,
      jumlah: payment.jumlah,
      metode: payment.metode,
      createdAt: payment.createdAt,
      package: payment.package,
      instruction,
    },
  });
});
