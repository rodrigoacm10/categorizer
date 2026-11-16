import { Page, expect } from "@playwright/test";

/**
 * Page Object Model para Autenticação (Login e Cadastro)
 */
export class AuthPage {
  constructor(private page: Page) {}

  async gotoRegister() {
    await this.page.goto("/register");
    await expect(this.page.locator("h2")).toContainText("Cadastro de Operador");
  }

  async fillRegistration(fullName: string, email: string, pass: string, confirmPass: string) {
    await this.page.locator("#fullname-input").fill(fullName);
    await this.page.locator("#email-input").fill(email);
    await this.page.locator("#password-input").fill(pass);
    await this.page.locator("#confirm-password-input").fill(confirmPass);
  }

  async submitRegistration() {
    await this.page.locator('button[type="submit"]:has-text("Criar Conta na Bancada")').click();
  }

  async gotoLogin() {
    await this.page.goto("/login");
    await expect(this.page.locator("h2")).toContainText("Autenticação de Operador");
  }

  async fillLogin(email: string, pass: string) {
    await this.page.locator("#email-input").fill(email);
    await this.page.locator("#password-input").fill(pass);
  }

  async submitLogin() {
    await this.page.locator('button[type="submit"]:has-text("Entrar na Bancada")').click();
  }
}
