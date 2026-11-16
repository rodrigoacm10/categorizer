import { Page, expect } from "@playwright/test";

/**
 * Page Object Model para Seleção e Criação de Almoxarifados (Multi-Tenancy)
 */
export class TenantsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/tenants");
    await expect(this.page.locator("h1")).toContainText("Seus Almoxarifados & Organizações");
  }

  async openCreateModal() {
    await this.page.locator('button:has-text("Criar Novo Almoxarifado")').first().click();
    await expect(this.page.locator('div[role="dialog"]')).toBeVisible();
  }

  async fillTenantForm(name: string, slug?: string, description?: string) {
    await this.page.locator("#tenant-name-input").fill(name);
    if (slug) {
      await this.page.locator("#tenant-slug-input").fill(slug);
    }
    if (description) {
      await this.page.locator("#tenant-description-input").fill(description);
    }
  }

  async submitTenantForm() {
    await this.page.locator('button[type="submit"]:has-text("Criar e Assumir Gestão")').click();
  }
}
