import { Injectable, Logger } from '@nestjs/common';
import { PanelPort, CreatedPanelUser } from '../../domain/ports/panel.port';
import { DemoRepositoryPort } from '../../domain/ports/demo-repository.port';

// Mapeo de paquetes del panel por tipo
export const PANEL_PACKAGES = {
  demo:         'Completo - Full Demo 1hr',
  basic_1m:     '1 Conexion - Full 1 Months [Credit: 1]',
  basic_3m:     '1 Conexion - Full 3 Months [Credit: 3]',
  basic_6m:     '1 Conexion - Full 6 Months [Credit: 6]',
  basic_12m:    '1 Conexion - Full 12 Months [Credit: 12]',
  standard_1m:  '2 Conexiones - Full 1 Mes [Credit: 1]',
  standard_3m:  '2 Conexiones - Full 3 Mes [Credit: 3]',
  standard_6m:  '2 Conexiones - Full 6 Mes [Credit: 6]',
  standard_12m: '2 Conexiones - Full 12 Months [Credit: 12]',
  premium_1m:   '3 Conexiones - Full 1 Mes [Credit: 1]',
  premium_3m:   '3 Conexiones - Full 3 Mes [Credit: 3]',
  premium_6m:   '3 Conexiones - Full 6 Mes [Credit: 6]',
  premium_12m:  '3 Conexiones - Full 12 Mes [Credit: 12]',
} as const;

export type PackageKey = keyof typeof PANEL_PACKAGES;

@Injectable()
export class ActivateAccountUseCase {
  private readonly logger = new Logger(ActivateAccountUseCase.name);

  constructor(
    private readonly panelPort: PanelPort,
    private readonly demoRepo: DemoRepositoryPort,
  ) {}

  async execute(
    fullname: string,
    packageKey: PackageKey,
    facebookUserId?: string,
    existingPanelUsername?: string,
  ): Promise<CreatedPanelUser> {
    const packageName = PANEL_PACKAGES[packageKey];

    let account: CreatedPanelUser;
    if (existingPanelUsername) {
      this.logger.log(`Renovando cuenta existente: ${existingPanelUsername} | paquete: ${packageName}`);
      account = await this.panelPort.renewUser(existingPanelUsername, packageName);
    } else {
      this.logger.log(`Creando nueva cuenta: ${fullname} | paquete: ${packageName}`);
      account = await this.panelPort.createUser(fullname, packageName);
    }

    if (facebookUserId && packageKey === 'demo') {
      const now = new Date();
      await this.demoRepo.save({
        facebookUserId,
        fullname,
        panelUsername: account.username,
        panelPassword: account.password,
        packageName,
        activatedAt: now,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      });
      this.logger.log(`Demo guardada en MongoDB para ${facebookUserId}`);
    }

    return account;
  }
}
