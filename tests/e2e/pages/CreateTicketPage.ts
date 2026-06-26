import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export interface NewTicketData {
  externalId: string;
  serviceId: string;
  description: string;
}

export class CreateTicketPage {
  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.page.waitForURL(`${FRONTEND_URL}/tickets/new`);
    await expect(this.page.getByText('Nowe zgłoszenie')).toBeVisible();
  }

  async fill(data: NewTicketData): Promise<void> {
    await this.page.getByLabel('ID zewnętrzny').fill(data.externalId);
    await this.page.getByLabel('ID usługi').fill(data.serviceId);
    await this.page.getByLabel('Opis').fill(data.description);
  }

  async submit(): Promise<void> {
    await this.page.getByRole('button', { name: 'Utwórz zgłoszenie' }).click();
  }
}
