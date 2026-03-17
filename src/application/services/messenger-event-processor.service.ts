import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessengerPort } from '../../domain/ports/messenger.port';
import { HandleIncomingMessageUseCase } from '../use-cases/handle-incoming-message.use-case';
import { MessagingEvent } from '../../presentation/dtos/webhook-event.dto';
import { BotControlService } from './bot-control.service';
import { ConversationStore } from '../stores/conversation.store';

const MEDIA_DEBOUNCE_MS = 5000;
const MAX_MESSAGE_AGE_MS = 30_000;

interface PendingMessage {
  messageText: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  timer: ReturnType<typeof setTimeout>;
}

@Injectable()
export class MessengerEventProcessorService {
  private readonly logger = new Logger(MessengerEventProcessorService.name);
  private readonly pending = new Map<string, PendingMessage>();

  constructor(
    private readonly handleIncomingMessage: HandleIncomingMessageUseCase,
    private readonly messengerPort: MessengerPort,
    private readonly configService: ConfigService,
    private readonly botControlService: BotControlService,
    private readonly conversationStore: ConversationStore,
  ) {}

  async process(event: MessagingEvent): Promise<void> {
    const senderId = event.sender?.id;
    if (!senderId || !event.message) return;

    // Echo: el agente (yo) escribió desde la página → activar human takeover para ese cliente
    if ((event.message as any).is_echo) {
      const customerId = event.recipient?.id;
      if (customerId) {
        this.conversationStore.setHumanTakeover(customerId, true);
        this.logger.log(`Human takeover activado para ${customerId} — bot en pausa`);
      }
      return;
    }

    const messageText = event.message.text?.trim() ?? '';
    const imageUrl = this.extractAttachment(event, 'image');
    const audioUrl = this.extractAttachment(event, 'audio');
    const videoUrl = this.extractAttachment(event, 'video');

    if (!messageText && !imageUrl && !audioUrl && !videoUrl) return;

    // Comando de diagnóstico: devuelve el Facebook User ID
    if (messageText === '!miid') {
      await this.messengerPort.sendMessage(
        senderId,
        `Tu Facebook User ID es:\n\n${senderId}\n\nAgrégalo en tu .env:\nTEST_USER_ID=${senderId}`,
      );
      return;
    }

    // Ignorar mensajes antiguos (webhooks acumulados al reiniciar)
    const ageMs = Date.now() - (event.timestamp ?? Date.now());
    if (ageMs > MAX_MESSAGE_AGE_MS) {
      this.logger.debug(`Mensaje ignorado por antigüedad (${Math.round(ageMs / 1000)}s): ${senderId}`);
      return;
    }

    // Verificar si el bot está activo
    if (!this.botControlService.getSettings().bot_enabled) {
      this.logger.debug(`Bot desactivado — ignorando mensaje de ${senderId}`);
      return;
    }

    // Modo prueba: responder solo al usuario configurado
    const testUserId = this.configService.get<string>('testUserId');
    if (testUserId && senderId !== testUserId) {
      this.logger.debug(`Ignorado en modo prueba (sender: ${senderId})`);
      return;
    }

    // Human takeover: el agente está atendiendo este chat manualmente
    if (this.conversationStore.isHumanTakeover(senderId)) {
      this.logger.log(`Human takeover activo — bot ignora mensaje de ${senderId}`);
      return;
    }

    this.logger.log(
      `Mensaje de ${senderId}: "${messageText.substring(0, 50)}" | img: ${imageUrl ? 'sí' : 'no'} | audio: ${audioUrl ? 'sí' : 'no'} | video: ${videoUrl ? 'sí' : 'no'}`,
    );

    // Debounce: acumular imagen/video que llegan en eventos separados
    const existing = this.pending.get(senderId);
    if (existing) {
      clearTimeout(existing.timer);
      existing.messageText = [existing.messageText, messageText].filter(Boolean).join(' ');
      existing.imageUrl ??= imageUrl;
      existing.audioUrl ??= audioUrl;
      existing.videoUrl ??= videoUrl;
      existing.timer = setTimeout(() => this.flush(senderId), MEDIA_DEBOUNCE_MS);
      return;
    }

    if (imageUrl || videoUrl) {
      this.pending.set(senderId, {
        messageText, imageUrl, audioUrl, videoUrl,
        timer: setTimeout(() => this.flush(senderId), MEDIA_DEBOUNCE_MS),
      });
      return;
    }

    await this.handleIncomingMessage.execute(senderId, messageText, imageUrl, audioUrl, videoUrl);
  }

  private async flush(senderId: string): Promise<void> {
    const msg = this.pending.get(senderId);
    if (!msg) return;
    this.pending.delete(senderId);
    this.logger.log(`Procesando mensaje acumulado de ${senderId}: "${msg.messageText.substring(0, 50)}"`);
    await this.handleIncomingMessage.execute(senderId, msg.messageText, msg.imageUrl, msg.audioUrl, msg.videoUrl);
  }

  private extractAttachment(event: MessagingEvent, type: string): string | undefined {
    return event.message?.attachments?.find((a) => a.type === type)?.payload?.url;
  }
}
