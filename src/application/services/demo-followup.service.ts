import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DemoRepositoryPort } from '../../domain/ports/demo-repository.port';
import { MessengerPort } from '../../domain/ports/messenger.port';

@Injectable()
export class DemoFollowUpService {
  private readonly logger = new Logger(DemoFollowUpService.name);

  constructor(
    private readonly demoRepo: DemoRepositoryPort,
    private readonly messengerPort: MessengerPort,
  ) {}

  @Cron('*/30 * * * *') // cada 30 minutos
  async checkExpiredDemos(): Promise<void> {
    const demos = await this.demoRepo.findPendingFollowUps();

    if (demos.length === 0) return;

    this.logger.log(`Follow-up pendiente para ${demos.length} demo(s)`);

    for (const demo of demos) {
      try {
        await this.messengerPort.sendMessage(
          demo.facebookUserId,
          `Hola ${demo.fullname}! Tu demo de 1 hora con Connect World ya terminó.\n\n¿Cómo te pareció la programación? Si te gustó el servicio, podemos activarte un plan completo hoy mismo.\n\nTenemos opciones desde 1 mes hasta 12 meses, con 1, 2 o 3 conexiones simultáneas. Escríbenos y te asesoramos sin compromiso!`,
        );
        await this.demoRepo.markFollowUpSent(demo.id);
        this.logger.log(`Follow-up enviado a ${demo.facebookUserId} (${demo.fullname})`);
      } catch (err) {
        this.logger.error(`Error enviando follow-up a ${demo.facebookUserId}: ${err.message}`);
      }
    }
  }
}
