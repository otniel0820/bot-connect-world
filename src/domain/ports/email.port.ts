export interface EscalationEmailData {
  facebookUserId: string;
  customerName?: string;
  reason: string;
  conversationHistory: { role: string; content: string }[];
}

export abstract class EmailPort {
  abstract sendEscalation(data: EscalationEmailData): Promise<void>;
}
