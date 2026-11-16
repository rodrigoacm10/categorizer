import { test, expect } from "./fixtures/test-base";
import { CategoriesPage } from "./pages/CategoriesPage";
import { ProductsPage } from "./pages/ProductsPage";

test.describe("Fluxo 2 — Gestão de Categorias e Catálogo de Produtos com Saldo Zero (FT-23)", () => {
  let tenantId: string;
  let userToken: string;

  test.beforeEach(async ({ page, mockServer }) => {
    // Configura usuário e tenant padrão
    const user = mockServer.store.registerUser(
      "Gestor de Suprimentos",
      "gestor.suprimentos@industria.com",
      "Gestor@2026"
    );
    const tenant = mockServer.store.createTenant(
      "Almoxarifado Central",
      "almoxarifado-central",
      "Unidade de armazenamento central",
      user.id
    );

    tenantId = tenant.id;
    userToken = `mock_jwt_token_${user.id}`;
    mockServer.setCurrentUserId(user.id);

    // Injeta credenciais de autenticação e tenant no localStorage e cookies
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
      { token: userToken, tId: tenantId }
    );
  });

  test("Cenário 2.1: Criação de categoria N:N com paleta industrial e validação na tabela", async ({
    page,
  }) => {
    const categoriesPage = new CategoriesPage(page);

    await categoriesPage.goto();

    // Abre o modal industrial de criação
    await categoriesPage.openCreateModal();

    // Preenche dados da categoria
    await categoriesPage.fillCategoryForm(
      "Equipamentos de Proteção Individual (EPI)",
      "Capacetes, óculos de segurança, luvas de raspa e botinas de segurança."
    );

    // Submete a criação
    await categoriesPage.submitCategoryForm();

    // Modal deve fechar e a categoria deve constar na tabela de categorias
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible();
    await categoriesPage.expectCategoryInList("Equipamentos de Proteção Individual (EPI)");
  });

  test("Cenário 2.2: Criação de produto com saldo inicial ZERO (invariante contábil)", async ({
    page,
    mockServer,
  }) => {
    // Pré-cria a categoria no store
    const cat = mockServer.store.createCategory(
      tenantId,
      "Eletrodos & Consumíveis",
      "Insumos para caldeiraria e soldagem pesada",
      "#2563EB"
    );

    const productsPage = new ProductsPage(page);
    await productsPage.gotoNew();

    // Verifica que NÃO EXISTE campo de saldo inicial no formulário (invariante contábil estrita)
    const initialBalanceInput = page.locator('input[name="initial_quantity"], input[name="current_quantity"]');
    await expect(initialBalanceInput).toHaveCount(0);

    // Preenche a ficha cadastral do produto
    await productsPage.fillProductForm({
      name: "Eletrodo Revestido AWS E7018 3.25mm",
      description: "Eletrodo para soldagem de aço carbono de alta resistência mecânica.",
      unit: "KG",
      minStock: "15.000",
      categoryName: "Eletrodos & Consumíveis",
    });

    // Submete a criação
    await productsPage.submitProductForm();

    // Redireciona para o catálogo de produtos
    await page.waitForURL("**/products");

    // Verifica no store que o produto foi criado com saldo ZERO
    const products = mockServer.store.listProducts(tenantId);
    const created = products.find((p) => p.name.includes("AWS E7018"));
    expect(created).toBeDefined();
    expect(created?.current_quantity).toBe(0);
    expect(created?.current_quantity_scaled).toBe(0);
  });

  test("Cenário 2.3: Consulta no catálogo com busca rápida e sinalização de estoque baixo", async ({
    page,
    mockServer,
  }) => {
    const cat = mockServer.store.createCategory(tenantId, "Usinagem", "Fresas e brocas", "#475569");

    // Cria produto no store com saldo zero e estoque mínimo 10
    mockServer.store.createProduct(
      tenantId,
      "Fresa de Topo Metal Duro 12mm",
      "Fresa de alta precisão 4 cortes",
      "UN",
      10,
      [cat.id]
    );

    const productsPage = new ProductsPage(page);
    await productsPage.gotoList();

    // O produto deve constar na tabela exibindo saldo zero
    await productsPage.expectProductInTable("Fresa de Topo Metal Duro 12mm", "0,000 UN");

    // Testa filtro / busca textual
    await productsPage.searchProduct("Fresa");
    await productsPage.expectProductInTable("Fresa de Topo Metal Duro 12mm", "0,000 UN");
  });
});
