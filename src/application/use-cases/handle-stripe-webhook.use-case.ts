import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripePaymentStore } from '../stores/stripe-payment.store';

@Injectable()
export class HandleStripeWebhookUseCase {
  private readonly logger = new Logger(HandleStripeWebhookUseCase.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly stripePaymentStore: StripePaymentStore,
    private readonly configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('stripe.secretKey'), {
      apiVersion: '2026-02-25.clover',
    });
  }

  async execute(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.configService.get<string>('stripe.webhookSecret');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.warn(`Firma de webhook Stripe inválida: ${err.message}`);
      throw new Error(`Firma inválida: ${err.message}`);
    }

    this.logger.log(`Evento Stripe recibido: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        this.stripePaymentStore.save({
          paymentIntentId: pi.id,
          amount: pi.amount,
          currency: pi.currency,
          status: 'succeeded',
          customerEmail: pi.receipt_email ?? undefined,
          description: pi.description ?? undefined,
          metadata: pi.metadata ?? {},
          createdAt: new Date(pi.created * 1000),
        });
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== 'paid') break;

        const piId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent as Stripe.PaymentIntent)?.id;

        if (!piId) break;

        this.stripePaymentStore.save({
          paymentIntentId: piId,
          amount: session.amount_total ?? 0,
          currency: session.currency ?? 'usd',
          status: 'succeeded',
          customerEmail: session.customer_email ?? undefined,
          description: session.metadata?.description,
          metadata: session.metadata ?? {},
          createdAt: new Date(),
        });
        break;
      }

      default:
        this.logger.debug(`Evento ignorado: ${event.type}`);
    }
  }
}
