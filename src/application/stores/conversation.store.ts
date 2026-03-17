import { Injectable, Logger } from '@nestjs/common';
import { AiMessage } from '../../domain/ports/ai-provider.port';

const MAX_HISTORY = 20;
const TTL_MS = 30 * 60 * 1000; // 30 minutos

export type PaymentState = 'idle' | 'awaiting_comprobante' | 'awaiting_device_demo' | 'awaiting_tv_brand' | 'awaiting_name_for_demo';
export type DemoDuration = '1h' | '3h';

const HUMAN_TAKEOVER_TTL_MS = 30 * 60 * 1000; // 30 minutos sin mensaje del agente → bot retoma

interface ConversationEntry {
  messages: AiMessage[];
  lastActivity: number;
  paymentState: PaymentState;
  demoDuration?: DemoDuration;
  humanTakeover?: boolean;
  humanTakeoverAt?: number;
}

@Injectable()
export class ConversationStore {
  private readonly logger = new Logger(ConversationStore.name);
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

  isHumanTakeover(userId: string): boolean {
    const entry = this.store.get(userId);
    if (!entry?.humanTakeover) return false;
    // Verificar si expiró el TTL
    if (Date.now() - (entry.humanTakeoverAt ?? 0) > HUMAN_TAKEOVER_TTL_MS) {
      entry.humanTakeover = false;
      this.logger.log(`Human takeover expirado para ${userId} — bot retoma`);
      return false;
    }
    return true;
  }

  setHumanTakeover(userId: string, active: boolean): void {
    const entry = this.store.get(userId) ?? {
      messages: [],
      lastActivity: Date.now(),
      paymentState: 'idle' as PaymentState,
    };
    entry.humanTakeover = active;
    entry.humanTakeoverAt = active ? Date.now() : undefined;
    entry.lastActivity = Date.now();
    this.store.set(userId, entry);
  }

  getDemoDuration(userId: string): DemoDuration {
    return this.store.get(userId)?.demoDuration ?? '1h';
  }

  setDemoDuration(userId: string, duration: DemoDuration): void {
    const entry = this.store.get(userId) ?? {
      messages: [],
      lastActivity: Date.now(),
      paymentState: 'idle' as PaymentState,
    };
    entry.demoDuration = duration;
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
