import { Page, expect } from "@playwright/test";

/**
 * Page Object Model para a Bancada de Movimentação Física (/inventory/move)
 */
export class InventoryPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/inventory/move");
    await expect(this.page.locator("h1")).toContainText("Bancada de Movimentação Física");
  }

  async searchProduct(idOrBarcode: string) {
    const input = this.page.locator('[data-testid="barcode-search-input"]');
    await input.fill(idOrBarcode);
    await input.press("Enter");
    await expect(this.page.locator('[data-testid="selected-product-card"]')).toBeVisible();
  }

  async selectTab(tab: "IN" | "OUT" | "ADJUSTMENT") {
    if (tab === "IN") {
      await this.page.locator('button[role="tab"]:has-text("Entrada (+)")').click();
    } else if (tab === "OUT") {
      await this.page.locator('button[role="tab"]:has-text("Saída (-)")').click();
    } else {
      await this.page.locator('button[role="tab"]:has-text("Ajuste Físico (Δ)")').click();
    }
  }

  async fillMovement(quantity: string, reason: string) {
    await this.page.locator('[data-testid="movement-quantity-input"]').fill(quantity);
    await this.page.locator('[data-testid="movement-reason-input"]').fill(reason);
  }

  async submitMovement() {
    await this.page.locator('[data-testid="submit-movement-button"]').click();
  }

  async expectSuccess(expectedText?: string) {
    const alert = this.page.locator('[data-testid="success-alert"]');
    await expect(alert).toBeVisible();
    if (expectedText) {
      await expect(alert).toContainText(expectedText);
    }
  }

  async expectNegativeBalanceAlert() {
    const alert = this.page.locator('[data-testid="negative-balance-alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Operação bloqueada: A quantidade solicitada excede o saldo físico disponível.");

    // O botão de submissão deve estar desabilitado
    const submitBtn = this.page.locator('[data-testid="submit-movement-button"]');
    await expect(submitBtn).toBeDisabled();
  }

  async getBalanceValue(): Promise<string> {
    return (await this.page.locator('[data-testid="selected-product-balance"]').textContent()) || "";
  }
}
