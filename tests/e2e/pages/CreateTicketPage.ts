import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { getFrontendUrl } from "../../helpers/test-env";

const FRONTEND_URL = getFrontendUrl();

export interface NewTicketData {
  externalId: string;
  serviceId: string;
  description: string;
}

export class CreateTicketPage {
  readonly heading: Locator;
  readonly externalIdInput: Locator;
  readonly serviceIdInput: Locator;
  readonly descriptionInput: Locator;
  readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByText("Nowe zgłoszenie");
    this.externalIdInput = page.getByLabel("ID zewnętrzny");
    this.serviceIdInput = page.getByLabel("ID usługi");
    this.descriptionInput = page.getByLabel("Opis");
    this.submitButton = page.getByRole("button", { name: "Utwórz zgłoszenie" });
  }

  async waitForReady(): Promise<void> {
    await this.page.waitForURL(`${FRONTEND_URL}/tickets/new`);
    await expect(this.heading).toBeVisible();
  }

  async fill(data: NewTicketData): Promise<void> {
    await this.externalIdInput.fill(data.externalId);
    await this.serviceIdInput.fill(data.serviceId);
    await this.descriptionInput.fill(data.description);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
