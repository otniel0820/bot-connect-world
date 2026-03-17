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

  async describeImage(imageUrl: string): Promise<string> {
    const model = this.configService.get<string>('openai.model');

    try {
      let imageContent: string;

      if (imageUrl.startsWith('data:')) {
        imageContent = imageUrl;
      } else {
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const mimeType = imageResponse.headers['content-type'] ?? 'image/jpeg';
        const base64 = Buffer.from(imageResponse.data).toString('base64');
        imageContent = `data:${mimeType};base64,${base64}`;
      }

      const response = await this.client.chat.completions.create({
        model,
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Eres un agente de soporte técnico de un servicio de streaming IPTV. Analiza esta imagen que envió un cliente y describe de forma concisa y clara lo que muestra: si es un mensaje de error, qué dice exactamente; si es una pantalla de login, qué campos se ven y qué problema se nota; si es una pantalla de reproducción con problema, qué muestra. Sé específico con cualquier texto o código de error visible. Responde en español.`,
              },
              {
                type: 'image_url',
                image_url: { url: imageContent, detail: 'high' },
              },
            ],
          },
        ],
      });

      return response.choices[0]?.message?.content ?? 'No se pudo analizar la imagen.';
    } catch (error) {
      this.logger.error('Error describiendo imagen', error.message);
      return 'No se pudo analizar la imagen.';
    }
  }

  async parseNameFromMessage(
    userMessage: string,
    conversationHistory: AiMessage[],
    demoDuration: string,
  ): Promise<{ isName: boolean; name?: string; response?: string }> {
    const model = this.configService.get<string>('openai.model');

    const historyText = conversationHistory
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`)
      .join('\n');

    const prompt = `Eres un asistente de atención al cliente de Connect World (servicio IPTV). Estás en el paso donde acabas de pedirle al cliente su NOMBRE COMPLETO para activarle una demo gratuita de ${demoDuration}.

El cliente respondió: "${userMessage}"

Contexto reciente de la conversación:
${historyText}

Tu tarea: determinar si el cliente proporcionó su nombre completo real o si respondió otra cosa.

REGLAS:
- Un nombre válido: contiene al menos dos palabras que parecen un nombre y apellido (ej: "Juan Pérez", "María García López")
- NO es un nombre si: es una pregunta, una solicitud, una expresión de duda, pide cambiar la duración del demo, dice algo sin sentido, etc.
- Si el mensaje parece contener un nombre real aunque también incluya otras palabras, extrae solo el nombre.

Responde ÚNICAMENTE con este JSON (sin texto adicional):
{
  "isName": true o false,
  "name": "nombre extraído si isName es true, si no null",
  "response": "si isName es false, escribe aquí una respuesta natural, amigable (sin Markdown, sin asteriscos). La demo asignada es de ${demoDuration}. Sigue estas reglas según el caso: (1) Si el cliente pide más tiempo o dice que ${demoDuration} es poco: explícale de forma amable pero firme y persuasiva que la demo de ${demoDuration} está diseñada para que pueda ver la calidad del servicio, la fluidez, los canales y todo lo que incluye — es más que suficiente para tomar una decisión con confianza. IMPORTANTE: nunca menciones que existe otra duración de demo distinta a ${demoDuration}. Menciona que si le gustó lo que vio, puede adquirir un plan desde precios muy accesibles y seguir disfrutando sin interrupciones. Dile que muchos clientes se decidieron en mucho menos tiempo. Luego pídele su nombre para activarle la demo. (2) Si no se entiende qué quiso decir: pídele de forma amable su nombre completo (nombre y apellido) para poder activarle la demo."
}`;

    try {
      const response = await this.client.chat.completions.create({
        model,
        max_tokens: 550,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.choices[0]?.message?.content?.trim() ?? '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No se encontró JSON en la respuesta');

      const parsed = JSON.parse(jsonMatch[0]);
      this.logger.log(`parseNameFromMessage → isName: ${parsed.isName}, name: ${parsed.name}`);
      return {
        isName: Boolean(parsed.isName),
        name: parsed.name ?? undefined,
        response: parsed.response ?? undefined,
      };
    } catch (error) {
      this.logger.error('Error en parseNameFromMessage', error.message);
      // Fallback conservador: no asumir que es un nombre
      return {
        isName: false,
        response: 'Disculpa, no pude identificar tu nombre. Por favor escribe tu nombre completo (nombre y apellido) para activarte la demo.',
      };
    }
  }

  async analyzeSentiment(messages: AiMessage[]): Promise<'1h' | '3h'> {
    const model = this.configService.get<string>('openai.model');

    const conversationText = messages
      .map((m) => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`)
      .join('\n');

    const prompt = `Analiza el estilo de escritura y tono del cliente en esta conversación y decide qué duración de demo darle.

CONVERSACIÓN:
${conversationText}

CRITERIOS PARA DAR 3 HORAS (cliente más comprometido):
- Escribe con buena ortografía y puntuación
- Sus mensajes son detallados y descriptivos (explica bien lo que quiere)
- Muestra interés genuino y entusiasmo (usa signos de exclamación, palabras como "excelente", "perfecto", "me interesa mucho")
- Hace preguntas específicas sobre planes, precios, dispositivos
- Usa lenguaje formal o semiformal
- Demuestra que ya investigó el servicio

CRITERIOS PARA DAR 1 HORA (cliente casual / exploratorio):
- Mensajes muy cortos o monosilábicos ("demo", "quiero probar", "ok")
- Escritura sin mayúsculas ni puntuación, muchos errores ortográficos
- Tono neutro o indiferente, sin señales de interés real
- Solo preguntó por la demo sin mostrar interés en comprar
- Primera interacción sin contexto previo

Si no hay historial suficiente para evaluar, devuelve "1h".

Responde ÚNICAMENTE con "1h" o "3h", sin explicación.`;

    try {
      const response = await this.client.chat.completions.create({
        model,
        max_tokens: 5,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      });

      const result = response.choices[0]?.message?.content?.trim();
      this.logger.log(`Análisis de sentimiento: ${result}`);
      return result === '3h' ? '3h' : '1h';
    } catch (error) {
      this.logger.error('Error en análisis de sentimiento, usando 1h por defecto', error.message);
      return '1h';
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
