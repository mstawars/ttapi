import type { Page } from '@playwright/test';

export class TicketListPage {
  constructor(private readonly page: Page) {}

  async clickNewTicket(): Promise<void> {
    await this.page.getByRole('button', { name: 'Nowe zgłoszenie' }).click();
  }
}
