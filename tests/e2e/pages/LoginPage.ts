import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { getFrontendUrl, getTenantCredentials } from "../../helpers/test-env";

const FRONTEND_URL = getFrontendUrl();

export class LoginPage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly appHeading: Locator;

  constructor(private readonly page: Page) {
    this.usernameInput = page.locator("#username");
    this.passwordInput = page.locator("#password");
    this.loginButton = page.locator("#kc-login");
    this.appHeading = page.getByText("Trouble Ticket System");
  }

  async goto(): Promise<void> {
    await this.page.goto(FRONTEND_URL);
    await this.page.waitForURL(/realms\/ttapi/);
    await expect(this.usernameInput).toBeVisible({ timeout: 10_000 });
  }

  async loginByTenant(tenantId: string): Promise<void> {
    const credentials = getTenantCredentials(tenantId);
    await this.loginAs(credentials.username, credentials.password);
  }

  async loginAs(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await this.page.waitForURL(`${FRONTEND_URL}/**`, { timeout: 15_000 });
    await expect(this.appHeading).toBeVisible();
  }
}
