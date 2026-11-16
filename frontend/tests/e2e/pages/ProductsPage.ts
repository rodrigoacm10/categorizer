import { Page, expect } from "@playwright/test";

/**
 * Page Object Model para Catálogo e Cadastro de Produtos Físicos
 */
export class ProductsPage {
  constructor(private page: Page) {}

  async gotoList() {
    await this.page.goto("/products");
    await expect(this.page.locator("h1")).toContainText("Catálogo de Produtos");
  }

  async gotoNew() {
    await this.page.goto("/products/new");
    await expect(this.page.locator("h1")).toContainText("Novo Produto");
  }

  async fillProductForm(data: {
    name: string;
    description?: string;
    unit?: string;
    minStock?: string;
    categoryName?: string;
  }) {
    await this.page.locator('[data-testid="product-name-input"]').fill(data.name);

    if (data.description) {
      await this.page.locator('[data-testid="product-description-input"]').fill(data.description);
    }

    if (data.unit) {
      await this.page.locator("#product-unit").fill(data.unit);
    }

    if (data.minStock) {
      await this.page.locator('[data-testid="product-min-stock-input"]').fill(data.minStock);
    }

    if (data.categoryName) {
      // Abre dropdown de categorias se fechado e seleciona categoria pelo nome
      const toggleCat = this.page.locator(`button:has-text("${data.categoryName}")`).first();
      if (await toggleCat.isVisible()) {
        await toggleCat.click();
      }
    }
  }

  async submitProductForm() {
    await this.page.locator('[data-testid="submit-product-button"]').click();
  }

  async searchProduct(nameOrSku: string) {
    const searchInput = this.page.locator('input[placeholder*="Buscar por nome, código"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill(nameOrSku);
    }
  }

  async expectProductInTable(name: string, expectedStockText: string) {
    const table = this.page.locator("table");
    await expect(table).toContainText(name);
    await expect(table).toContainText(expectedStockText);
  }
}
