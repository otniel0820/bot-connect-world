import { Controller, Get, Post, Body, Query, Res, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { MessengerEventProcessorService } from '../../application/services/messenger-event-processor.service';
import { WebhookEventDto } from '../dtos/webhook-event.dto';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly eventProcessor: MessengerEventProcessorService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): void {
    const configuredToken = this.configService.get<string>('meta.verifyToken');
    if (mode === 'subscribe' && verifyToken === configuredToken) {
      this.logger.log('Webhook de Facebook verificado');
      res.status(HttpStatus.OK).send(challenge);
    } else {
      this.logger.warn('Verificación fallida — token incorrecto');
      res.status(HttpStatus.FORBIDDEN).json({ error: 'Token de verificación incorrecto' });
    }
  }

  @Post()
  async handleWebhookEvent(
    @Body() body: WebhookEventDto,
    @Res() res: Response,
  ): Promise<void> {
    res.status(HttpStatus.OK).json({ status: 'ok' });

    if (body.object !== 'page') return;

    for (const entry of body.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        await this.eventProcessor.process(event);
      }
    }
  }
}
