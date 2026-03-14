import { Module } from '@nestjs/common';
import { WebhookController } from './controllers/webhook.controller';
import { StripeWebhookController } from './controllers/stripe-webhook.controller';
import { ApplicationModule } from '../application/application.module';

@Module({
  imports: [ApplicationModule],
  controllers: [WebhookController, StripeWebhookController],
})
export class PresentationModule {}
