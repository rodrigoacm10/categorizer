import { Page, expect } from "@playwright/test";

/**
 * Page Object Model para o Extrato Geral do Livro-Razão (/inventory/movements)
 */
export class LedgerPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/inventory/movements");
    await expect(this.page.locator("h1")).toContainText("Extrato Geral do Livro-Razão");
  }

  async expectMovementsCount(count: number) {
    const rows = this.page.locator("table tbody tr");
    await expect(rows).toHaveCount(count);
  }

  async expectMovementRecord(data: { type: string; delta: string; reason: string }) {
    const table = this.page.locator("table");
    await expect(table).toContainText(data.type);
    await expect(table).toContainText(data.delta);
    await expect(table).toContainText(data.reason);
  }
}
