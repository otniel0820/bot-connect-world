export interface OrderInfo {
  id: string;
  customerId: string;
  planId: string;
  devices: number;
  months: number;
  amount: number;
  isRenewal: boolean;
  panelUsernameId?: string | null; // ObjectId del PanelUsername a renovar (null = nueva activación)
}

export abstract class OrderRepositoryPort {
  abstract isBotVerified(paymentReceiptId: string): Promise<boolean>;
  abstract markBotVerified(paymentReceiptId: string): Promise<void>;
  abstract findByPaymentReceiptId(paymentReceiptId: string): Promise<OrderInfo | null>;
  abstract setPanelUsernameId(orderId: string, panelUsernameId: string): Promise<void>;
  /** Busca la orden más reciente no verificada de un customer */
  abstract findUnverifiedByCustomerId(customerId: string): Promise<(OrderInfo & { paymentReceiptId: string }) | null>;
}
