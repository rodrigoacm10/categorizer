import { test, expect } from "./fixtures/test-base";
import { InventoryPage } from "./pages/InventoryPage";
import { LedgerPage } from "./pages/LedgerPage";

test.describe("Fluxo 3 — Livro-Razão e Movimentações Físicas com Invariantes Contábeis (FT-23)", () => {
  let tenantId: string;
  let userToken: string;
  let productId: string;

  test.beforeEach(async ({ page, mockServer }) => {
    // Configura usuário e tenant padrão
    const user = mockServer.store.registerUser(
      "Almoxarife Chefe",
      "almoxarife.chefe@industria.com",
      "Almoxarife@2026"
    );
    const tenant = mockServer.store.createTenant(
      "Almoxarifado Geral de Peças",
      "almoxarifado-geral-pecas",
      "Armazém de peças e materiais de manutenção",
      user.id
    );

    tenantId = tenant.id;
    userToken = `mock_jwt_token_${user.id}`;
    mockServer.setCurrentUserId(user.id);

    // Cria produto de teste com saldo inicial ZERO
    const product = mockServer.store.createProduct(
      tenantId,
      "Rolamento Rígido de Esferas SKF 6205-2RSH",
      "Rolamento para motor elétrico de indução 5CV",
      "UN",
      5
    );
    productId = product.id;

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

  test("Cenário 3.1: Entrada física de 10 unidades e verificação de saldo", async ({ page, mockServer }) => {
    const inventoryPage = new InventoryPage(page);
    await inventoryPage.goto();

    // Busca o produto pelo ID
    await inventoryPage.searchProduct(productId);

    // Saldo inicial deve ser 0,000 UN
    expect(await inventoryPage.getBalanceValue()).toBe("0,000 UN");

    // Seleciona aba Entrada (+)
    await inventoryPage.selectTab("IN");

    // Preenche quantidade 10 e justificativa
    await inventoryPage.fillMovement("10", "NF-e 8945 - Recebimento Fornecedor SKF");

    // Valida pré-visualização contábil antes de submeter
    await expect(page.locator('[data-testid="current-balance-value"]')).toContainText("0,000");
    await expect(page.locator('[data-testid="delta-value"]')).toContainText("+10,000");
    await expect(page.locator('[data-testid="projected-balance-value"]')).toContainText("10,000");

    // Confirma entrada
    await inventoryPage.submitMovement();
    await inventoryPage.expectSuccess("Movimentação física de IN registrada com sucesso");

    // Saldo físico atualizado para 10,000 UN
    expect(await inventoryPage.getBalanceValue()).toBe("10,000 UN");

    // Valida integridade no store
    const prod = mockServer.store.getProduct(tenantId, productId);
    expect(prod?.current_quantity).toBe(10);
    expect(prod?.current_quantity_scaled).toBe(10000);
  });

  test("Cenário 3.2: Saída física de 3 unidades e redução contábil", async ({ page, mockServer }) => {
    // Pré-registra entrada de 10 unidades no store
    mockServer.store.registerMovement(
      tenantId,
      productId,
      "IN",
      10,
      "Entrada inicial de lote",
      "usr_0001"
    );

    const inventoryPage = new InventoryPage(page);
    await inventoryPage.goto();

    // Busca o produto (saldo atual 10,000 UN)
    await inventoryPage.searchProduct(productId);
    expect(await inventoryPage.getBalanceValue()).toBe("10,000 UN");

    // Seleciona aba Saída (-)
    await inventoryPage.selectTab("OUT");

    // Preenche saída de 3 unidades com justificativa
    await inventoryPage.fillMovement("3", "Requisição OS-402 Manutenção Preventiva Ponte Rolante");

    // Valida pré-visualização contábil (10 - 3 = 7)
    await expect(page.locator('[data-testid="current-balance-value"]')).toContainText("10,000");
    await expect(page.locator('[data-testid="delta-value"]')).toContainText("-3,000");
    await expect(page.locator('[data-testid="projected-balance-value"]')).toContainText("7,000");

    // Confirma saída
    await inventoryPage.submitMovement();
    await inventoryPage.expectSuccess("Movimentação física de OUT registrada com sucesso");

    // Saldo físico atualizado para 7,000 UN
    expect(await inventoryPage.getBalanceValue()).toBe("7,000 UN");

    // Valida integridade no store
    const prod = mockServer.store.getProduct(tenantId, productId);
    expect(prod?.current_quantity).toBe(7);
    expect(prod?.current_quantity_scaled).toBe(7000);
  });

  test("Cenário 3.3: Bloqueio estrito de tentativa de saída com saldo negativo", async ({ page, mockServer }) => {
    // Saldo atual de 7 unidades no store
    mockServer.store.registerMovement(tenantId, productId, "IN", 10, "Entrada", "usr_0001");
    mockServer.store.registerMovement(tenantId, productId, "OUT", 3, "Saída", "usr_0001");

    const inventoryPage = new InventoryPage(page);
    await inventoryPage.goto();

    await inventoryPage.searchProduct(productId);
    expect(await inventoryPage.getBalanceValue()).toBe("7,000 UN");

    // Seleciona aba Saída (-)
    await inventoryPage.selectTab("OUT");

    // Tenta retirar 8 unidades (7 - 8 = -1 saldo negativo)
    await inventoryPage.fillMovement("8", "Requisição Urgente Não Autorizada");

    // Deve exibir alerta visual de bloqueio e desabilitar o botão de confirmação
    await inventoryPage.expectNegativeBalanceAlert();

    // Garante que nenhuma movimentação foi registrada além das 2 anteriores
    const movements = mockServer.store.listMovements(tenantId, { product_id: productId });
    expect(movements.total).toBe(2);

    // Saldo continua íntegro em 7 unidades
    const prod = mockServer.store.getProduct(tenantId, productId);
    expect(prod?.current_quantity).toBe(7);
  });

  test("Cenário 3.4: Ajuste físico para 12 unidades (contagem de inventário)", async ({ page, mockServer }) => {
    // Saldo atual de 7 unidades no store
    mockServer.store.registerMovement(tenantId, productId, "IN", 10, "Entrada", "usr_0001");
    mockServer.store.registerMovement(tenantId, productId, "OUT", 3, "Saída", "usr_0001");

    const inventoryPage = new InventoryPage(page);
    await inventoryPage.goto();

    await inventoryPage.searchProduct(productId);
    expect(await inventoryPage.getBalanceValue()).toBe("7,000 UN");

    // Seleciona aba Ajuste Físico (Δ)
    await inventoryPage.selectTab("ADJUSTMENT");

    // Define nova quantidade física contada no galpão: 12 unidades (delta: 12 - 7 = +5)
    await inventoryPage.fillMovement("12", "Contagem de inventário físico periódico Galpão B");

    // Valida pré-visualização contábil
    await expect(page.locator('[data-testid="current-balance-value"]')).toContainText("7,000");
    await expect(page.locator('[data-testid="delta-value"]')).toContainText("+5,000");
    await expect(page.locator('[data-testid="projected-balance-value"]')).toContainText("12,000");

    // Confirma ajuste
    await inventoryPage.submitMovement();
    await inventoryPage.expectSuccess("Movimentação física de ADJUSTMENT registrada com sucesso");

    // Saldo físico atualizado para 12,000 UN
    expect(await inventoryPage.getBalanceValue()).toBe("12,000 UN");

    // Valida integridade no store
    const prod = mockServer.store.getProduct(tenantId, productId);
    expect(prod?.current_quantity).toBe(12);
    expect(prod?.current_quantity_scaled).toBe(12000);
  });

  test("Cenário 3.5: Auditoria no Extrato Geral do Livro-Razão (/inventory/movements)", async ({
    page,
    mockServer,
  }) => {
    // Executa a sequência completa no store: +10, -3, +5 (ajuste para 12)
    mockServer.store.registerMovement(tenantId, productId, "IN", 10, "Recebimento NF-e 8945", "usr_0001");
    mockServer.store.registerMovement(tenantId, productId, "OUT", 3, "Requisição OS-402 Manutenção", "usr_0001");
    mockServer.store.registerMovement(
      tenantId,
      productId,
      "ADJUSTMENT",
      12,
      "Contagem de inventário periódico",
      "usr_0001"
    );

    const ledgerPage = new LedgerPage(page);
    await ledgerPage.goto();

    // Deve conter exatamente 3 registros imutáveis no extrato
    await ledgerPage.expectMovementsCount(3);

    // Valida cada linha do extrato contábil
    await ledgerPage.expectMovementRecord({
      type: "ADJUSTMENT",
      delta: "5,000",
      reason: "Contagem de inventário periódico",
    });

    await ledgerPage.expectMovementRecord({
      type: "OUT",
      delta: "3,000",
      reason: "Requisição OS-402 Manutenção",
    });

    await ledgerPage.expectMovementRecord({
      type: "IN",
      delta: "10,000",
      reason: "Recebimento NF-e 8945",
    });

    // Zero desvio contábil entre o saldo físico do produto e o saldo do livro-razão
    const prod = mockServer.store.getProduct(tenantId, productId);
    expect(prod?.current_quantity).toBe(12);
  });
});
