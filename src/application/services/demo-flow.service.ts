import { Injectable, Logger } from '@nestjs/common';
import { MessengerPort } from '../../domain/ports/messenger.port';
import { AiProviderPort } from '../../domain/ports/ai-provider.port';
import { ConversationStore } from '../stores/conversation.store';
import { ActivateAccountUseCase } from '../use-cases/activate-account.use-case';
import { BotControlService } from './bot-control.service';
import { SERVICE_INFO } from '../../infrastructure/config/service-info';

@Injectable()
export class DemoFlowService {
  private readonly logger = new Logger(DemoFlowService.name);

  constructor(
    private readonly messengerPort: MessengerPort,
    private readonly aiProviderPort: AiProviderPort,
    private readonly conversationStore: ConversationStore,
    private readonly activateAccountUseCase: ActivateAccountUseCase,
    private readonly botControlService: BotControlService,
  ) {}

  async processDevice(senderId: string, messageText: string): Promise<void> {
    if (!this.botControlService.getSettings().demos_enabled) {
      this.logger.log(`Demos desactivadas — cortando flujo de dispositivo para ${senderId}`);
      this.conversationStore.setPaymentState(senderId, 'idle');
      await this.messengerPort.sendTypingOff(senderId);
      await this.messengerPort.sendMessage(
        senderId,
        'En este momento no hay demos disponibles. Si deseas acceder al servicio puedes adquirir uno de nuestros planes. ¡Con gusto te ayudamos!',
      );
      return;
    }

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

  async processNameForDemo(senderId: string, messageText: string): Promise<void> {
    // Guardia final: verificar antes de activar
    if (!this.botControlService.getSettings().demos_enabled) {
      this.logger.log(`Demos desactivadas — bloqueando activación para ${senderId}`);
      this.conversationStore.setPaymentState(senderId, 'idle');
      await this.messengerPort.sendTypingOff(senderId);
      await this.messengerPort.sendMessage(
        senderId,
        'En este momento no hay demos disponibles. Si deseas acceder al servicio puedes adquirir uno de nuestros planes. ¡Con gusto te ayudamos!',
      );
      return;
    }

    const duration = this.conversationStore.getDemoDuration(senderId);
    const packageKey = duration === '3h' ? 'demo_3h' : 'demo';
    const demoLabel = duration === '3h' ? '3 horas' : '1 hora';

    // Validar con IA si el mensaje es realmente un nombre
    const history = this.conversationStore.getHistory(senderId);
    const parsed = await this.aiProviderPort.parseNameFromMessage(messageText, history, demoLabel);

    await this.messengerPort.sendTypingOff(senderId);

    if (!parsed.isName) {
      // El cliente no proporcionó su nombre — responder naturalmente y seguir esperando
      this.logger.log(`Mensaje no es un nombre para ${senderId}: "${messageText}"`);
      await this.messengerPort.sendMessage(senderId, parsed.response);
      // Mantener el estado awaiting_name_for_demo
      this.conversationStore.setPaymentState(senderId, 'awaiting_name_for_demo');
      return;
    }

    const fullname = parsed.name;
    this.logger.log(`Activando demo (${packageKey}) para ${senderId}: ${fullname}`);
    this.conversationStore.setPaymentState(senderId, 'idle');
    await this.messengerPort.sendMessage(senderId, 'Un momento, estoy activando tu demo...');

    try {
      const account = await this.activateAccountUseCase.execute(fullname, packageKey, senderId);
      await this.messengerPort.sendMessage(
        senderId,
        `Tu demo de ${demoLabel} ya está activa!\n\nUsuario: ${account.username}\nContraseña: ${account.password}\n\nImportante: escribe el usuario y la contraseña exactamente como aparecen aquí, respetando mayúsculas, minúsculas y cualquier número o símbolo. Un error de tipeo es la causa más común de que no entre.\n\nTienes ${demoLabel} de acceso completo. Si tienes algún problema para ingresar, cuéntame qué te aparece en pantalla y con gusto te ayudo. Disfruta el servicio!`,
      );
      this.logger.log(`Demo activada: ${account.username} (${packageKey})`);
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
    const duration = this.conversationStore.getDemoDuration(senderId);
    const demoLabel = duration === '3h' ? '3 horas' : '1 hora';
    await this.messengerPort.sendMessage(
      senderId,
      `Para activarte la demo de ${demoLabel}, dime tu nombre completo y te creo el acceso de inmediato.`,
    );
    this.conversationStore.setPaymentState(senderId, 'awaiting_name_for_demo');
  }
}
