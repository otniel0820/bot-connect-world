export interface OrderInfo {
  customerId: string;
  planId: string;
  devices: number;
  months: number;
  amount: number;
}

export abstract class OrderRepositoryPort {
  abstract isBotVerified(paymentReceiptId: string): Promise<boolean>;
  abstract markBotVerified(paymentReceiptId: string): Promise<void>;
  abstract findByPaymentReceiptId(paymentReceiptId: string): Promise<OrderInfo | null>;
  /** Busca la orden más reciente no verificada de un customer */
  abstract findUnverifiedByCustomerId(customerId: string): Promise<(OrderInfo & { paymentReceiptId: string }) | null>;
}
