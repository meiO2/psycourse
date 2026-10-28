declare module "midtrans-client" {
  export interface CoreApiConfig {
    isProduction: boolean;
    serverKey: string;
    clientKey?: string;
  }

  export interface TransactionDetails {
    order_id: string;
    gross_amount: number;
  }

  export interface CustomerDetails {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  }

  export interface ItemDetails {
    id: string;
    price: number;
    quantity: number;
    name: string;
  }

  export interface CoreApiChargeParams {
    payment_type:
      | "qris"
      | "bank_transfer"
      | "echannel"
      | "permata"
      | "credit_card"
      | string;
    transaction_details: TransactionDetails;
    customer_details?: CustomerDetails;
    item_details?: ItemDetails[];
    qris?: {
      acquirer?: string;
    };
    bank_transfer?: {
      bank: "bca" | "bni" | "bri" | "permata" | string;
      va_number?: string;
    };
    echannel?: {
      bill_info1: string;
      bill_info2: string;
    };
    credit_card?: {
      token_id: string;
      authentication_id?: string;
      bank?: string;
    };
    custom_expiry?: {
      order_time?: string;
      expiry_duration?: number;
      unit?: "minute" | "hour" | "day";
    };
  }

  export interface CoreApiAction {
    name: string;
    method: string;
    url: string;
  }

  export interface CoreApiVaNumber {
    bank: string;
    va_number: string;
  }

  export interface CoreApiChargeResponse {
    status_code: string;
    status_message: string;
    transaction_id: string;
    order_id: string;
    gross_amount: string;
    payment_type: string;
    transaction_time: string;
    transaction_status: string;
    fraud_status?: string;
    actions?: CoreApiAction[];
    qr_string?: string;
    va_numbers?: CoreApiVaNumber[];
    permata_va_number?: string;
    biller_code?: string;
    bill_key?: string;
    redirect_url?: string;
    bank?: string;
    masked_card?: string;
    currency?: string;
    expiry_time?: string;
  }

  export interface NotificationResponse {
    order_id: string;
    transaction_status: string;
    fraud_status?: string;
    gross_amount: string;
    status_code?: string;
    payment_type?: string;
    transaction_id?: string;
    signature_key?: string;
    actions?: CoreApiAction[];
    va_numbers?: CoreApiVaNumber[];
    permata_va_number?: string;
    biller_code?: string;
    bill_key?: string;
  }

  export interface TransactionService {
    status(transactionIdOrOrderId: string): Promise<CoreApiChargeResponse>;
    notification(payload: Record<string, unknown> | string): Promise<NotificationResponse>;
    cancel(transactionIdOrOrderId: string): Promise<CoreApiChargeResponse>;
    expire(transactionIdOrOrderId: string): Promise<CoreApiChargeResponse>;
  }

  export class CoreApi {
    constructor(options: CoreApiConfig);
    charge(parameter: CoreApiChargeParams): Promise<CoreApiChargeResponse>;
    cardToken(parameter: Record<string, unknown>): Promise<CoreApiChargeResponse>;
    transaction: TransactionService;
  }

  export interface SnapOptions {
    isProduction: boolean;
    serverKey: string;
    clientKey?: string;
  }

  export class Snap {
    constructor(options: SnapOptions);
    createTransaction(options: Record<string, unknown>): Promise<{ token: string; redirect_url: string }>;
    transaction: TransactionService;
  }

  const midtransClient: {
    CoreApi: typeof CoreApi;
    Snap: typeof Snap;
  };

  export default midtransClient;
}
