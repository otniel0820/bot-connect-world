import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { PanelPort, CreatedPanelUser } from '../../../domain/ports/panel.port';

@Injectable()
export class IptvPanelAdapter implements PanelPort {
  private readonly logger = new Logger(IptvPanelAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async createUser(fullname: string, packageName: string): Promise<CreatedPanelUser> {
    const loginUrl  = this.configService.get<string>('panel.url'); // .../login.php
    const username  = this.configService.get<string>('panel.username');
    const password  = this.configService.get<string>('panel.password');
    const loginKey  = this.configService.get<string>('panel.loginKey');
    const baseUrl   = loginUrl.replace(/\/[^/]+$/, ''); // http://moonspelltools.cc:2082

    const generatedUsername = this.generateUsername(fullname);
    this.logger.log(`Creando usuario: ${generatedUsername} | paquete: ${packageName}`);

    let browser: Browser | null = null;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      const page = await browser.newPage();
      page.setDefaultTimeout(30000);

      // ── 1. LOGIN ──────────────────────────────────────────────────────────
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
      this.logger.log('Página de login cargada');

      await page.waitForSelector('input[name="username"]', { visible: true, timeout: 15000 });

      // Limpiar y llenar campos de login
      await page.click('input[name="username"]', { clickCount: 3 });
      await page.type('input[name="username"]', username, { delay: 60 });
      await page.click('input[name="password"]', { clickCount: 3 });
      await page.type('input[name="password"]', password, { delay: 60 });
      await page.click('input[name="login_key"]', { clickCount: 3 });
      await page.type('input[name="login_key"]', loginKey, { delay: 60 });

      // Click submit y esperar que la URL cambie
      await page.click('button[type="submit"], input[type="submit"]');
      await page.waitForFunction(
        () => !window.location.href.includes('login.php'),
        { timeout: 20000 },
      );

      await new Promise(r => setTimeout(r, 500));
      this.logger.log(`URL tras login: ${page.url()}`);

      // ── 2. NAVEGAR A ADD USER ─────────────────────────────────────────────
      const addUserUrl = `${baseUrl}/index.php/users/Form?t=add`;
      this.logger.log(`Navegando a: ${addUserUrl}`);
      await page.goto(addUserUrl, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 3000));

      // Log de campos para debug (siempre, sin esperar condición)
      const fields = await page.evaluate(() =>
        Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
          tag: el.tagName,
          name: (el as HTMLInputElement).name,
          id: el.id,
          type: (el as HTMLInputElement).type,
          placeholder: (el as HTMLInputElement).placeholder,
          disabled: (el as HTMLInputElement).disabled,
          value: (el as HTMLInputElement).value,
        })),
      );
      this.logger.log(`Campos en Add User: ${JSON.stringify(fields)}`);
      this.logger.log(`URL Add User: ${page.url()}`);

      // ── 3. LLENAR FORMULARIO ──────────────────────────────────────────────
      await this.fillField(page, fullname, ['input[name="fullname"]'], 'Fullname');
      await this.fillField(page, generatedUsername, ['input[name="username"]'], 'Username');

      // Package — select por id="package"
      const packageSelected = await page.evaluate((pkgName: string) => {
        const select = document.querySelector<HTMLSelectElement>('#package, select[name="package"]');
        if (!select) return { found: false, options: [] };
        const options = Array.from(select.options);
        const option = options.find(o => o.text.trim().toLowerCase().includes(pkgName.toLowerCase()));
        if (option) {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return { found: true, value: option.value, text: option.text, options: [] };
        }
        return { found: false, options: options.map(o => o.text.trim()) };
      }, packageName);

      this.logger.log(`Package seleccionado: ${JSON.stringify(packageSelected)}`);

      if (!packageSelected.found) {
        this.logger.warn(`Paquete "${packageName}" no encontrado. Opciones: ${JSON.stringify(packageSelected.options)}`);
        throw new Error(`Paquete no encontrado: ${packageName}`);
      }

      await new Promise(r => setTimeout(r, 500));

      // ── 4. GUARDAR (omitido en development) ───────────────────────────────
      const isDev = this.configService.get<string>('NODE_ENV') === 'development';

      if (isDev) {
        this.logger.log('──────────────────────────────────────────────');
        this.logger.log('[DEV MODE] Formulario llenado — submit OMITIDO para no gastar créditos');
        this.logger.log(`[DEV MODE] Usuario simulado: ${generatedUsername}`);
        this.logger.log(`[DEV MODE] Nombre completo: ${fullname}`);
        this.logger.log(`[DEV MODE] Plan activado: ${packageName}`);
        this.logger.log('──────────────────────────────────────────────');
        return { fullname, username: generatedUsername, password: 'dev-mode-no-password', package: packageName };
      }

      this.logger.log('Formulario llenado, guardando...');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        page.evaluate(() => {
          const form = document.querySelector<HTMLFormElement>('#frmUsers');
          if (form) form.submit();
        }),
      ]);

      await new Promise(r => setTimeout(r, 3000));
      this.logger.log(`URL tras guardar: ${page.url()}`);

      // ── 5. OBTENER CONTRASEÑA ─────────────────────────────────────────────
      const createdPassword = await this.extractPassword(page, baseUrl, generatedUsername);
      this.logger.log(`Usuario creado: ${generatedUsername} | pass: ${createdPassword}`);

      return { fullname, username: generatedUsername, password: createdPassword, package: packageName };

    } finally {
      if (browser) await browser.close();
    }
  }

  async renewUser(username: string, packageName: string): Promise<CreatedPanelUser> {
    const loginUrl = this.configService.get<string>('panel.url');
    const adminUser = this.configService.get<string>('panel.username');
    const adminPass = this.configService.get<string>('panel.password');
    const loginKey  = this.configService.get<string>('panel.loginKey');
    const baseUrl   = loginUrl.replace(/\/[^/]+$/, '');
    const isDev     = this.configService.get<string>('NODE_ENV') === 'development';

    this.logger.log(`Renovando usuario: ${username} | paquete: ${packageName}`);

    let browser: Browser | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      page.setDefaultTimeout(30000);

      // ── 1. LOGIN ──────────────────────────────────────────────────────────
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('input[name="username"]', { visible: true, timeout: 15000 });
      await page.click('input[name="username"]', { clickCount: 3 });
      await page.type('input[name="username"]', adminUser, { delay: 60 });
      await page.click('input[name="password"]', { clickCount: 3 });
      await page.type('input[name="password"]', adminPass, { delay: 60 });
      await page.click('input[name="login_key"]', { clickCount: 3 });
      await page.type('input[name="login_key"]', loginKey, { delay: 60 });
      await page.click('button[type="submit"], input[type="submit"]');
      await page.waitForFunction(() => !window.location.href.includes('login.php'), { timeout: 20000 });
      await new Promise(r => setTimeout(r, 500));
      this.logger.log(`URL tras login: ${page.url()}`);

      // ── 2. BUSCAR USUARIO ─────────────────────────────────────────────────
      await page.goto(`${baseUrl}/index.php/users/index`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 1500));

      await page.evaluate((uname: string) => {
        const input = document.querySelector<HTMLInputElement>('input[placeholder*="Username"], input[name="username"]');
        if (input) input.value = uname;
      }, username);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
        page.click('button[type="submit"], input[type="submit"], button.btn-success'),
      ]);
      await new Promise(r => setTimeout(r, 1000));
      this.logger.log(`Búsqueda completada para: ${username}`);

      // ── 3. CLICK DIRECTO EN EL BOTÓN "C" DE LA COLUMNA EXPIRE ───────────
      // El panel tiene un botón de renovación directamente en la columna Expire (botón verde "C")
      const rowFound = await page.evaluate((uname: string) => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells[3]?.textContent?.trim() === uname) {
            // Buscar el botón de renovar en la columna Expire (índice 8)
            const expireCell = cells[8];
            if (expireCell) {
              const renewBtn = expireCell.querySelector<HTMLElement>('a, button');
              if (renewBtn) {
                renewBtn.click();
                return { found: true, method: 'expire-button' };
              }
            }
            // Fallback: dropdown de opciones
            const dropdownToggle = row.querySelector<HTMLElement>('[data-toggle="dropdown"], .dropdown-toggle');
            if (dropdownToggle) {
              dropdownToggle.click();
              return { found: true, method: 'dropdown' };
            }
          }
        }
        return { found: false, method: '' };
      }, username);

      if (!rowFound.found) throw new Error(`Usuario "${username}" no encontrado en el panel`);
      this.logger.log(`Botón de renovar clickeado para: ${username} (método: ${rowFound.method})`);
      await new Promise(r => setTimeout(r, 500));

      // Si se usó el dropdown como fallback, buscar y clickar "Renew User"
      if (rowFound.method === 'dropdown') {
        const renewClicked = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('.dropdown-menu a, .dropdown-menu li a'));
          const renewItem = items.find(el => el.textContent?.trim().toLowerCase().includes('renew user'));
          if (renewItem) { (renewItem as HTMLElement).click(); return true; }
          return false;
        });
        if (!renewClicked) throw new Error('Opción "Renew User" no encontrada en el dropdown');
        this.logger.log('Click en "Renew User" realizado (vía dropdown fallback)');
      }

      // ── 4. ESPERAR EL MODAL DE RENOVACIÓN ────────────────────────────────
      await page.waitForSelector('.modal.in, .modal[style*="display: block"], .modal[style*="display:block"]', { timeout: 8000 });
      await new Promise(r => setTimeout(r, 600));
      this.logger.log('Modal de renovación abierto');

      // ── 5. SELECCIONAR PAQUETE EN EL MODAL ───────────────────────────────
      const packageSelected = await page.evaluate((pkgName: string) => {
        // El modal tiene su propio select de paquetes
        const modals = Array.from(document.querySelectorAll('.modal.in, .modal[style*="display: block"], .modal[style*="display:block"]'));
        const modal = modals[0] ?? document;
        const select = modal.querySelector<HTMLSelectElement>('select[name="package"], select');
        if (!select) return { found: false, options: [] as string[] };
        const options = Array.from(select.options);
        const option = options.find(o => o.text.trim().toLowerCase().includes(pkgName.toLowerCase()));
        if (option) {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return { found: true, value: option.value, text: option.text };
        }
        return { found: false, options: options.map(o => o.text.trim()) };
      }, packageName);

      if (!packageSelected.found) throw new Error(`Paquete no encontrado: ${packageName}`);
      this.logger.log(`Paquete seleccionado en modal: ${JSON.stringify(packageSelected)}`);
      await new Promise(r => setTimeout(r, 500));

      // ── 6. DEV MODE: no enviar el formulario ──────────────────────────────
      if (isDev) {
        this.logger.log('──────────────────────────────────────────────');
        this.logger.log('[DEV MODE] Modal de renovación llenado — submit OMITIDO para no gastar créditos');
        this.logger.log(`[DEV MODE] Usuario renovado (simulado): ${username}`);
        this.logger.log(`[DEV MODE] Plan renovado: ${packageName}`);
        this.logger.log('──────────────────────────────────────────────');
        return { fullname: username, username, password: 'dev-mode-no-password', package: packageName };
      }

      // ── 7. CLICAR "RENEW NOW" ─────────────────────────────────────────────
      await page.evaluate(() => {
        const modals = Array.from(document.querySelectorAll('.modal.in, .modal[style*="display: block"], .modal[style*="display:block"]'));
        const modal = modals[0] ?? document;
        const btns = Array.from(modal.querySelectorAll('button, input[type="submit"], input[type="button"]'));
        const renewBtn = btns.find(b =>
          b.textContent?.trim().toLowerCase().includes('renew now') ||
          (b as HTMLInputElement).value?.toLowerCase().includes('renew now')
        );
        if (renewBtn) (renewBtn as HTMLElement).click();
      });

      await new Promise(r => setTimeout(r, 3000));
      this.logger.log(`Renovación enviada para: ${username}`);

      // ── 8. OBTENER CONTRASEÑA ACTUAL ─────────────────────────────────────
      const currentPassword = await this.extractPassword(page, baseUrl, username);
      this.logger.log(`Renovación completada: ${username} | pass: ${currentPassword}`);

      return { fullname: username, username, password: currentPassword, package: packageName };

    } finally {
      if (browser) await browser.close();
    }
  }

  private async fillField(page: Page, value: string, selectors: string[], label: string): Promise<void> {
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await page.click(sel, { clickCount: 3 });
          await page.type(sel, value, { delay: 50 });
          this.logger.log(`${label} llenado con selector: ${sel}`);
          return;
        }
      } catch {}
    }
    throw new Error(`No se encontró campo ${label}. Selectores: ${selectors.join(', ')}`);
  }

  private async extractPassword(page: Page, baseUrl: string, username: string): Promise<string> {
    try {
      // Navegar a la lista de usuarios y buscar por username exacto
      await page.goto(`${baseUrl}/index.php/users/index`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 1500));

      // Llenar el campo de búsqueda de username y buscar
      await page.evaluate((uname: string) => {
        const input = document.querySelector<HTMLInputElement>('input[placeholder*="Username"], input[name="username"]');
        if (input) { input.value = uname; }
      }, username);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
        page.click('button[type="submit"], input[type="submit"], button.btn-success'),
      ]);
      await new Promise(r => setTimeout(r, 1000));

      // Leer la contraseña de la primera fila que coincida con el username
      const pwd = await page.evaluate((uname: string) => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          // Columnas: ID(0), icon(1), Reseller(2), Username(3), Password(4)
          const usernameCell = cells[3]?.textContent?.trim();
          const passwordCell = cells[4]?.textContent?.trim();
          if (usernameCell === uname && passwordCell && passwordCell.length >= 4) {
            return passwordCell;
          }
        }
        return null;
      }, username);

      this.logger.log(`Contraseña extraída: ${pwd}`);
      return pwd ?? '(ver contraseña en el panel)';
    } catch (e) {
      this.logger.warn(`No se pudo extraer contraseña: ${e.message}`);
      return '(ver contraseña en el panel)';
    }
  }

  private generateUsername(fullname: string): string {
    const base = fullname
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10);
    return `${base}${Math.floor(100 + Math.random() * 900)}`;
  }
}
