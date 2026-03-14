export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export abstract class AiProviderPort {
  abstract generateResponse(
    messages: AiMessage[],
    systemPrompt: string,
  ): Promise<string>;

  abstract analyzePaymentImage(imageUrl: string): Promise<string>;

  abstract transcribeAudio(audioUrl: string): Promise<string>;

  abstract extractVideoFrame(videoUrl: string): Promise<string | null>;
}
