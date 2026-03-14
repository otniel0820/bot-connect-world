import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegStatic from 'ffmpeg-static';
import { AiProviderPort, AiMessage } from '../../../domain/ports/ai-provider.port';

ffmpeg.setFfmpegPath(ffmpegStatic as unknown as string);

const COMPROBANTE_PROMPT = `Eres un sistema de extracción de datos de comprobantes de pago de Stripe.
Analiza la imagen proporcionada y extrae la siguiente información en formato JSON:
{
  "paymentIntentId": "<ID de PaymentIntent de Stripe. IMPORTANTE: busca cualquier código alfanumérico largo en el comprobante que empiece con 'pi_' (p minúscula, i minúscula, guion bajo). Ten cuidado con errores de OCR: 'pl_', 'p1_', 'pI_', 'pi-' son probablemente 'pi_' mal leído. Si encuentras un código así, corrígelo y devuélvelo con el prefijo 'pi_'. Ejemplo: pi_3TAulLJEjd6Vy7BU1hpL11Dq>",
  "amount": <monto numérico en centavos enteros, ej: 1500 para $15.00>,
  "currency": "<moneda en minúsculas, ej: usd>",
  "amountFormatted": "<monto como aparece en el comprobante, ej: $15.00>",
  "receiptNumber": "<número de recibo o referencia si aparece, distinto al paymentIntentId>",
  "date": "<fecha del pago si aparece>"
}
Si un campo no está presente en la imagen, usa null.
Responde SOLO con el JSON, sin texto adicional.`;

@Injectable()
export class OpenAiAdapter implements AiProviderPort {
  private readonly logger = new Logger(OpenAiAdapter.name);
  private readonly client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('openai.apiKey'),
    });
  }

  async generateResponse(messages: AiMessage[], systemPrompt: string): Promise<string> {
    const model = this.configService.get<string>('openai.model');
    const maxTokens = this.configService.get<number>('openai.maxTokens');

    try {
      const response = await this.client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Respuesta vacía de la API de OpenAI');
      return content;
    } catch (error) {
      this.logger.error('Error generando respuesta con OpenAI', error.message);
      throw error;
    }
  }

  async analyzePaymentImage(imageUrl: string): Promise<string> {
    const model = this.configService.get<string>('openai.model');

    try {
      // Descargar la imagen y convertir a base64 (evita problemas con CDNs privados como Facebook)
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const mimeType = imageResponse.headers['content-type'] ?? 'image/jpeg';
      const base64 = Buffer.from(imageResponse.data).toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const response = await this.client.chat.completions.create({
        model,
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: COMPROBANTE_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            ],
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Respuesta vacía al analizar imagen');
      return content;
    } catch (error) {
      this.logger.error('Error analizando imagen de comprobante', error.message);
      throw error;
    }
  }

  async transcribeAudio(audioUrl: string): Promise<string> {
    try {
      const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
      const mimeType: string = response.headers['content-type'] ?? 'audio/mpeg';
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'mp3';

      const buffer = Buffer.from(response.data);
      const file = await toFile(buffer, `audio.${ext}`, { type: mimeType });

      const transcription = await this.client.audio.transcriptions.create({
        model: 'whisper-1',
        file,
        language: 'es',
      });

      return transcription.text ?? '';
    } catch (error) {
      this.logger.error('Error transcribiendo audio', error.message);
      throw error;
    }
  }

  async extractVideoFrame(videoUrl: string): Promise<string | null> {
    const tmpVideo = path.join(os.tmpdir(), `video_${Date.now()}.mp4`);
    const tmpFrame = path.join(os.tmpdir(), `frame_${Date.now()}.jpg`);

    try {
      // Descargar video
      const response = await axios.get(videoUrl, { responseType: 'arraybuffer' });
      fs.writeFileSync(tmpVideo, Buffer.from(response.data));

      // Extraer primer frame con ffmpeg
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tmpVideo)
          .screenshots({ timestamps: [0], filename: path.basename(tmpFrame), folder: path.dirname(tmpFrame), size: '640x?' })
          .on('end', () => resolve())
          .on('error', reject);
      });

      // Convertir frame a base64
      const frameBuffer = fs.readFileSync(tmpFrame);
      return `data:image/jpeg;base64,${frameBuffer.toString('base64')}`;
    } catch (error) {
      this.logger.error('Error extrayendo frame del video', error.message);
      return null;
    } finally {
      if (fs.existsSync(tmpVideo)) fs.unlinkSync(tmpVideo);
      if (fs.existsSync(tmpFrame)) fs.unlinkSync(tmpFrame);
    }
  }
}
