import "server-only";
import crypto from "node:crypto";
import midtransClient from "midtrans-client";

const serverKey = process.env.MIDTRANS_SERVER_KEY;
const clientKey =
  process.env.MIDTRANS_CLIENT_KEY ??
  process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
const isProduction = process.env.MIDTRANS_IS_PRODUCTION;

if (!serverKey || !clientKey) {
  throw new Error("Konfigurasi Midtrans belum lengkap.");
}

if (isProduction !== "false") {
  throw new Error("PsyCourse harus menggunakan Midtrans Sandbox.");
}

export const coreApi = new midtransClient.CoreApi({
  isProduction: false,
  serverKey,
  clientKey,
});

export const ALLOWED_PAYMENT_METHODS = [
  "qris",
  "bca_va",
  "bni_va",
  "bri_va",
  "mandiri_va",
  "permata_va",
  "credit_card",
] as const;

export type AllowedPaymentMethod = (typeof ALLOWED_PAYMENT_METHODS)[number];

export function isAllowedPaymentMethod(
  method: unknown,
): method is AllowedPaymentMethod {
  return (
    typeof method === "string" &&
    (ALLOWED_PAYMENT_METHODS as readonly string[]).includes(method)
  );
}

export interface PaymentInstruction {
  method: AllowedPaymentMethod;
  qrCodeUrl?: string;
  qrString?: string;
  bank?: string;
  vaNumber?: string;
  billerCode?: string;
  billKey?: string;
  redirectUrl?: string;
  maskedCard?: string;
  expiryTime?: string;
}

// In-memory cache untuk instruksi pembayaran agar checkout UI
// tetap dapat menampilkan QR URL atau VA number saat polling status
const instructionCache = new Map<string, PaymentInstruction>();

export function storePaymentInstruction(
  orderId: string,
  instruction: PaymentInstruction,
) {
  instructionCache.set(orderId, instruction);
  // Bersihkan cache setelah 24 jam untuk mencegah memory leak
  setTimeout(() => {
    instructionCache.delete(orderId);
  }, 24 * 60 * 60 * 1000);
}

export function getStoredPaymentInstruction(
  orderId: string,
): PaymentInstruction | undefined {
  return instructionCache.get(orderId);
}

interface ChargeOptions {
  orderId: string;
  amount: number;
  paymentMethod: AllowedPaymentMethod;
  customer: {
    firstName: string;
    email: string;
  };
  item: {
    id: string;
    name: string;
    price: number;
  };
  creditCard?: {
    tokenId: string;
    authenticationId?: string;
  };
}

export async function chargeCoreTransaction(options: ChargeOptions) {
  const { orderId, amount, paymentMethod, customer, item, creditCard } =
    options;

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Nominal pembayaran tidak valid.");
  }

  const transactionDetails = {
    order_id: orderId,
    gross_amount: amount,
  };

  const customerDetails = {
    first_name: customer.firstName.slice(0, 50),
    email: customer.email,
  };

  const itemDetails = [
    {
      id: item.id.slice(0, 50),
      price: amount,
      quantity: 1,
      name: item.name.slice(0, 50),
    },
  ];

  let chargePayload: Parameters<typeof coreApi.charge>[0];

  switch (paymentMethod) {
    case "qris": {
      chargePayload = {
        payment_type: "qris",
        transaction_details: transactionDetails,
        qris: {
          acquirer: "gopay",
        },
        customer_details: customerDetails,
        item_details: itemDetails,
      };
      break;
    }

    case "bca_va":
    case "bni_va":
    case "bri_va": {
      const bank = paymentMethod.replace("_va", "") as "bca" | "bni" | "bri";
      chargePayload = {
        payment_type: "bank_transfer",
        transaction_details: transactionDetails,
        bank_transfer: {
          bank,
        },
        customer_details: customerDetails,
        item_details: itemDetails,
      };
      break;
    }

    case "permata_va": {
      chargePayload = {
        payment_type: "permata",
        transaction_details: transactionDetails,
        customer_details: customerDetails,
        item_details: itemDetails,
      };
      break;
    }

    case "mandiri_va": {
      chargePayload = {
        payment_type: "echannel",
        transaction_details: transactionDetails,
        echannel: {
          bill_info1: "Pembayaran:",
          bill_info2: item.name.slice(0, 30),
        },
        customer_details: customerDetails,
        item_details: itemDetails,
      };
      break;
    }

    case "credit_card": {
      if (!creditCard?.tokenId) {
        throw new Error("Token kartu kredit diperlukan untuk metode pembayaran kartu.");
      }
      chargePayload = {
        payment_type: "credit_card",
        transaction_details: transactionDetails,
        credit_card: {
          token_id: creditCard.tokenId,
          ...(creditCard.authenticationId
            ? { authentication_id: creditCard.authenticationId }
            : {}),
        },
        customer_details: customerDetails,
        item_details: itemDetails,
      };
      break;
    }

    default:
      throw new Error(`Metode pembayaran ${paymentMethod} tidak didukung.`);
  }

  const response = await coreApi.charge(chargePayload);

  // Normalisasi instruksi pembayaran dari respons resmi Midtrans Core API
  const instruction: PaymentInstruction = {
    method: paymentMethod,
    expiryTime: response.expiry_time,
  };

  if (paymentMethod === "qris") {
    const qrAction = response.actions?.find(
      (a) => a.name === "generate-qr-code",
    );
    instruction.qrCodeUrl = qrAction?.url;
    instruction.qrString = response.qr_string;
  } else if (["bca_va", "bni_va", "bri_va"].includes(paymentMethod)) {
    const vaItem = response.va_numbers?.[0];
    instruction.bank = vaItem?.bank ?? paymentMethod.replace("_va", "").toUpperCase();
    instruction.vaNumber = vaItem?.va_number;
  } else if (paymentMethod === "permata_va") {
    instruction.bank = "PERMATA";
    instruction.vaNumber = response.permata_va_number ?? response.va_numbers?.[0]?.va_number;
  } else if (paymentMethod === "mandiri_va") {
    instruction.bank = "MANDIRI";
    instruction.billerCode = response.biller_code;
    instruction.billKey = response.bill_key;
  } else if (paymentMethod === "credit_card") {
    instruction.redirectUrl = response.redirect_url;
    instruction.maskedCard = response.masked_card;
    instruction.bank = response.bank;
  }

  storePaymentInstruction(orderId, instruction);

  return {
    raw: response,
    instruction,
  };
}

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string,
): boolean {
  if (!serverKey) return false;
  const hash = crypto
    .createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");
  return hash.toLowerCase() === signatureKey.toLowerCase();
}
