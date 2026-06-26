import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export class TicketDetailPage {
  constructor(private readonly page: Page) {}

  async goto(externalId: string): Promise<void> {
    await this.page.goto(`${FRONTEND_URL}/tickets/${externalId}`);
    await this.page.waitForURL(`${FRONTEND_URL}/tickets/${externalId}`);
  }

  async waitForTicket(externalId: string): Promise<void> {
    await this.page.waitForURL(`${FRONTEND_URL}/tickets/${externalId}`, { timeout: 10_000 });
    // Czekaj na jeden ze statusów zamiast na tekst externalID (bardziej niezawodne)
    const statusChip = this.page.locator('.MuiChip-label').first();
    await statusChip.waitFor({ timeout: 10_000 });
  }

  statusChip(label: string) {
    return this.page.locator('.MuiChip-label').filter({ hasText: label });
  }

  async expectStatus(label: string): Promise<void> {
    await expect(this.statusChip(label)).toBeVisible();
  }

  async addNote(text: string): Promise<void> {
    const textarea = this.page.getByLabel('Treść notatki');
    await expect(textarea).toBeVisible();
    await textarea.fill(text);
    await this.page.getByRole('button', { name: 'Dodaj notatkę' }).click();
    await expect(this.page.getByText('Notatka została dodana')).toBeVisible({ timeout: 5_000 });
  }

  async expectNoteVisible(text: string): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible({ timeout: 5_000 });
  }

  async closeTicket(): Promise<void> {
    const closeButton = this.page.getByRole('button', { name: 'Zamknij zgłoszenie' });
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(this.page.getByText('Zgłoszenie zostało zamknięte')).toBeVisible({ timeout: 5_000 });
  }

  async expectClosedState(): Promise<void> {
    await this.expectStatus('Zamknięte');
    await expect(
      this.page.getByRole('button', { name: 'Zamknij zgłoszenie' }),
    ).not.toBeVisible();
  }

  async expectNoteTextareaNotVisible(): Promise<void> {
    const textarea = this.page.getByLabel('Treść notatki');
    await expect(textarea).not.toBeVisible();
  }

  async expectAddNoteButtonNotVisible(): Promise<void> {
    const button = this.page.getByRole('button', { name: 'Dodaj notatkę' });
    await expect(button).not.toBeVisible();
  }
}
