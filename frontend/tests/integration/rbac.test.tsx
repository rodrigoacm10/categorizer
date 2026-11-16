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
      sku: "SKU-PAR-01",
      name: "Parafuso Sextavado M8",
      unit: "UN",
      current_quantity: 100.0,
      current_quantity_scaled: 100000,
      min_quantity: 20.0,
      is_active: true,
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
      { id: "cat-1", name: "Fixadores", tenant_id: "t-homolog-rbac", created_at: "2026-11-16T10:00:00Z" },
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
          id: "m-1",
          user_id: "usr-active-1",
          email: "operador@tenant.com",
          name: "Operador Teste",
          role: "OWNER",
          joined_at: "2026-11-16T08:00:00Z",
        },
      ],
      totalCount: 1,
      limit: 100,
      offset: 0,
    });

    vi.mocked(productsApi.list).mockResolvedValue([]);
    vi.mocked(productsApi.getCategories).mockResolvedValue([]);
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

});
