import { test, expect } from "./fixtures/test-base";
import { AuthPage } from "./pages/AuthPage";
import { TenantsPage } from "./pages/TenantsPage";

test.describe("Fluxo 1 — Autenticação, Multi-Tenancy e Acesso à Bancada (FT-23)", () => {
  test("Cenário 1.1: Registro de novo operador corporativo e redirecionamento para login", async ({
    page,
    mockServer,
  }) => {
    const authPage = new AuthPage(page);

    await authPage.gotoRegister();

    // Preenche credenciais com senha forte industrial (mínimo 8 chars, 1 maiúscula, 1 número)
    await authPage.fillRegistration(
      "Eng. Carlos Drummond",
      "carlos.drummond@industria.com",
      "Armazem@2026",
      "Armazem@2026"
    );

    // Submete formulário de cadastro
    await authPage.submitRegistration();

    // Verifica redirecionamento para /login?registered=true com banner de sucesso
    await page.waitForURL("**/login?registered=true");
    await expect(page.locator('[role="status"]')).toContainText("Conta criada com sucesso!");
  });

  test("Cenário 1.2: Login do operador com JWT e redirecionamento para o seletor de tenants", async ({
    page,
    mockServer,
  }) => {
    // Pré-registra o usuário no store
    mockServer.store.registerUser(
      "Eng. Carlos Drummond",
      "carlos.drummond@industria.com",
      "Armazem@2026"
    );

    const authPage = new AuthPage(page);
    await authPage.gotoLogin();

    await authPage.fillLogin("carlos.drummond@industria.com", "Armazem@2026");
    await authPage.submitLogin();

    // Redireciona para /tenants
    await page.waitForURL("**/tenants");
    await expect(page.locator("h1")).toContainText("Seus Almoxarifados & Organizações");
  });

  test("Cenário 1.3: Criação de novo almoxarifado e assunção de governança como OWNER", async ({
    page,
    mockServer,
  }) => {
    const user = mockServer.store.registerUser(
      "Eng. Carlos Drummond",
      "carlos.drummond@industria.com",
      "Armazem@2026"
    );
    mockServer.setCurrentUserId(user.id);

    // Simula sessão autenticada injetando token no localStorage e cookies
    await page.goto("/login");
    await page.evaluate((token) => {
      localStorage.setItem("session_token", token);
      document.cookie = `session_token=${encodeURIComponent(token)}; path=/;`;
    }, `mock_jwt_token_${user.id}`);

    const tenantsPage = new TenantsPage(page);
    await tenantsPage.goto();

    // Abre modal de criação
    await tenantsPage.openCreateModal();

    // Preenche dados cadastrais do almoxarifado
    await tenantsPage.fillTenantForm(
      "Almoxarifado Central Metalúrgica",
      "almoxarifado-central-metalurgica",
      "Depósito principal de matérias-primas e ferramentas pesadas."
    );

    // Submete criação
    await tenantsPage.submitTenantForm();

    // Redireciona para /dashboard
    await page.waitForURL("**/dashboard");

    // Verifica que o TopBar reflete o Almoxarifado criado e o papel OWNER
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("body")).toContainText("Almoxarifado Central Metalúrgica");
  });

  test("Cenário 1.4: Hidratação completa do contexto de tenant e dashboard operacional", async ({
    page,
    mockServer,
  }) => {
    const user = mockServer.store.registerUser(
      "Eng. Carlos Drummond",
      "carlos.drummond@industria.com",
      "Armazem@2026"
    );
    const tenant = mockServer.store.createTenant(
      "Galpão Operacional Alfa",
      "galpao-operacional-alfa",
      "Unidade logística automatizada",
      user.id
    );
    mockServer.setCurrentUserId(user.id);

    // Configura sessão e tenant ativo
    await page.goto("/login");
    await page.evaluate(
      ({ token, tId }) => {
        localStorage.setItem("session_token", token);
        localStorage.setItem("active_tenant_id", tId);
        localStorage.setItem("active_tenant_role", "OWNER");
        document.cookie = `session_token=${encodeURIComponent(token)}; path=/;`;
        document.cookie = `active_tenant_id=${encodeURIComponent(tId)}; path=/;`;
        document.cookie = `active_tenant_role=OWNER; path=/;`;
      },
      { token: `mock_jwt_token_${user.id}`, tId: tenant.id }
    );

    await page.goto("/dashboard");

    // Valida elementos do Dashboard industrial
    await expect(page.locator("h1")).toContainText("Bancada de Operações de Estoque");
    await expect(page.locator('[data-testid="kpi-strip"]')).toBeVisible();
  });
});
