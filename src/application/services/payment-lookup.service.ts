import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { AiProviderPort } from '../../domain/ports/ai-provider.port';
import { OrderRepositoryPort } from '../../domain/ports/order-repository.port';
import { CustomerRepositoryPort } from '../../domain/ports/customer-repository.port';
import { StripePaymentStore } from '../stores/stripe-payment.store';
import { StripePayment } from '../../domain/entities/stripe-payment.entity';

const PI_REGEX = /\bpi_[A-Za-z0-9]+\b/;

@Injectable()
export class PaymentLookupService {
  private readonly logger = new Logger(PaymentLookupService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly stripePaymentStore: StripePaymentStore,
    private readonly orderRepo: OrderRepositoryPort,
    private readonly customerRepo: CustomerRepositoryPort,
    private readonly aiProviderPort: AiProviderPort,
    private readonly configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('stripe.secretKey'), {
      apiVersion: '2026-02-25.clover',
    });
  }

  /** Extrae datos del comprobante desde una imagen usando Vision API */
  async extractDataFromImage(imageUrl: string): Promise<Record<string, any> | null> {
    try {
      const raw = await this.aiProviderPort.analyzePaymentImage(imageUrl);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      this.logger.warn(`No se pudo extraer datos de la imagen: ${err.message}`);
      return null;
    }
  }

  /** Detecta si una imagen contiene un comprobante de pago */
  async imageContainsPayment(imageUrl: string): Promise<boolean> {
    const extracted = await this.extractDataFromImage(imageUrl);
    if (extracted?.paymentIntentId) return true;
    const receiptRaw: string = extracted?.receiptNumber ?? '';
    const normalized = this.normalizeReceiptId(receiptRaw);
    return normalized !== null;
  }

  /**
   * Punto de entrada principal. Intenta encontrar el pago usando todos los métodos disponibles:
   * 1. Store en memoria (webhook de Stripe ya recibido)
   * 2. Extracción de pi_ del texto
   * 3. MongoDB (landing ya registró la orden)
   * 4. Stripe API por ID exacto
   * 5. Fallback por Facebook ID (cliente recurrente con OCR malo)
   * 6. Fallback por monto + cruce MongoDB (cliente nuevo con OCR malo)
   */
  async lookup(
    senderId: string,
    messageText: string,
    imageUrl?: string,
  ): Promise<{ payment: StripePayment | undefined; alreadyVerified: boolean }> {
    let payment: StripePayment | undefined;
    let extractedPiId: string | undefined;
    let imageData: Record<string, any> | null = null;

    if (imageUrl) {
      imageData = await this.extractDataFromImage(imageUrl);
      this.logger.log(`Datos extraídos del comprobante: ${JSON.stringify(imageData)}`);

      extractedPiId = imageData?.paymentIntentId ?? undefined;

      // Normalizar prefijos OCR incorrectos: pl_, p1_, pI_ → pi_
      if (!extractedPiId && imageData?.receiptNumber) {
        extractedPiId = this.normalizeReceiptId(imageData.receiptNumber) ?? undefined;
        if (extractedPiId) {
          this.logger.log(`receiptNumber normalizado: ${imageData.receiptNumber} → ${extractedPiId}`);
        }
      }

      if (extractedPiId) payment = this.stripePaymentStore.findById(extractedPiId);

      if (!payment && imageData?.amount && imageData?.currency) {
        payment = this.stripePaymentStore.findByAmountAndCurrency(imageData.amount, imageData.currency);
      }
    }

    if (!extractedPiId) {
      extractedPiId = messageText.match(PI_REGEX)?.[0];
    }

    if (!payment && extractedPiId) {
      payment = this.stripePaymentStore.findById(extractedPiId);
    }

    // Verificar si ya fue procesado por el bot
    if (extractedPiId && await this.orderRepo.isBotVerified(extractedPiId)) {
      return { payment: undefined, alreadyVerified: true };
    }

    // Fallback 1: orden en MongoDB registrada por la landing
    if (!payment && extractedPiId) {
      const order = await this.orderRepo.findByPaymentReceiptId(extractedPiId);
      if (order) {
        this.logger.log(`Orden en BD para ${extractedPiId} — validado por landing`);
        payment = {
          paymentIntentId: extractedPiId,
          amount: Math.round(order.amount * 100),
          currency: 'usd',
          status: 'succeeded',
          createdAt: new Date(),
        };
      }
    }

    // Fallback 2: Stripe API por ID exacto
    if (!payment && extractedPiId) {
      payment = await this.fetchFromStripe(extractedPiId);
    }

    // Fallback 3: Facebook ID → orden pendiente → Stripe (cliente recurrente, OCR malo)
    if (!payment) {
      payment = await this.findByFacebookId(senderId);
    }

    // Fallback 4: monto + cruce MongoDB (cliente nuevo, OCR malo)
    if (!payment && imageData?.amount && imageData?.currency) {
      payment = await this.searchByAmountAndOrder(imageData.amount, imageData.currency);
    }

    return { payment, alreadyVerified: false };
  }

  async fetchFromStripe(piId: string): Promise<StripePayment | undefined> {
    try {
      this.logger.log(`Consultando Stripe API para: ${piId}`);
      const pi = await this.stripe.paymentIntents.retrieve(piId);
      if (pi.status !== 'succeeded') {
        this.logger.warn(`PaymentIntent ${piId} tiene estado: ${pi.status}`);
        return undefined;
      }
      return this.toStripePayment(pi);
    } catch (err) {
      this.logger.warn(`No se pudo consultar Stripe API: ${err.message}`);
      return undefined;
    }
  }

  private async findByFacebookId(facebookId: string): Promise<StripePayment | undefined> {
    try {
      const customer = await this.customerRepo.findByFacebookId(facebookId);
      if (!customer) return undefined;

      const pending = await this.orderRepo.findUnverifiedByCustomerId(customer.id);
      if (!pending) {
        this.logger.warn(`Sin orden pendiente para customer ${customer.id}`);
        return undefined;
      }

      this.logger.log(`Fallback FB ID: orden pendiente ${pending.paymentReceiptId}`);
      return await this.fetchFromStripe(pending.paymentReceiptId);
    } catch (err) {
      this.logger.warn(`Error en fallback por Facebook ID: ${err.message}`);
      return undefined;
    }
  }

  private async searchByAmountAndOrder(amount: number, currency: string): Promise<StripePayment | undefined> {
    try {
      this.logger.log(`Fallback monto: buscando en Stripe ${amount} ${currency}`);
      const cutoff = Math.floor(Date.now() / 1000) - 48 * 60 * 60;
      const list = await this.stripe.paymentIntents.list({ limit: 50, created: { gte: cutoff } });
      const candidates = list.data.filter(
        (pi) => pi.status === 'succeeded' && pi.amount === amount && pi.currency === currency,
      );
      for (const pi of candidates) {
        if (await this.orderRepo.isBotVerified(pi.id)) continue;
        const order = await this.orderRepo.findByPaymentReceiptId(pi.id);
        if (order) {
          this.logger.log(`Pago encontrado por monto + orden en BD: ${pi.id}`);
          return this.toStripePayment(pi);
        }
      }
      return undefined;
    } catch (err) {
      this.logger.warn(`Error en fallback por monto: ${err.message}`);
      return undefined;
    }
  }

  private normalizeReceiptId(raw: string): string | null {
    const normalized = raw.replace(/^p[l1I][-_]/i, 'pi_').replace(/^pi-/, 'pi_');
    return normalized.startsWith('pi_') && normalized.length > 10 ? normalized : null;
  }

  private toStripePayment(pi: Stripe.PaymentIntent): StripePayment {
    return {
      paymentIntentId: pi.id,
      amount: pi.amount,
      currency: pi.currency,
      status: 'succeeded',
      customerEmail: pi.receipt_email ?? undefined,
      description: pi.description ?? undefined,
      metadata: pi.metadata ?? {},
      createdAt: new Date(pi.created * 1000),
    };
  }
}
