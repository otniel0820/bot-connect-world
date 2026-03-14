import { Injectable, Logger } from '@nestjs/common';
import { StripePayment } from '../../domain/entities/stripe-payment.entity';

const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

@Injectable()
export class StripePaymentStore {
  private readonly logger = new Logger(StripePaymentStore.name);
  private readonly store = new Map<string, StripePayment>();
  // IDs ya verificados por algún usuario (nunca se reutilizan)
  private readonly usedIds = new Set<string>();

  save(payment: StripePayment): void {
    this.store.set(payment.paymentIntentId, payment);
    this.cleanup();
    this.logger.log(`Pago guardado: ${payment.paymentIntentId} | ${payment.amount / 100} ${payment.currency.toUpperCase()}`);
  }

  isUsed(paymentIntentId: string): boolean {
    return this.usedIds.has(paymentIntentId);
  }

  findById(paymentIntentId: string): StripePayment | undefined {
    const payment = this.store.get(paymentIntentId);
    if (payment?.usedAt) return undefined; // ya fue utilizado
    return payment;
  }

  findByAmountAndCurrency(amount: number, currency: string): StripePayment | undefined {
    const candidates = Array.from(this.store.values())
      .filter(
        (p) =>
          !p.usedAt &&
          p.status === 'succeeded' &&
          p.currency.toLowerCase() === currency.toLowerCase() &&
          p.amount === amount,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return candidates[0];
  }

  markAsUsed(paymentIntentId: string): void {
    // Registrar en el Set permanente (cubre tanto pagos del store como de la API)
    this.usedIds.add(paymentIntentId);

    const payment = this.store.get(paymentIntentId);
    if (payment) {
      payment.usedAt = new Date();
      this.store.set(paymentIntentId, payment);
    }

    this.logger.log(`Pago marcado como usado: ${paymentIntentId}`);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, payment] of this.store.entries()) {
      if (now - payment.createdAt.getTime() > TTL_MS) {
        this.store.delete(id);
      }
    }
  }
}
