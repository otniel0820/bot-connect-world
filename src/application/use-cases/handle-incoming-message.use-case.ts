import { Injectable, Logger } from '@nestjs/common';
import { MessengerPort } from '../../domain/ports/messenger.port';
import { AiProviderPort } from '../../domain/ports/ai-provider.port';
import { ConversationStore } from '../stores/conversation.store';
import { OrderRepositoryPort } from '../../domain/ports/order-repository.port';
import { CustomerRepositoryPort } from '../../domain/ports/customer-repository.port';
import { DemoRepositoryPort } from '../../domain/ports/demo-repository.port';
import { PanelUsernameRepositoryPort } from '../../domain/ports/panel-username-repository.port';
import { EmailPort } from '../../domain/ports/email.port';
import { ActivateAccountUseCase, PackageKey } from './activate-account.use-case';
import { PaymentLookupService } from '../services/payment-lookup.service';
import { DemoFlowService } from '../services/demo-flow.service';
import { BotControlService } from '../services/bot-control.service';
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
    private readonly demoRepo: DemoRepositoryPort,
    private readonly panelUsernameRepo: PanelUsernameRepositoryPort,
    private readonly emailPort: EmailPort,
    private readonly activateAccountUseCase: ActivateAccountUseCase,
    private readonly paymentLookup: PaymentLookupService,
    private readonly demoFlow: DemoFlowService,
    private readonly botControlService: BotControlService,
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

    // Si hay imagen que no es comprobante, analizarla y añadirla al contexto
    let imageContext = '';
    if (imageUrl) {
      try {
        const description = await this.aiProviderPort.describeImage(imageUrl);
        this.logger.log(`Imagen analizada de ${senderId}: ${description.substring(0, 100)}`);
        imageContext = `[El cliente envió una imagen. Contenido: ${description}]`;
      } catch {
        this.logger.warn(`No se pudo analizar imagen de ${senderId}`);
      }
    }

    const userContent = imageContext
      ? `${messageText ? messageText + '\n' : ''}${imageContext}`.trim()
      : messageText;

    this.conversationStore.addMessage(senderId, { role: 'user', content: userContent });

    // Buscar perfil del cliente para personalizar respuestas
    const customer = await this.customerRepo.findByFacebookId(senderId).catch(() => null);
    const isActiveCustomer = customer
      ? await this.panelUsernameRepo.hasAny(customer.id).catch(() => false)
      : false;

    let paymentContext = '';

    if (DEMO_REGEX.test(messageText)) {
      this.logger.log(`Solicitud de demo de ${senderId}`);

      if (!this.botControlService.getSettings().demos_enabled) {
        this.logger.log(`Demos desactivadas — rechazando solicitud de ${senderId}`);
        await this.messengerPort.sendTypingOff(senderId);
        await this.messengerPort.sendMessage(
          senderId,
          'En este momento las demos están temporalmente desactivadas. Si deseas acceder al servicio, puedes adquirir uno de nuestros planes directamente. ¡Con gusto te ayudamos!',
        );
        return;
      }

      // Verificar si el usuario ya tuvo una demo anterior
      const existingDemo = await this.demoRepo.findByFacebookUserId(senderId);
      if (existingDemo) {
        this.logger.log(`Usuario ${senderId} ya tiene demo (${existingDemo.packageName}) — enviando mensaje de planes`);
        await this.messengerPort.sendTypingOff(senderId);
        await this.messengerPort.sendMessage(
          senderId,
          `Hola! Ya tuviste la oportunidad de probar nuestra demo gratuita anteriormente, esperamos que hayas disfrutado la experiencia y visto todo lo que Connect World tiene para ofrecer!\n\nLa demo es de uso unico por persona, pero la buena noticia es que ahora puedes contratar un plan y disfrutar del servicio completo sin limite de tiempo. Te comparto nuestros precios:\n\nPlan Basico - 1 dispositivo\n1 mes: $10 | 3 meses: $30 | 6 meses: $60 | 12 meses: $120\n\nPlan Estandar - 2 dispositivos\n1 mes: $15 | 3 meses: $35 | 6 meses: $70 | 12 meses: $140\n\nPlan Premium - 3 dispositivos\n1 mes: $15 | 3 meses: $45 | 6 meses: $90 | 12 meses: $149\n\nPuedes contratar tu plan directamente en: https://connect-world.it.com/\n\nCualquier pregunta con gusto te ayudo!`,
        );
        this.logger.log(`Mensaje de planes enviado a ${senderId}`);
        return;
      }

      // Analizar sentimiento para determinar duración de la demo
      const history = this.conversationStore.getHistory(senderId);
      const duration = await this.aiProviderPort.analyzeSentiment(history);
      this.conversationStore.setDemoDuration(senderId, duration);
      this.logger.log(`Duración de demo asignada para ${senderId}: ${duration}`);

      this.conversationStore.setPaymentState(senderId, 'awaiting_device_demo');

      // Si ya viene el dispositivo en el mismo mensaje, procesarlo directo
      const text = messageText.toLowerCase();
      if (SERVICE_INFO.deviceDownloads.some((d) => d.keywords.some((kw) => text.includes(kw)))) {
        await this.demoFlow.processDevice(senderId, messageText);
        return;
      }

      const demoLabel = duration === '3h' ? '3 horas' : '1 hora';
      paymentContext = `
[INSTRUCCIÓN INTERNA - DEMO SOLICITADA]
El cliente calificó para una demo gratuita de ${demoLabel}.
ACCIÓN REQUERIDA: Explica brevemente la demo (${demoLabel} gratis, acceso completo, sin datos de pago) y pregúntale en qué dispositivo le gustaría probarla.
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
    const response = await this.aiProviderPort.generateResponse(history, this.buildSystemPrompt(paymentContext, isActiveCustomer, customer?.name));

    // Detectar marcador de escalación
    const escalateMatch = response.match(/^\[ESCALAR:\s*(.+?)\]/i);
    if (escalateMatch) {
      const reason = escalateMatch[1].trim();
      this.logger.log(`Escalación detectada para ${senderId}: ${reason}`);

      // Enviar email al admin con el contexto completo
      await this.emailPort.sendEscalation({
        facebookUserId: senderId,
        customerName: customer?.name,
        reason,
        conversationHistory: history,
      });

      // Responder al cliente de forma humana sin revelar que es un bot
      const escalationMsg = 'Entiendo, déjame comunicarte con el agente de soporte encargado de esta área. Él te contactará en breve, puede tomar unos minutos. Queda en buenas manos!';
      this.conversationStore.addMessage(senderId, { role: 'assistant', content: escalationMsg });
      await this.messengerPort.sendTypingOff(senderId);
      await this.messengerPort.sendMessage(senderId, escalationMsg);
      return;
    }

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

      const isRenewal = order.isRenewal;

      // Para renovaciones: buscar el username exacto desde la orden (seleccionado por el usuario en la landing)
      let usernameToRenew: string | undefined;
      if (isRenewal && order.panelUsernameId) {
        const panelUsernameDoc = await this.panelUsernameRepo.findById(order.panelUsernameId);
        usernameToRenew = panelUsernameDoc?.username;
        this.logger.log(`Renovación para ${customer.name} | username: ${usernameToRenew ?? 'no encontrado'}`);
      } else if (isRenewal && !order.panelUsernameId) {
        // Renovación sin username seleccionado: buscar el único username activo del customer
        const existingUsernames = await this.panelUsernameRepo.findByCustomerId(order.customerId);
        usernameToRenew = existingUsernames[existingUsernames.length - 1]?.username;
        this.logger.log(`Renovación sin panel_username_id para ${customer.name} | fallback username: ${usernameToRenew ?? 'ninguno'}`);
      }

      this.logger.log(`${isRenewal ? 'Renovación' : 'Nueva suscripción'} para ${customer.name} | ${packageKey}${usernameToRenew ? ` | username: ${usernameToRenew}` : ''}`);

      const { renewals_enabled, new_activations_enabled } = this.botControlService.getSettings();

      if (isRenewal && !renewals_enabled) {
        this.logger.log(`Renovaciones desactivadas — no se procesará renovación para ${senderId}`);
        await this.messengerPort.sendMessage(
          senderId,
          'Tu pago fue recibido. En este momento las renovaciones automáticas están temporalmente desactivadas. Un agente procesará tu renovación manualmente en breve. Disculpa el inconveniente.',
        );
        return false;
      }

      if (!isRenewal && !new_activations_enabled) {
        this.logger.log(`Nuevas activaciones desactivadas — no se procesará activación para ${senderId}`);
        await this.messengerPort.sendMessage(
          senderId,
          'Tu pago fue recibido. En este momento las activaciones automáticas de nuevas cuentas están temporalmente desactivadas. Un agente activará tu cuenta manualmente en breve. Disculpa el inconveniente.',
        );
        return false;
      }

      const account = await this.activateAccountUseCase.execute(
        customer.name,
        packageKey,
        undefined,
        usernameToRenew,
      );

      // Actualizar facebook_id del customer
      await this.customerRepo.updateFacebookId(order.customerId, senderId);

      // Para nuevas activaciones: crear PanelUsername doc y enlazarlo a la orden
      if (!isRenewal) {
        const panelUsernameDoc = await this.panelUsernameRepo.create(order.customerId, account.username);
        await this.orderRepo.setPanelUsernameId(order.id, panelUsernameDoc.id);
      }

      const credentialsNote = `\n\nImportante: escribe el usuario y la contraseña exactamente como aparecen aquí, respetando mayúsculas, minúsculas y cualquier número o símbolo. Un error de tipeo es la causa más común de que no entre. Si tienes algún problema para ingresar, cuéntame qué te aparece en pantalla y con gusto te ayudo.`;
      const msg = isRenewal
        ? `Tu suscripción ha sido renovada!\n\nUsuario: ${account.username}\nContraseña: ${account.password}${credentialsNote}`
        : `Tu suscripción ha sido activada!\n\nUsuario: ${account.username}\nContraseña: ${account.password}${credentialsNote}`;

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

  private buildSystemPrompt(paymentContext: string, isActiveCustomer = false, customerName?: string): string {
    const customerContext = isActiveCustomer
      ? `\n=== PERFIL DEL USUARIO ===\nEs un cliente activo con suscripción vigente${customerName ? ` (nombre: ${customerName})` : ''}. Trátalo con familiaridad y prioridad. Si reporta un problema técnico, atiéndelo como cliente. Si pide contenido que no encuentra, trátalo como solicitud de un suscriptor activo.\n`
      : `\n=== PERFIL DEL USUARIO ===\nNo es cliente activo todavía${customerName ? ` (nombre registrado: ${customerName})` : ''}. Puede ser un prospecto o alguien evaluando el servicio. Si pide contenido que no encuentra, atiéndelo igual de bien pero aprovecha para mencionar que con una suscripción tendrá acceso a todo el catálogo.\n`;

    return `Eres un asistente de atención al cliente para ${SERVICE_INFO.businessName}.
Actúa de manera natural, amigable y profesional, como si fueras un empleado real.
Responde SIEMPRE en el mismo idioma que usa el cliente.
Sé conciso pero completo. No uses lenguaje robótico.
FORMATO: Estás en Facebook Messenger. NUNCA uses Markdown. No uses **negritas**, no uses [texto](url), no uses # títulos. Para links escribe la URL directa: https://ejemplo.com
${customerContext}
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

=== SOPORTE TÉCNICO ===
${SERVICE_INFO.technicalSupport}

=== LÍMITE DE CONOCIMIENTO ===
SOLO puedes responder sobre: planes y precios, dispositivos compatibles, métodos de pago, programa de referidos, demo gratuita, horarios, contacto y soporte técnico.
Si el cliente pregunta algo no relacionado con el servicio, responde amablemente que solo puedes ayudar con temas de Connect World.

=== INSTRUCCIONES ESPECIALES ===
- Planes: explica Básico, Estándar, Premium con precios y dirígelos a: https://connect-world.it.com/
- Dispositivos: menciona opciones disponibles y ofrece ayuda con instalación.
- Demo: el sistema guiará al cliente — no prometas activarla tú mismo.
- Referidos: explica recompensas y que el código es su nombre de usuario.
- Soporte técnico: sigue la guía de diagnóstico por pasos. Haz las preguntas de una en una, nunca como lista. Sé empático.
- NUNCA inventes información que no esté en este prompt.
- NUNCA confirmes un pago sin el resultado VERIFICADO en el contexto.
- NUNCA le digas al cliente que envíe un correo ni que contacte soporte por email. NUNCA menciones ninguna dirección de email al cliente.
- Cuando no puedas resolver algo o esté fuera de tu conocimiento: responde ÚNICAMENTE con [ESCALAR: descripción breve del problema], sin ningún otro texto. El sistema conectará al cliente con un agente humano automáticamente.
- Mantén un tono cálido, humano y conciso.
${paymentContext}`;
  }
}
