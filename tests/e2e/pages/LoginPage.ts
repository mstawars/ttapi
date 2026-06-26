import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { getTenantCredentials } from '../../helpers/test-env';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(FRONTEND_URL);
    await this.page.waitForURL(/realms\/ttapi/);
    await expect(this.page.locator('#username')).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Loguje użytkownika danego tenanta na podstawie konfiguracji tenantów.
   * Credentials są pobierane z test-env.ts, które mogą pochodzić z .env lub defaults.
   *
   * @param tenantId - ID tenanta (np. 'alpha', 'beta', 'gamma')
   */
  async loginByTenant(tenantId: string): Promise<void> {
    const credentials = getTenantCredentials(tenantId);
    await this.loginAs(credentials.username, credentials.password);
  }

  /**
   * Niskopoziomowa metoda logowania z explicytic username/password.
   * Preferuj `loginByTenant()` dla testów.
   */
  async loginAs(username: string, password: string): Promise<void> {
    await this.page.locator('#username').fill(username);
    await this.page.locator('#password').fill(password);
    await this.page.locator('#kc-login').click();
    await this.page.waitForURL(`${FRONTEND_URL}/**`, { timeout: 15_000 });
    await expect(this.page.getByText('Trouble Ticket System')).toBeVisible();
  }
}
