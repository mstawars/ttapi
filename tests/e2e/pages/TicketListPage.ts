import type { Locator, Page } from "@playwright/test";

export class TicketListPage {
  readonly newTicketButton: Locator;

  constructor(private readonly page: Page) {
    this.newTicketButton = page.getByRole("button", {
      name: "Nowe zgłoszenie",
    });
  }

  async clickNewTicket(): Promise<void> {
    await this.newTicketButton.click();
  }
}
