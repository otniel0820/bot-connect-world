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

  abstract analyzeSentiment(messages: AiMessage[]): Promise<'1h' | '3h'>;

  abstract parseNameFromMessage(
    userMessage: string,
    conversationHistory: AiMessage[],
    demoDuration: string,
  ): Promise<{ isName: boolean; name?: string; response?: string }>;

  abstract describeImage(imageUrl: string): Promise<string>;
}
