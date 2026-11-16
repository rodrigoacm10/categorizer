import { Page, expect } from "@playwright/test";

/**
 * Page Object Model para Gestão de Categorias N:N
 */
export class CategoriesPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/categories");
    await expect(this.page.locator("h1")).toContainText("Gestão de Categorias");
  }

  async openCreateModal() {
    await this.page.locator('[data-testid="open-category-modal-button"]').click();
    await expect(this.page.locator('div[role="dialog"]')).toBeVisible();
  }

  async fillCategoryForm(name: string, description?: string) {
    await this.page.locator("#category-name-input").fill(name);
    if (description) {
      await this.page.locator("#category-description-input").fill(description);
    }
  }

  async submitCategoryForm() {
    await this.page.locator('[data-testid="category-modal-submit-button"]').click();
  }

  async expectCategoryInList(name: string) {
    await expect(this.page.locator("table")).toContainText(name);
  }
}
