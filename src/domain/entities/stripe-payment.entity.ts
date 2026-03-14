export interface StripePayment {
  paymentIntentId: string;
  amount: number;       // en centavos (e.g., 1000 = $10.00)
  currency: string;     // e.g., 'usd'
  status: 'succeeded' | 'processing' | 'canceled';
  customerEmail?: string;
  description?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
  usedAt?: Date;        // Marca el comprobante como ya utilizado
}
