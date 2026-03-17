import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BotControlRepositoryPort, BotControlSettings } from '../../domain/ports/bot-control-repository.port';

const FALLBACK_POLL_MS = 10_000;

@Injectable()
export class BotControlService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotControlService.name);
  private settings: BotControlSettings = {
    bot_enabled: true,
    demos_enabled: true,
    renewals_enabled: true,
    new_activations_enabled: true,
  };
  private closeStream: (() => Promise<void>) | null = null;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(private readonly botControlRepo: BotControlRepositoryPort) {}

  async onModuleInit(): Promise<void> {
    this.settings = await this.botControlRepo.getSettings();
    this.logger.log(`Config inicial del bot cargada: ${JSON.stringify(this.settings)}`);
    this.startChangeStream();
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeStream?.();
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  getSettings(): BotControlSettings {
    return this.settings;
  }

  private startChangeStream(): void {
    try {
      this.closeStream = this.botControlRepo.watchChanges(
        (updated) => {
          this.settings = updated;
          this.logger.log(`Config actualizada via change stream: ${JSON.stringify(updated)}`);
        },
        (err: any) => {
          // Cerrar el stream fallido y decidir qué hacer
          this.closeStream?.().catch(() => {});
          this.closeStream = null;

          if (err?.message?.includes('replica set') || err?.message?.includes('standalone')) {
            this.logger.warn('MongoDB standalone detectado — usando polling cada 10s como fallback');
            this.startPolling();
          } else {
            this.logger.error('Error inesperado en change stream de bot_control', err);
          }
        },
      );
    } catch (err: any) {
      this.logger.warn('No se pudo iniciar change stream — usando polling cada 10s');
      this.startPolling();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(async () => {
      try {
        this.settings = await this.botControlRepo.getSettings();
      } catch (err) {
        this.logger.error('Error en polling de bot_control', err);
      }
    }, FALLBACK_POLL_MS);
  }
}
