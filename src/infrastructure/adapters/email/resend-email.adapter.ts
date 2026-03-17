import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailPort, EscalationEmailData } from '../../../domain/ports/email.port';

@Injectable()
export class ResendEmailAdapter implements EmailPort {
  private readonly logger = new Logger(ResendEmailAdapter.name);
  private readonly resend: Resend;
  private readonly adminEmail: string;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('email.resendApiKey');
    this.resend = new Resend(apiKey || 'placeholder_configure_resend_api_key');
    this.adminEmail = this.configService.get<string>('email.adminEmail');
    this.fromEmail = this.configService.get<string>('email.fromEmail');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY no configurada — los emails de escalación no se enviarán');
    }
  }

  async sendEscalation(data: EscalationEmailData): Promise<void> {
    const { facebookUserId, customerName, reason, conversationHistory } = data;

    const conversationHtml = conversationHistory
      .slice(-15)
      .map((m) => {
        const role = m.role === 'user' ? '👤 Cliente' : '🤖 Bot';
        const bg = m.role === 'user' ? '#f0f0f0' : '#e8f4fd';
        return `<div style="background:${bg};padding:10px 14px;margin:6px 0;border-radius:8px;font-size:14px;">
          <strong>${role}:</strong><br/>${m.content.replace(/\n/g, '<br/>')}
        </div>`;
      })
      .join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
        <h2 style="color:#7c3aed;margin-bottom:4px;">⚠️ Escalación de Soporte — Connect World</h2>
        <p style="color:#666;margin-top:0;font-size:13px;">Un cliente necesita atención humana</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr><td style="padding:8px;font-weight:bold;width:160px;">Facebook ID:</td><td style="padding:8px;">${facebookUserId}</td></tr>
          ${customerName ? `<tr><td style="padding:8px;font-weight:bold;">Cliente:</td><td style="padding:8px;">${customerName}</td></tr>` : ''}
          <tr><td style="padding:8px;font-weight:bold;">Motivo:</td><td style="padding:8px;color:#dc2626;">${reason}</td></tr>
        </table>

        <h3 style="color:#374151;margin-bottom:8px;">Últimos mensajes de la conversación:</h3>
        ${conversationHtml}

        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;"/>
        <p style="font-size:12px;color:#9ca3af;">
          El cliente fue informado de que un agente lo contactará en breve.<br/>
          Responde lo antes posible para mantener una buena experiencia.
        </p>
      </div>
    `;

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: this.adminEmail,
        subject: `⚠️ Escalación: ${reason.substring(0, 60)}`,
        html,
      });
      this.logger.log(`Email de escalación enviado para ${facebookUserId}: ${reason}`);
    } catch (error) {
      this.logger.error('Error enviando email de escalación', error.message);
      // No lanzar el error — la conversación no debe romperse si el email falla
    }
  }
}
