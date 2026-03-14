import { Injectable, Logger } from '@nestjs/common';
import { MessengerPort } from '../../domain/ports/messenger.port';
import { AiProviderPort } from '../../domain/ports/ai-provider.port';
import { ConversationStore } from '../stores/conversation.store';
import { OrderRepositoryPort } from '../../domain/ports/order-repository.port';
import { CustomerRepositoryPort } from '../../domain/ports/customer-repository.port';
import { ActivateAccountUseCase, PackageKey } from './activate-account.use-case';
import { PaymentLookupService } from '../services/payment-lookup.service';
import { DemoFlowService } from '../services/demo-flow.service';
import { StripePayment } from '../../domain/entities/stripe-payment.entity';
import { SERVICE_INFO } from '../../infrastructure/config/service-info';

const PI_REGEX = /\bpi_[A-Za-z0-9]+\b/;
const GENERIC_PAYMENT_REGEX =
  /\b(pag[ué]|transfer[eé]|envi[eé]|pagos?|transferencia|comprobante|captura|recibo|realic[eé]|hice el pago|ya pag|confirmad[ao])\b/i;
const DEMO_REGEX = /\b(demo|prueba|probar|test|trial|gratis|free|hora gratis|1 hora)\b/i;

function resolvePackageKey(devices: number, months: number): PackageKey | null {
  const tier = devices === 1 ? 'basic' : devices === 2 ? 'standard' : devices === 3 ? 'premium' : null;
  if (!tier) return null;
  const validMonths = [1, 3, 6, 12];
  if (!validMonths.includes(months)) return null;
  return `${tier}_${months}m` as PackageKey;
}

@Injectable()
export class HandleIncomingMessageUseCase {
  private readonly logger = new Logger(HandleIncomingMessageUseCase.name);

  constructor(
    private readonly messengerPort: MessengerPort,
    private readonly aiProviderPort: AiProviderPort,
    private readonly conversationStore: ConversationStore,
    private readonly orderRepo: OrderRepositoryPort,
    private readonly customerRepo: CustomerRepositoryPort,
    private readonly activateAccountUseCase: ActivateAccountUseCase,
    private readonly paymentLookup: PaymentLookupService,
    private readonly demoFlow: DemoFlowService,
  ) {}

  async execute(
    senderId: string,
    messageText: string,
    imageUrl?: string,
    audioUrl?: string,
    videoUrl?: string,
  ): Promise<void> {
    try {
      await this.messengerPort.sendTypingOn(senderId);

      // Transcribir audio
      if (audioUrl) {
        try {
          const transcription = await this.aiProviderPort.transcribeAudio(audioUrl);
          this.logger.log(`Audio transcrito de ${senderId}: "${transcription.substring(0, 100)}"`);
          messageText = transcription + (messageText ? ` ${messageText}` : '');
        } catch {
          this.logger.warn(`No se pudo transcribir audio de ${senderId}`);
        }
      }

      // Procesar video: audio + frame
      if (videoUrl) {
        const [transcription, frame] = await Promise.allSettled([
          this.aiProviderPort.transcribeAudio(videoUrl),
          this.aiProviderPort.extractVideoFrame(videoUrl),
        ]);
        if (transcription.status === 'fulfilled' && transcription.value) {
          messageText = transcription.value + (messageText ? ` ${messageText}` : '');
        }
        if (frame.status === 'fulfilled' && frame.value) {
          imageUrl = frame.value;
        }
      }

      await this.routeMessage(senderId, messageText, imageUrl);
    } catch (error) {
      this.logger.error(`Error procesando mensaje de ${senderId}`, error);
      await this.messengerPort.sendTypingOff(senderId);
      await this.messengerPort.sendMessage(
        senderId,
        'Disculpa, tuve un problema al procesar tu mensaje. Por favor intenta de nuevo en un momento.',
      );
    }
  }

  // ── Enrutador principal según estado de la conversación ──────────────────

  private async routeMessage(senderId: string, messageText: string, imageUrl?: string): Promise<void> {
    const state = this.conversationStore.getPaymentState(senderId);

    if (state === 'awaiting_comprobante') {
      await this.processComprobante(senderId, messageText, imageUrl);
      return;
    }
    if (state === 'awaiting_device_demo') {
      await this.demoFlow.processDevice(senderId, messageText);
      return;
    }
    if (state === 'awaiting_tv_brand') {
      await this.demoFlow.processTvBrand(senderId, messageText);
      return;
    }
    if (state === 'awaiting_name_for_demo') {
      await this.demoFlow.processNameForDemo(senderId, messageText);
      return;
    }

    await this.handleIdleMessage(senderId, messageText, imageUrl);
  }

  // ── Conversación en estado idle ──────────────────────────────────────────

  private async handleIdleMessage(senderId: string, messageText: string, imageUrl?: string): Promise<void> {
    // Imagen con comprobante de pago
    if (imageUrl && await this.paymentLookup.imageContainsPayment(imageUrl)) {
      this.logger.log(`Comprobante detectado en imagen de ${senderId}`);
      await this.processComprobante(senderId, messageText, imageUrl);
      return;
    }

    // Texto con pi_ ID
    if (PI_REGEX.test(messageText)) {
      this.logger.log(`PI ID detectado en mensaje de ${senderId}`);
      await this.processComprobante(senderId, messageText, imageUrl);
      return;
    }

    this.conversationStore.addMessage(senderId, { role: 'user', content: messageText });
    let paymentContext = '';

    if (DEMO_REGEX.test(messageText)) {
      this.logger.log(`Solicitud de demo de ${senderId}`);
      this.conversationStore.setPaymentState(senderId, 'awaiting_device_demo');

      // Si ya viene el dispositivo en el mismo mensaje, procesarlo directo
      const text = messageText.toLowerCase();
      if (SERVICE_INFO.deviceDownloads.some((d) => d.keywords.some((kw) => text.includes(kw)))) {
        await this.demoFlow.processDevice(senderId, messageText);
        return;
      }

      paymentContext = `
[INSTRUCCIÓN INTERNA - DEMO SOLICITADA]
El cliente quiere probar el servicio con la demo gratuita de 1 hora.
ACCIÓN REQUERIDA: Explica brevemente la demo (1 hora gratis, acceso completo, sin datos de pago) y pregúntale en qué dispositivo le gustaría probarla.
Menciona las opciones: Android, iPhone/iPad, Fire TV Stick, Smart TV, TV Box o Computadora.
[FIN INSTRUCCIÓN]`;
    } else if (GENERIC_PAYMENT_REGEX.test(messageText)) {
      this.logger.log(`Mención de pago de ${senderId} — solicitando comprobante`);
      this.conversationStore.setPaymentState(senderId, 'awaiting_comprobante');
      paymentContext = `
[INSTRUCCIÓN INTERNA - PAGO MENCIONADO]
El cliente acaba de mencionar que realizó un pago.
ACCIÓN REQUERIDA: Pídele amablemente que envíe una imagen de su comprobante de pago (recibo de Stripe, confirmación de transacción).
NO confirmes ni deniegues el pago aún.
[FIN INSTRUCCIÓN]`;
    }

    const history = this.conversationStore.getHistory(senderId);
    const response = await this.aiProviderPort.generateResponse(history, this.buildSystemPrompt(paymentContext));
    this.conversationStore.addMessage(senderId, { role: 'assistant', content: response });
    await this.messengerPort.sendTypingOff(senderId);
    await this.messengerPort.sendMessage(senderId, response);
  }

  // ── Verificación y activación de pago ────────────────────────────────────

  private async processComprobante(senderId: string, messageText: string, imageUrl?: string): Promise<void> {
    this.logger.log(`Procesando comprobante de ${senderId} | imagen: ${imageUrl ? 'sí' : 'no'}`);

    const { payment, alreadyVerified } = await this.paymentLookup.lookup(senderId, messageText, imageUrl);

    if (alreadyVerified) {
      await this.messengerPort.sendTypingOff(senderId);
      await this.messengerPort.sendMessage(
        senderId,
        'Este comprobante ya fue verificado anteriormente. Por favor envía un comprobante diferente.',
      );
      return;
    }

    let botResponse: string;

    if (payment) {
      await this.orderRepo.markBotVerified(payment.paymentIntentId);
      this.conversationStore.setPaymentState(senderId, 'idle');
      this.logger.log(`Pago verificado para ${senderId}: ${payment.paymentIntentId}`);

      const activated = await this.activateSubscription(senderId, payment);
      if (!activated) {
        const amount = (payment.amount / 100).toFixed(2);
        botResponse = await this.generateAiResponse(senderId, `
[VERIFICACION DE PAGO - RESULTADO INTERNO]
Estado: VERIFICADO ✓ | ID: ${payment.paymentIntentId} | Monto: $${amount} ${payment.currency.toUpperCase()}
INSTRUCCIÓN: Informa al cliente que su pago fue verificado. Felicítalo y dile que su acceso será activado en breve.
[FIN VERIFICACION]`);
      }
    } else {
      this.logger.warn(`No se encontró pago para ${senderId}`);
      botResponse = await this.generateAiResponse(senderId, `
[VERIFICACION DE PAGO - RESULTADO INTERNO]
Estado: NO ENCONTRADO
INSTRUCCIÓN: No se encontró el pago. Pide al cliente que verifique su comprobante o que espere unos minutos y reenvíe. Sé amable.
[FIN VERIFICACION]`);
    }

    await this.messengerPort.sendTypingOff(senderId);
    if (botResponse) await this.messengerPort.sendMessage(senderId, botResponse);
  }

  private async activateSubscription(senderId: string, payment: StripePayment): Promise<boolean> {
    try {
      const order = await this.orderRepo.findByPaymentReceiptId(payment.paymentIntentId);
      if (!order) {
        this.logger.warn(`Sin orden para: ${payment.paymentIntentId}`);
        return false;
      }

      const packageKey = resolvePackageKey(order.devices, order.months);
      if (!packageKey) {
        this.logger.warn(`Paquete no determinado: devices=${order.devices} months=${order.months}`);
        return false;
      }

      const customer = await this.customerRepo.findByCustomerId(order.customerId);
      if (!customer) {
        this.logger.warn(`Sin customer: ${order.customerId}`);
        return false;
      }

      const isRenewal = !!customer.panelUsername;
      this.logger.log(`${isRenewal ? 'Renovación' : 'Nueva suscripción'} para ${customer.name} | ${packageKey}`);

      const account = await this.activateAccountUseCase.execute(
        customer.name,
        packageKey,
        undefined,
        customer.panelUsername,
      );

      await this.customerRepo.updatePanelCredentials(order.customerId, account.username, senderId);

      const msg = isRenewal
        ? `Tu suscripción ha sido renovada!\n\nUsuario: ${account.username}\nContraseña: ${account.password}\n\nYa tienes acceso activo nuevamente. Si tienes alguna duda, con gusto te ayudamos.`
        : `Tu suscripción ha sido activada!\n\nUsuario: ${account.username}\nContraseña: ${account.password}\n\nYa puedes acceder al servicio. Si tienes alguna duda, con gusto te ayudamos.`;

      await this.messengerPort.sendMessage(senderId, msg);
      return true;
    } catch (error) {
      this.logger.error(`Error activando suscripción para ${senderId}`, error);
      return false;
    }
  }

  // ── Helpers de IA ────────────────────────────────────────────────────────

  private async generateAiResponse(senderId: string, context: string): Promise<string> {
    const history = this.conversationStore.getHistory(senderId);
    return this.aiProviderPort.generateResponse(history, this.buildSystemPrompt(context));
  }

  private buildSystemPrompt(paymentContext: string): string {
    return `Eres un asistente de atención al cliente para ${SERVICE_INFO.businessName}.
Actúa de manera natural, amigable y profesional, como si fueras un empleado real.
Responde SIEMPRE en el mismo idioma que usa el cliente.
Sé conciso pero completo. No uses lenguaje robótico.
FORMATO: Estás en Facebook Messenger. NUNCA uses Markdown. No uses **negritas**, no uses [texto](url), no uses # títulos. Para links escribe la URL directa: https://ejemplo.com

=== INFORMACIÓN DEL NEGOCIO ===
${SERVICE_INFO.description}

=== SERVICIOS Y PRECIOS ===
${SERVICE_INFO.services}

=== HORARIOS ===
${SERVICE_INFO.schedule}

=== UBICACIÓN Y CONTACTO ===
${SERVICE_INFO.location}

=== DISPOSITIVOS COMPATIBLES ===
${SERVICE_INFO.compatibleDevices}

=== MÉTODOS DE PAGO ACEPTADOS ===
${SERVICE_INFO.paymentMethods}

=== PROGRAMA DE REFERIDOS ===
${SERVICE_INFO.referralProgram}

=== DEMO GRATUITA ===
${SERVICE_INFO.demo}

=== LÍMITE DE CONOCIMIENTO ===
SOLO puedes responder sobre: planes y precios, dispositivos compatibles, métodos de pago, programa de referidos, demo gratuita, horarios, contacto y soporte técnico básico.
Si el cliente pregunta algo no relacionado con el servicio, responde amablemente que solo puedes ayudar con temas de Connect World.

=== INSTRUCCIONES ESPECIALES ===
- Planes: explica Básico, Estándar, Premium con precios y dirígelos a: https://connect-world.it.com/
- Dispositivos: menciona opciones disponibles y ofrece ayuda con instalación.
- Demo: el sistema guiará al cliente — no prometas activarla tú mismo.
- Referidos: explica recompensas y que el código es su nombre de usuario.
- Problemas técnicos: pide el dispositivo y da pasos básicos. Si persiste: connectworld2008@gmail.com
- NUNCA inventes información que no esté en este prompt.
- NUNCA confirmes un pago sin el resultado VERIFICADO en el contexto.
- Mantén un tono cálido, humano y conciso.
${paymentContext}`;
  }
}
