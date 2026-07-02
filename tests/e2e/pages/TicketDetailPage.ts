import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { getFrontendUrl } from "../../helpers/test-env";

const FRONTEND_URL = getFrontendUrl();

export class TicketDetailPage {
  readonly statusChipList: Locator;
  readonly noteTextarea: Locator;
  readonly addNoteButton: Locator;
  readonly noteAddedConfirmation: Locator;
  readonly closeTicketButton: Locator;
  readonly ticketClosedConfirmation: Locator;

  constructor(private readonly page: Page) {
    this.statusChipList = page.locator(".MuiChip-label");
    this.noteTextarea = page.getByLabel("Treść notatki");
    this.addNoteButton = page.getByRole("button", { name: "Dodaj notatkę" });
    this.noteAddedConfirmation = page.getByText("Notatka została dodana");
    this.closeTicketButton = page.getByRole("button", {
      name: "Zamknij zgłoszenie",
    });
    this.ticketClosedConfirmation = page.getByText(
      "Zgłoszenie zostało zamknięte",
    );
  }

  async goto(externalId: string): Promise<void> {
    await this.page.goto(`${FRONTEND_URL}/tickets/${externalId}`);
    await this.page.waitForURL(`${FRONTEND_URL}/tickets/${externalId}`);
  }

  async waitForTicket(externalId: string): Promise<void> {
    await this.page.waitForURL(`${FRONTEND_URL}/tickets/${externalId}`, {
      timeout: 10_000,
    });
    await this.statusChipList.first().waitFor({ timeout: 10_000 });
  }

  statusChip(label: string) {
    return this.statusChipList.filter({ hasText: label });
  }

  async expectStatus(label: string): Promise<void> {
    await expect(this.statusChip(label)).toBeVisible();
  }

  async addNote(text: string): Promise<void> {
    await expect(this.noteTextarea).toBeVisible();
    await this.noteTextarea.fill(text);
    await this.addNoteButton.click();
    await expect(this.noteAddedConfirmation).toBeVisible({ timeout: 5_000 });
  }

  async expectNoteVisible(text: string): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible({ timeout: 5_000 });
  }

  async closeTicket(): Promise<void> {
    await expect(this.closeTicketButton).toBeVisible();
    await this.closeTicketButton.click();
    await expect(this.ticketClosedConfirmation).toBeVisible({ timeout: 5_000 });
  }

  async expectClosedState(): Promise<void> {
    await this.expectStatus("Zamknięte");
    await expect(this.closeTicketButton).not.toBeVisible();
  }

  async expectNoteTextareaNotVisible(): Promise<void> {
    await expect(this.noteTextarea).not.toBeVisible();
  }

  async expectAddNoteButtonNotVisible(): Promise<void> {
    await expect(this.addNoteButton).not.toBeVisible();
  }
}
