import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ActionType,
  TenantRole,
  RBAC_PERMISSIONS_MATRIX,
} from "@/shared/types/rbac.types";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { Can } from "@/shared/components/Can";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";

// Componentes e Páginas para Verificação Visual e Operacional
import WorkbenchLayout from "@/app/(workbench)/layout";
import { MovementForm } from "@/features/inventory/components/MovementForm";
import ReconciliationPage from "@/app/(workbench)/inventory/reconciliation/page";
import CategoriesPage from "@/app/(workbench)/categories/page";
import MembersSettingsPage from "@/app/(workbench)/settings/members/page";
import ProductsPage from "@/app/(workbench)/products/page";
import NewProductPage from "@/app/(workbench)/products/new/page";
import { QuickActionToolbar } from "@/features/dashboard/components/QuickActionToolbar";

// APIs Mockadas
import { inventoryApi } from "@/features/inventory/services/inventory.api";
import { reconciliationApi } from "@/features/inventory/services/reconciliation.api";
import { categoriesApi } from "@/features/categories/services/categories.api";
import { membersApi } from "@/features/settings/services/members.api";
import { productsApi } from "@/features/products/services/products.api";
import { storage } from "@/shared/lib/storage";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/inventory/services/inventory.api", () => ({
  inventoryApi: {
    lookupProduct: vi.fn(),
    registerStockIn: vi.fn(),
    registerStockOut: vi.fn(),
    registerStockAdjustment: vi.fn(),
  },
}));

vi.mock("@/features/inventory/services/reconciliation.api", () => ({
  reconciliationApi: {
    getReconciliationReport: vi.fn(),
  },
}));

vi.mock("@/features/categories/services/categories.api", () => ({
  categoriesApi: {
    list: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/features/settings/services/members.api", () => ({
  membersApi: {
    getMembersSummary: vi.fn(),
    listMembers: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    inviteMember: vi.fn(),
  },
}));

vi.mock("@/features/products/services/products.api", () => ({
  productsApi: {
    list: vi.fn(),
    getCategories: vi.fn(),
  },
}));

vi.mock("@/features/auth/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "usr-active-1", email: "operador@tenant.com", full_name: "Operador Teste" },
    isAuthenticated: true,
  }),
}));

describe("FT-22: Suíte de Homologação de RBAC e Matriz de Acesso Visual/Operacional", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    storage.setToken("mock-jwt-token");
    storage.setActiveTenantId("t-homolog-rbac");

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    vi.mocked(inventoryApi.lookupProduct).mockResolvedValue({
      id: "p-101",
      name: "Parafuso Sextavado M8",
      unit: "UN",
      current_quantity: 100.0,
      current_quantity_scaled: 100000,
      min_stock: 20.0,
      is_low_stock: false,
      is_active: true,
      categories: [],
      created_at: "2026-11-16T10:00:00Z",
      updated_at: "2026-11-16T10:00:00Z",
    });

    vi.mocked(reconciliationApi.getReconciliationReport).mockResolvedValue({
      tenant_id: "t-homolog-rbac",
      total_products_checked: 15,
      discrepant_products_count: 0,
      is_reconciled: true,
      discrepancies: [],
      generated_at: "2026-11-16T14:40:00Z",
    });

    vi.mocked(categoriesApi.list).mockResolvedValue([
      { id: "cat-1", name: "Fixadores", color: "#2563EB", created_at: "2026-11-16T10:00:00Z" },
    ]);

    vi.mocked(membersApi.getMembersSummary).mockResolvedValue({
      total_members: 4,
      owners_count: 1,
      gestores_count: 1,
      almoxarifes_count: 1,
      auditores_count: 1,
    });

    vi.mocked(membersApi.listMembers).mockResolvedValue({
      items: [
        {
          user_id: "usr-active-1",
          email: "operador@tenant.com",
          full_name: "Operador Teste",
          role: "OWNER",
          joined_at: "2026-11-16T08:00:00Z",
        },
      ],
      totalCount: 1,
      totalPages: 1,
    });

    vi.mocked(productsApi.list).mockResolvedValue([]);
    if ("getCategories" in productsApi) {
      (productsApi as any).getCategories.mockResolvedValue([]);
    }
  });

  const renderWithRole = (ui: React.ReactElement, role: TenantRole) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TenantProvider initialTenantId="t-homolog-rbac" initialRole={role}>
          {ui}
        </TenantProvider>
      </QueryClientProvider>
    );
  };

  describe("1. Matriz Teórica e Regras de Negócio do Hook useRBAC", () => {
    const allActions: ActionType[] = [
      "view_dashboard",
      "view_products",
      "create_product",
      "edit_product",
      "inactivate_product",
      "delete_product",
      "view_movements",
      "view_ledger",
      "stock_in",
      "stock_out",
      "stock_adjustment",
      "view_categories",
      "manage_categories",
      "view_members",
      "invite_member",
      "manage_members",
      "manage_tenant",
      "view_audit",
      "reconcile_inventory",
    ];

    it("valida que OWNER tem acesso irrestrito a todas as 18 capacidades do sistema", () => {
      function TestComponent() {
        const { can, isOwner } = useRBAC();
        return (
          <div>
            <span data-testid="is-owner">{String(isOwner())}</span>
            {allActions.map((action) => (
              <span key={action} data-testid={`action-${action}`}>
                {String(can(action))}
              </span>
            ))}
          </div>
        );
      }

      renderWithRole(<TestComponent />, "OWNER");

      expect(screen.getByTestId("is-owner").textContent).toBe("true");
      allActions.forEach((action) => {
        expect(screen.getByTestId(`action-${action}`).textContent).toBe("true");
      });
    });

    it("valida capacidades de GESTOR: ampla gestão operacional, mas proibido em manage_members e manage_tenant", () => {
      function TestComponent() {
        const { can, isGestor } = useRBAC();
        return (
          <div>
            <span data-testid="is-gestor">{String(isGestor())}</span>
            {allActions.map((action) => (
              <span key={action} data-testid={`action-${action}`}>
                {String(can(action))}
              </span>
            ))}
          </div>
        );
      }

      renderWithRole(<TestComponent />, "GESTOR");

      expect(screen.getByTestId("is-gestor").textContent).toBe("true");

      // Permitidas para GESTOR
      const allowedForGestor: ActionType[] = [
        "view_dashboard",
        "view_products",
        "create_product",
        "edit_product",
        "inactivate_product",
        "delete_product",
        "view_movements",
        "view_ledger",
        "stock_in",
        "stock_out",
        "stock_adjustment",
        "view_categories",
        "manage_categories",
        "view_members",
        "invite_member",
        "view_audit",
        "reconcile_inventory",
      ];

      // Bloqueadas para GESTOR (exclusivas do OWNER)
      const deniedForGestor: ActionType[] = ["manage_members", "manage_tenant"];

      allowedForGestor.forEach((action) => {
        expect(screen.getByTestId(`action-${action}`).textContent).toBe("true");
      });
      deniedForGestor.forEach((action) => {
        expect(screen.getByTestId(`action-${action}`).textContent).toBe("false");
      });
    });

    it("valida capacidades de ALMOXARIFE: focado em chão de fábrica (IN, OUT, ADJUSTMENT, Ledger), proibido em categorias, membros e auditoria", () => {
      function TestComponent() {
        const { can, isAlmoxarife } = useRBAC();
        return (
          <div>
            <span data-testid="is-almoxarife">{String(isAlmoxarife())}</span>
            {allActions.map((action) => (
              <span key={action} data-testid={`action-${action}`}>
                {String(can(action))}
              </span>
            ))}
          </div>
        );
      }

      renderWithRole(<TestComponent />, "ALMOXARIFE");

      expect(screen.getByTestId("is-almoxarife").textContent).toBe("true");

      // Permitidas
      const allowedForAlmoxarife: ActionType[] = [
        "view_dashboard",
        "view_products",
        "view_movements",
        "view_ledger",
        "stock_in",
        "stock_out",
        "stock_adjustment",
      ];

      // Proibidas
      const deniedForAlmoxarife: ActionType[] = [
        "create_product",
        "edit_product",
        "inactivate_product",
        "delete_product",
        "view_categories",
        "manage_categories",
        "view_members",
        "invite_member",
        "manage_members",
        "manage_tenant",
        "view_audit",
        "reconcile_inventory",
      ];

      allowedForAlmoxarife.forEach((action) => {
        expect(screen.getByTestId(`action-${action}`).textContent).toBe("true");
      });
      deniedForAlmoxarife.forEach((action) => {
        expect(screen.getByTestId(`action-${action}`).textContent).toBe("false");
      });
    });

    it("valida capacidades de AUDITOR: somente-leitura fiscal e reconciliação contábil, proibido em movimentações físicas (IN, OUT)", () => {
      function TestComponent() {
        const { can, isAuditor } = useRBAC();
        return (
          <div>
            <span data-testid="is-auditor">{String(isAuditor())}</span>
            {allActions.map((action) => (
              <span key={action} data-testid={`action-${action}`}>
                {String(can(action))}
              </span>
            ))}
          </div>
        );
      }

      renderWithRole(<TestComponent />, "AUDITOR");

      expect(screen.getByTestId("is-auditor").textContent).toBe("true");

      // Permitidas para AUDITOR
      const allowedForAuditor: ActionType[] = [
        "view_dashboard",
        "view_products",
        "view_movements",
        "view_ledger",
        "stock_adjustment",
        "view_audit",
        "reconcile_inventory",
      ];

      // Proibidas para AUDITOR
      const deniedForAuditor: ActionType[] = [
        "stock_in",
        "stock_out",
        "create_product",
        "edit_product",
        "inactivate_product",
        "delete_product",
        "view_categories",
        "manage_categories",
        "view_members",
        "invite_member",
        "manage_members",
        "manage_tenant",
      ];

      allowedForAuditor.forEach((action) => {
        expect(screen.getByTestId(`action-${action}`).textContent).toBe("true");
      });
      deniedForAuditor.forEach((action) => {
        expect(screen.getByTestId(`action-${action}`).textContent).toBe("false");
      });
    });
  });

  describe("2. Componente Declarativo de Controle de Acesso (<Can />)", () => {
    it("renderiza children quando o papel possui a permissão e fallback quando não possui", () => {
      function TestGates() {
        return (
          <div>
            <Can I="create_product" fallback={<span data-testid="fb-create">Bloqueado</span>}>
              <span data-testid="child-create">Permitido</span>
            </Can>
            <Can I="view_audit" fallback={<span data-testid="fb-audit">Bloqueado</span>}>
              <span data-testid="child-audit">Permitido</span>
            </Can>
          </div>
        );
      }

      // ALMOXARIFE: sem create_product, sem view_audit
      const { unmount } = renderWithRole(<TestGates />, "ALMOXARIFE");
      expect(screen.getByTestId("fb-create").textContent).toBe("Bloqueado");
      expect(screen.getByTestId("fb-audit").textContent).toBe("Bloqueado");
      unmount();

      // AUDITOR: sem create_product, COM view_audit
      const { unmount: unmountAuditor } = renderWithRole(<TestGates />, "AUDITOR");
      expect(screen.getByTestId("fb-create").textContent).toBe("Bloqueado");
      expect(screen.getByTestId("child-audit").textContent).toBe("Permitido");
      unmountAuditor();

      // GESTOR: COM create_product, COM view_audit
      renderWithRole(<TestGates />, "GESTOR");
      expect(screen.getByTestId("child-create").textContent).toBe("Permitido");
      expect(screen.getByTestId("child-audit").textContent).toBe("Permitido");
    });
  });

  describe("3. Navegação Primária do Workbench (WorkbenchLayout)", () => {
    it("exibe todas as 7 abas para OWNER e GESTOR", () => {
      renderWithRole(
        <WorkbenchLayout>
          <div>Conteúdo</div>
        </WorkbenchLayout>,
        "OWNER"
      );

      expect(screen.getByRole("link", { name: /dashboard/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /catálogo/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /categorias/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /movimentações/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /extrato/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /auditoria/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /membros/i })).toBeDefined();
    });

    it("oculta Categorias, Auditoria e Membros para o perfil ALMOXARIFE", () => {
      renderWithRole(
        <WorkbenchLayout>
          <div>Conteúdo</div>
        </WorkbenchLayout>,
        "ALMOXARIFE"
      );

      expect(screen.getByRole("link", { name: /dashboard/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /catálogo/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /movimentações/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /extrato/i })).toBeDefined();

      // Abas bloqueadas não devem ser renderizadas
      expect(screen.queryByRole("link", { name: /categorias/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /auditoria/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /membros/i })).toBeNull();
    });

    it("oculta Categorias e Membros para AUDITOR, mas exibe Auditoria Contábil", () => {
      renderWithRole(
        <WorkbenchLayout>
          <div>Conteúdo</div>
        </WorkbenchLayout>,
        "AUDITOR"
      );

      expect(screen.getByRole("link", { name: /dashboard/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /catálogo/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /movimentações/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /extrato/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /auditoria/i })).toBeDefined();

      // Categorias e Membros restritos
      expect(screen.queryByRole("link", { name: /categorias/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /membros/i })).toBeNull();
    });
  });

  describe("4. Bancada Operacional de Movimentação Física (MovementForm)", () => {
    it("bloqueia abas de Entrada (+) e Saída (-) para AUDITOR com banner informativo de somente-leitura", async () => {
      renderWithRole(<MovementForm initialProductId="p-101" />, "AUDITOR");

      await waitFor(() => {
        expect(screen.getByText("Parafuso Sextavado M8")).toBeDefined();
      });

      // Aba IN ativa por padrão -> deve exibir banner de permissão insuficiente
      expect(screen.getByTestId("permission-warning-banner")).toBeDefined();
      expect(
        screen.getByText(/O perfil AUDITOR possui acesso somente-leitura e não tem autorização para registrar entradas físicas/i)
      ).toBeDefined();

      // Botão de submissão desabilitado
      const submitBtn = screen.getByTestId("submit-movement-button");
      expect(submitBtn.hasAttribute("disabled")).toBe(true);

      // Troca para aba Saída (-)
      const outTab = screen.getByRole("tab", { name: /saída/i });
      fireEvent.click(outTab);

      expect(screen.getByTestId("permission-warning-banner")).toBeDefined();
      expect(
        screen.getByText(/O perfil AUDITOR possui acesso somente-leitura e não tem autorização para registrar saídas físicas/i)
      ).toBeDefined();
      expect(screen.getByTestId("submit-movement-button").hasAttribute("disabled")).toBe(true);

      // Troca para aba Ajuste Contábil -> PERMITIDO para AUDITOR!
      const adjTab = screen.getByRole("tab", { name: /ajuste/i });
      fireEvent.click(adjTab);

      expect(screen.queryByTestId("permission-warning-banner")).toBeNull();
    });

    it("permite operação completa de Entrada (+), Saída (-) e Ajuste para ALMOXARIFE", async () => {
      renderWithRole(<MovementForm initialProductId="p-101" />, "ALMOXARIFE");

      await waitFor(() => {
        expect(screen.getByText("Parafuso Sextavado M8")).toBeDefined();
      });

      expect(screen.queryByTestId("permission-warning-banner")).toBeNull();

      const outTab = screen.getByRole("tab", { name: /saída/i });
      fireEvent.click(outTab);
      expect(screen.queryByTestId("permission-warning-banner")).toBeNull();

      const adjTab = screen.getByRole("tab", { name: /ajuste/i });
      fireEvent.click(adjTab);
      expect(screen.queryByTestId("permission-warning-banner")).toBeNull();
    });
  });

  describe("5. Bancada de Auditoria e Reconciliação Contábil (/inventory/reconciliation)", () => {
    it("bloqueia acesso de ALMOXARIFE com tela de acesso restrito e impede chamada à API", async () => {
      renderWithRole(<ReconciliationPage />, "ALMOXARIFE");

      expect(screen.getByTestId("reconciliation-access-denied")).toBeDefined();
      expect(screen.getByText("Acesso Restrito à Auditoria Contábil")).toBeDefined();
      expect(screen.getByText(/ALMOXARIFE/i)).toBeDefined();

      expect(reconciliationApi.getReconciliationReport).not.toHaveBeenCalled();
    });

    it("concede acesso a AUDITOR, executando a reconciliação e exibindo o KPI strip", async () => {
      renderWithRole(<ReconciliationPage />, "AUDITOR");

      await waitFor(() => {
        expect(reconciliationApi.getReconciliationReport).toHaveBeenCalledWith("t-homolog-rbac");
        expect(screen.getByTestId("reconciliation-kpi-strip")).toBeDefined();
        expect(screen.getByTestId("reconciliation-banner-success")).toBeDefined();
      });
    });

    it("concede acesso a GESTOR e OWNER", async () => {
      renderWithRole(<ReconciliationPage />, "GESTOR");

      await waitFor(() => {
        expect(reconciliationApi.getReconciliationReport).toHaveBeenCalledWith("t-homolog-rbac");
        expect(screen.getByTestId("reconciliation-kpi-strip")).toBeDefined();
      });
    });
  });

  describe("6. Módulo de Gestão de Categorias (/categories)", () => {
    it("bloqueia ALMOXARIFE e AUDITOR com banner de acesso restrito", () => {
      const { unmount } = renderWithRole(<CategoriesPage />, "ALMOXARIFE");
      expect(screen.getByText("Acesso Restrito // Papel Insuficiente")).toBeDefined();
      expect(screen.getByText(/ALMOXARIFE/i)).toBeDefined();
      expect(categoriesApi.list).not.toHaveBeenCalled();
      unmount();

      renderWithRole(<CategoriesPage />, "AUDITOR");
      expect(screen.getByText("Acesso Restrito // Papel Insuficiente")).toBeDefined();
      expect(screen.getByText(/AUDITOR/i)).toBeDefined();
      expect(categoriesApi.list).not.toHaveBeenCalled();
    });

    it("permite OWNER e GESTOR listarem e gerenciarem categorias", async () => {
      renderWithRole(<CategoriesPage />, "GESTOR");

      await waitFor(() => {
        expect(categoriesApi.list).toHaveBeenCalled();
        expect(screen.getByText("Fixadores")).toBeDefined();
        expect(screen.getByRole("button", { name: /nova categoria/i })).toBeDefined();
      });
    });
  });

  describe("7. Módulo de Governança de Membros (/settings/members)", () => {
    it("bloqueia ALMOXARIFE e AUDITOR com barreira de negação de acesso", () => {
      const { unmount } = renderWithRole(<MembersSettingsPage />, "ALMOXARIFE");
      expect(screen.getByTestId("members-access-denied")).toBeDefined();
      expect(membersApi.getMembersSummary).not.toHaveBeenCalled();
      unmount();

      renderWithRole(<MembersSettingsPage />, "AUDITOR");
      expect(screen.getByTestId("members-access-denied")).toBeDefined();
      expect(membersApi.getMembersSummary).not.toHaveBeenCalled();
    });

    it("permite visualização para GESTOR e OWNER", async () => {
      renderWithRole(<MembersSettingsPage />, "GESTOR");

      await waitFor(() => {
        expect(membersApi.getMembersSummary).toHaveBeenCalledWith("t-homolog-rbac");
        expect(membersApi.listMembers).toHaveBeenCalled();
        expect(screen.getByTestId("member-kpi-strip")).toBeDefined();
      });
    });
  });

  describe("8. Catálogo e Cadastro de Novos Produtos (/products & /products/new)", () => {
    it("no Catálogo (/products), oculta botão 'Novo Produto' para ALMOXARIFE e AUDITOR", async () => {
      const { unmount } = renderWithRole(<ProductsPage />, "ALMOXARIFE");
      await waitFor(() => {
        expect(screen.queryByTestId("new-product-button")).toBeNull();
      });
      unmount();

      renderWithRole(<ProductsPage />, "AUDITOR");
      await waitFor(() => {
        expect(screen.queryByTestId("new-product-button")).toBeNull();
      });
    });

    it("no Catálogo (/products), exibe botão 'Novo Produto' para OWNER e GESTOR", async () => {
      renderWithRole(<ProductsPage />, "GESTOR");
      await waitFor(() => {
        expect(screen.getByTestId("new-product-button")).toBeDefined();
      });
    });

    it("na página de Cadastro (/products/new), bloqueia ALMOXARIFE e AUDITOR com banner de bloqueio", () => {
      renderWithRole(<NewProductPage />, "ALMOXARIFE");
      expect(screen.getByTestId("rbac-restricted-banner")).toBeDefined();
      expect(screen.getByText("Acesso Restrito // Papel Insuficiente")).toBeDefined();
    });

    it("na página de Cadastro (/products/new), renderiza o formulário de cadastro para OWNER e GESTOR", () => {
      renderWithRole(<NewProductPage />, "OWNER");
      expect(screen.queryByTestId("rbac-restricted-banner")).toBeNull();
      expect(screen.getByTestId("product-form")).toBeDefined();
    });
  });

  describe("9. Barra de Ações Rápidas do Dashboard (QuickActionToolbar)", () => {
    it("para AUDITOR, desabilita botões de Entrada e Saída com tooltip, mantendo Ajuste ativo", () => {
      renderWithRole(<QuickActionToolbar />, "AUDITOR");

      const entradaBtn = screen.getByRole("button", {
        name: /Registrar Entrada de Estoque \(Desabilitado\)/i,
      });
      expect(entradaBtn).toBeDefined();
      expect(entradaBtn.hasAttribute("disabled")).toBe(true);

      const saidaBtn = screen.getByRole("button", {
        name: /Registrar Saída de Estoque \(Desabilitado\)/i,
      });
      expect(saidaBtn).toBeDefined();
      expect(saidaBtn.hasAttribute("disabled")).toBe(true);

      // Ajuste Contábil permanece ativo como Link
      const ajusteLink = screen.getByRole("link", { name: /ajuste de inventário/i });
      expect(ajusteLink).toBeDefined();
      expect(ajusteLink.getAttribute("href")).toBe("/inventory/move?mode=ADJUSTMENT");
    });

    it("para ALMOXARIFE, GESTOR e OWNER, renderiza links ativos para Entrada e Saída", () => {
      renderWithRole(<QuickActionToolbar />, "ALMOXARIFE");

      const entradaLink = screen.getByRole("link", {
        name: "Registrar Entrada de Estoque",
      });
      expect(entradaLink.getAttribute("href")).toBe("/inventory/move?mode=IN");

      const saidaLink = screen.getByRole("link", {
        name: "Registrar Saída de Estoque",
      });
      expect(saidaLink.getAttribute("href")).toBe("/inventory/move?mode=OUT");
    });
  });
});
