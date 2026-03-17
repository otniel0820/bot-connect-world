import { Module } from '@nestjs/common';
import { ConversationStore } from './stores/conversation.store';
import { StripePaymentStore } from './stores/stripe-payment.store';
import { HandleIncomingMessageUseCase } from './use-cases/handle-incoming-message.use-case';
import { HandleStripeWebhookUseCase } from './use-cases/handle-stripe-webhook.use-case';
import { ActivateAccountUseCase } from './use-cases/activate-account.use-case';
import { DemoFollowUpService } from './services/demo-followup.service';
import { PaymentLookupService } from './services/payment-lookup.service';
import { DemoFlowService } from './services/demo-flow.service';
import { MessengerEventProcessorService } from './services/messenger-event-processor.service';
import { BotControlService } from './services/bot-control.service';

@Module({
  providers: [
    BotControlService,
    ConversationStore,
    StripePaymentStore,
    HandleIncomingMessageUseCase,
    HandleStripeWebhookUseCase,
    ActivateAccountUseCase,
    DemoFollowUpService,
    PaymentLookupService,
    DemoFlowService,
    MessengerEventProcessorService,
  ],
  exports: [
    BotControlService,
    ConversationStore,
    StripePaymentStore,
    HandleIncomingMessageUseCase,
    HandleStripeWebhookUseCase,
    ActivateAccountUseCase,
    DemoFollowUpService,
    PaymentLookupService,
    DemoFlowService,
    MessengerEventProcessorService,
  ],
})
export class ApplicationModule {}
