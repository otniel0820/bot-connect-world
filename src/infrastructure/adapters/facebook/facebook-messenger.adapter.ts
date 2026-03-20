import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { MessengerPort } from '../../../domain/ports/messenger.port';

@Injectable()
export class FacebookMessengerAdapter implements MessengerPort {
  private readonly logger = new Logger(FacebookMessengerAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async sendMessage(recipientId: string, text: string): Promise<void> {
    await this.callSendApi({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
    });
  }

  async sendImage(recipientId: string, imageUrl: string): Promise<void> {
    await this.callSendApi({
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: 'image',
          payload: { url: imageUrl, is_reusable: true },
        },
      },
      messaging_type: 'RESPONSE',
    });
  }

  async sendTypingOn(recipientId: string): Promise<void> {
    await this.callSendApi({
      recipient: { id: recipientId },
      sender_action: 'typing_on',
    }).catch((err) => this.logger.warn(`sendTypingOn fallido para ${recipientId}: ${err?.message}`));
  }

  async sendTypingOff(recipientId: string): Promise<void> {
    await this.callSendApi({
      recipient: { id: recipientId },
      sender_action: 'typing_off',
    }).catch((err) => this.logger.warn(`sendTypingOff fallido para ${recipientId}: ${err?.message}`));
  }

  private async callSendApi(body: object): Promise<void> {
    const pageAccessToken = this.configService.get<string>('meta.pageAccessToken');
    const graphApiUrl = this.configService.get<string>('meta.graphApiUrl');

    try {
      await axios.post(`${graphApiUrl}/me/messages`, body, {
        params: { access_token: pageAccessToken },
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      this.logger.error(
        'Error llamando a Facebook Send API',
        error?.response?.data ?? error.message,
      );
      throw error;
    }
  }
}
