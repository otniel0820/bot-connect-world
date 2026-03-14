import { Injectable, Logger } from '@nestjs/common';
import { MessengerPort } from '../../domain/ports/messenger.port';
import { AiProviderPort } from '../../domain/ports/ai-provider.port';
import { ConversationStore } from '../stores/conversation.store';
import { ActivateAccountUseCase } from '../use-cases/activate-account.use-case';
import { SERVICE_INFO } from '../../infrastructure/config/service-info';

@Injectable()
export class DemoFlowService {
  private readonly logger = new Logger(DemoFlowService.name);

  constructor(
    private readonly messengerPort: MessengerPort,
    private readonly aiProviderPort: AiProviderPort,
    private readonly conversationStore: ConversationStore,
    private readonly activateAccountUseCase: ActivateAccountUseCase,
  ) {}

  async processDevice(senderId: string, messageText: string): Promise<void> {
    const text = messageText.toLowerCase();
    const match = SERVICE_INFO.deviceDownloads.find((d) =>
      d.keywords.some((kw) => text.includes(kw)),
    );

    await this.messengerPort.sendTypingOff(senderId);

    if (!match) {
      const context = `
[INSTRUCCIÓN INTERNA]
El cliente no especificó claramente su dispositivo. Pregúntale de nuevo de forma amigable.
Opciones: Android, iPhone/iPad, Fire TV Stick, Smart TV, TV Box Android o Computadora.
[FIN INSTRUCCIÓN]`;
      const history = this.conversationStore.getHistory(senderId);
      const response = await this.aiProviderPort.generateResponse(history, context);
      await this.messengerPort.sendMessage(senderId, response);
      return;
    }

    if ('brands' in match && match.brands?.length) {
      this.logger.log(`Smart TV detectado para ${senderId} — preguntando marca`);
      this.conversationStore.setPaymentState(senderId, 'awaiting_tv_brand');
      const brandNames = match.brands.map((b) => b.name).join(', ');
      await this.messengerPort.sendMessage(
        senderId,
        `Perfecto! Para darte las instrucciones correctas, ¿cuál es la marca de tu Smart TV?\n\nOpciones: ${brandNames}`,
      );
      return;
    }

    await this.sendDeviceDownload(senderId, match as any);
  }

  async processTvBrand(senderId: string, messageText: string): Promise<void> {
    const text = messageText.toLowerCase();
    const smartTvEntry = SERVICE_INFO.deviceDownloads.find(
      (d) => 'brands' in d && (d as any).brands?.length,
    ) as any;

    const brandMatch = smartTvEntry?.brands?.find((b: any) =>
      b.keywords.some((kw: string) => text.includes(kw)),
    );

    this.conversationStore.setPaymentState(senderId, 'idle');
    await this.messengerPort.sendTypingOff(senderId);

    if (brandMatch) {
      this.logger.log(`Marca Smart TV para ${senderId}: ${brandMatch.name}`);
      await this.sendDeviceDownload(senderId, brandMatch);
    } else {
      const brandNames = smartTvEntry?.brands?.map((b: any) => b.name).join(', ') ?? '';
      await this.messengerPort.sendMessage(
        senderId,
        `No reconocí esa marca. Las marcas compatibles son: ${brandNames}.\n\n¿Cuál tienes?`,
      );
      this.conversationStore.setPaymentState(senderId, 'awaiting_tv_brand');
    }
  }

  async processNameForDemo(senderId: string, fullname: string): Promise<void> {
    this.logger.log(`Activando demo para ${senderId}: ${fullname}`);
    this.conversationStore.setPaymentState(senderId, 'idle');
    await this.messengerPort.sendTypingOff(senderId);
    await this.messengerPort.sendMessage(senderId, 'Un momento, estoy activando tu demo...');

    try {
      const account = await this.activateAccountUseCase.execute(fullname, 'demo', senderId);
      await this.messengerPort.sendMessage(
        senderId,
        `Tu demo de 1 hora ya está activa!\n\nUsuario: ${account.username}\nContraseña: ${account.password}\n\nTienes 1 hora de acceso completo. Si quieres continuar con un plan, escríbenos. Disfruta el servicio!`,
      );
      this.logger.log(`Demo activada: ${account.username}`);
    } catch (error) {
      this.logger.error(`Error activando demo para ${senderId}`, error);
      await this.messengerPort.sendMessage(
        senderId,
        'Hubo un problema activando tu demo. Un agente te contactará en breve. Disculpa el inconveniente.',
      );
    }
  }

  private async sendDeviceDownload(
    senderId: string,
    device: { name: string; instructions: string; downloadUrl: string; imageUrl?: string },
  ): Promise<void> {
    this.logger.log(`Enviando descarga para ${senderId}: ${device.name}`);
    await this.messengerPort.sendMessage(
      senderId,
      `Perfecto! Para instalar en tu ${device.name}:\n\n${device.instructions}\n${device.downloadUrl}`,
    );
    if (device.imageUrl) {
      await this.messengerPort.sendImage(senderId, device.imageUrl);
    }
    await this.messengerPort.sendMessage(
      senderId,
      'Para activarte la demo de 1 hora, dime tu nombre completo y te creo el acceso de inmediato.',
    );
    this.conversationStore.setPaymentState(senderId, 'awaiting_name_for_demo');
  }
}
