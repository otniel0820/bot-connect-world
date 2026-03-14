export abstract class MessengerPort {
  abstract sendMessage(recipientId: string, text: string): Promise<void>;
  abstract sendImage(recipientId: string, imageUrl: string): Promise<void>;
  abstract sendTypingOn(recipientId: string): Promise<void>;
  abstract sendTypingOff(recipientId: string): Promise<void>;
}
