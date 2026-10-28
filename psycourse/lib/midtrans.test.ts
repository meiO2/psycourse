import "dotenv/config";
import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  isAllowedPaymentMethod,
  verifyMidtransSignature,
} from "@/lib/midtrans";
import {
  mapMidtransStatusToPaymentStatus,
  extractInstructionFromStatus,
} from "@/lib/payment-service";

describe("Midtrans Core API Helper Tests", () => {
  it("harus memvalidasi allowed payment methods dengan benar", () => {
    expect(isAllowedPaymentMethod("qris")).toBe(true);
    expect(isAllowedPaymentMethod("bca_va")).toBe(true);
    expect(isAllowedPaymentMethod("bni_va")).toBe(true);
    expect(isAllowedPaymentMethod("bri_va")).toBe(true);
    expect(isAllowedPaymentMethod("mandiri_va")).toBe(true);
    expect(isAllowedPaymentMethod("permata_va")).toBe(true);
    expect(isAllowedPaymentMethod("credit_card")).toBe(true);

    expect(isAllowedPaymentMethod("shopeepay")).toBe(false);
    expect(isAllowedPaymentMethod("crypto")).toBe(false);
    expect(isAllowedPaymentMethod("")).toBe(false);
    expect(isAllowedPaymentMethod(null)).toBe(false);
  });

  it("harus memetakan status transaksi Midtrans ke status PsyCourse dengan benar", () => {
    expect(mapMidtransStatusToPaymentStatus("settlement")).toBe("PAID");
    expect(mapMidtransStatusToPaymentStatus("capture", "accept")).toBe("PAID");
    expect(mapMidtransStatusToPaymentStatus("capture", "deny")).toBe("FAILED");
    expect(mapMidtransStatusToPaymentStatus("pending")).toBe("PENDING");
    expect(mapMidtransStatusToPaymentStatus("deny")).toBe("FAILED");
    expect(mapMidtransStatusToPaymentStatus("cancel")).toBe("CANCELED");
    expect(mapMidtransStatusToPaymentStatus("expire")).toBe("EXPIRED");
    expect(mapMidtransStatusToPaymentStatus("refund")).toBeNull();
  });

  it("harus memverifikasi signature key Midtrans secara aman", () => {
    const orderId = "PC-ORDER-12345";
    const statusCode = "200";
    const grossAmount = "19000.00";
    const serverKey = process.env.MIDTRANS_SERVER_KEY || "";

    const expectedHash = crypto
      .createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest("hex");

    expect(
      verifyMidtransSignature(orderId, statusCode, grossAmount, expectedHash),
    ).toBe(true);

    expect(
      verifyMidtransSignature(
        orderId,
        statusCode,
        grossAmount,
        "invalid_hash_signature",
      ),
    ).toBe(false);
  });

  it("harus mengekstrak instruksi pembayaran QRIS dari response Midtrans", () => {
    const mockRes = {
      status_code: "201",
      status_message: "Created",
      transaction_id: "tx-123",
      order_id: "order-123",
      gross_amount: "19000.00",
      payment_type: "qris",
      transaction_time: "2026-10-29 10:00:00",
      transaction_status: "pending",
      actions: [
        {
          name: "generate-qr-code",
          method: "GET",
          url: "https://api.sandbox.midtrans.com/v2/qris/123/qr-code",
        },
      ],
      qr_string: "00020101021226590014ID.LINKAJA",
      expiry_time: "2026-10-29 10:15:00",
    };

    const instruction = extractInstructionFromStatus("qris", mockRes);
    expect(instruction).toBeDefined();
    expect(instruction?.qrCodeUrl).toBe(
      "https://api.sandbox.midtrans.com/v2/qris/123/qr-code",
    );
    expect(instruction?.qrString).toBe("00020101021226590014ID.LINKAJA");
    expect(instruction?.expiryTime).toBe("2026-10-29 10:15:00");
  });

  it("harus mengekstrak instruksi pembayaran Virtual Account dari response Midtrans", () => {
    const mockBcaRes = {
      status_code: "201",
      status_message: "Created",
      transaction_id: "tx-456",
      order_id: "order-456",
      gross_amount: "49000.00",
      payment_type: "bank_transfer",
      transaction_time: "2026-10-29 10:00:00",
      transaction_status: "pending",
      va_numbers: [{ bank: "bca", va_number: "9876543210123" }],
      expiry_time: "2026-10-30 10:00:00",
    };

    const instruction = extractInstructionFromStatus("bca_va", mockBcaRes);
    expect(instruction).toBeDefined();
    expect(instruction?.bank).toBe("bca");
    expect(instruction?.vaNumber).toBe("9876543210123");
  });

  it("harus mengekstrak instruksi Mandiri Bill Payment dari response Midtrans", () => {
    const mockMandiriRes = {
      status_code: "201",
      status_message: "Created",
      transaction_id: "tx-789",
      order_id: "order-789",
      gross_amount: "49000.00",
      payment_type: "echannel",
      transaction_time: "2026-10-29 10:00:00",
      transaction_status: "pending",
      biller_code: "70012",
      bill_key: "9988776655",
      expiry_time: "2026-10-30 10:00:00",
    };

    const instruction = extractInstructionFromStatus("mandiri_va", mockMandiriRes);
    expect(instruction).toBeDefined();
    expect(instruction?.billerCode).toBe("70012");
    expect(instruction?.billKey).toBe("9988776655");
  });
});
