import { Injectable } from '@nestjs/common';
import { AiMessage } from '../../domain/ports/ai-provider.port';

const MAX_HISTORY = 20;
const TTL_MS = 30 * 60 * 1000; // 30 minutos

export type PaymentState = 'idle' | 'awaiting_comprobante' | 'awaiting_device_demo' | 'awaiting_tv_brand' | 'awaiting_name_for_demo';

interface ConversationEntry {
  messages: AiMessage[];
  lastActivity: number;
  paymentState: PaymentState;
}

@Injectable()
export class ConversationStore {
  private readonly store = new Map<string, ConversationEntry>();

  getHistory(userId: string): AiMessage[] {
    this.cleanup();
    const entry = this.store.get(userId);
    if (!entry) return [];
    return entry.messages;
  }

  addMessage(userId: string, message: AiMessage): void {
    const entry = this.store.get(userId) ?? {
      messages: [],
      lastActivity: Date.now(),
      paymentState: 'idle' as PaymentState,
    };
    entry.messages.push(message);
    entry.lastActivity = Date.now();

    if (entry.messages.length > MAX_HISTORY) {
      entry.messages = entry.messages.slice(-MAX_HISTORY);
    }

    this.store.set(userId, entry);
  }

  getPaymentState(userId: string): PaymentState {
    return this.store.get(userId)?.paymentState ?? 'idle';
  }

  setPaymentState(userId: string, state: PaymentState): void {
    const entry = this.store.get(userId) ?? {
      messages: [],
      lastActivity: Date.now(),
      paymentState: 'idle' as PaymentState,
    };
    entry.paymentState = state;
    entry.lastActivity = Date.now();
    this.store.set(userId, entry);
  }

  clearHistory(userId: string): void {
    this.store.delete(userId);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [userId, entry] of this.store.entries()) {
      if (now - entry.lastActivity > TTL_MS) {
        this.store.delete(userId);
      }
    }
  }
}
