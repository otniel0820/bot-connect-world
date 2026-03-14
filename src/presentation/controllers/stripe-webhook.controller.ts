import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { HandleStripeWebhookUseCase } from '../../application/use-cases/handle-stripe-webhook.use-case';

@Controller('webhook/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly handleStripeWebhookUseCase: HandleStripeWebhookUseCase,
  ) {}

  @Post()
  async handleStripeWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    const rawBody = (req as any).rawBody as Buffer;

    if (!rawBody) {
      this.logger.error('rawBody no disponible — habilita rawBody en NestFactory.create');
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'rawBody not enabled' });
      return;
    }

    if (!signature) {
      this.logger.warn('Webhook Stripe sin cabecera stripe-signature');
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'Missing stripe-signature header' });
      return;
    }

    try {
      await this.handleStripeWebhookUseCase.execute(rawBody, signature);
      res.status(HttpStatus.OK).json({ received: true });
    } catch (error) {
      this.logger.error(`Error procesando webhook Stripe: ${error.message}`);
      res.status(HttpStatus.BAD_REQUEST).json({ error: error.message });
    }
  }
}
