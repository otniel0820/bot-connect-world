export type MessageRole = 'user' | 'assistant';

export interface ConversationMessage {
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface Conversation {
  userId: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}
