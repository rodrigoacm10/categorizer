import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TenantList } from "../TenantList";
import { tenantsApi } from "../../services/tenants.api";
import { TenantProvider } from "../../hooks/useTenant";
import { storage } from "@/shared/lib/storage";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("../../services/tenants.api", () => ({
  tenantsApi: {
    listTenantsWithRoles: vi.fn(),
  },
}));

describe("TenantList (FT-07)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    storage.clearAll();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TenantProvider>{ui}</TenantProvider>
      </QueryClientProvider>
    );
  };

  it("renderiza estado vazio quando o usuário não possui nenhum almoxarifado", async () => {
    (tenantsApi.listTenantsWithRoles as any).mockResolvedValueOnce([]);

    const mockCreateClick = vi.fn();
    renderWithProviders(<TenantList onCreateTenantClick={mockCreateClick} />);

    expect(
      await screen.findByText(/Nenhum almoxarifado vinculado à sua conta/i)
    ).toBeDefined();

    const createBtn = screen.getByRole("button", {
      name: /Criar Primeiro Almoxarifado/i,
    });
    fireEvent.click(createBtn);
    expect(mockCreateClick).toHaveBeenCalledTimes(1);
  });

  it("renderiza a lista de almoxarifados com badges de papel (OWNER, GESTOR, ALMOXARIFE, AUDITOR)", async () => {
    (tenantsApi.listTenantsWithRoles as any).mockResolvedValueOnce([
      {
        id: "tenant-1",
        name: "Almoxarifado Central Matriz",
        slug: "matriz-central",
        description: "Depósito principal de matérias-primas",
        is_active: true,
        created_at: "2026-11-10T18:00:00Z",
        role: "OWNER",
      },
      {
        id: "tenant-2",
        name: "Unidade Secundária Peças",
        slug: "unidade-pecas",
        description: null,
        is_active: true,
        created_at: "2026-11-11T10:00:00Z",
        role: "ALMOXARIFE",
      },
    ]);

    renderWithProviders(<TenantList onCreateTenantClick={vi.fn()} />);

    expect(await screen.findByText("Almoxarifado Central Matriz")).toBeDefined();
    expect(screen.getByText("Unidade Secundária Peças")).toBeDefined();

    // Badges de papel
    expect(screen.getByText("OWNER")).toBeDefined();
    expect(screen.getByText("ALMOXARIFE")).toBeDefined();

    // Slugs
    expect(screen.getByText("ID: matriz-central")).toBeDefined();
    expect(screen.getByText("ID: unidade-pecas")).toBeDefined();
  });

  it("ao selecionar um almoxarifado, atualiza o contexto global e redireciona para /dashboard", async () => {
    (tenantsApi.listTenantsWithRoles as any).mockResolvedValueOnce([
      {
        id: "tenant-matriz",
        name: "Almoxarifado Central",
        slug: "central",
        description: "Estoque",
        is_active: true,
        created_at: "2026-11-10T18:00:00Z",
        role: "GESTOR",
      },
    ]);

    const mockSelect = vi.fn();
    renderWithProviders(
      <TenantList onCreateTenantClick={vi.fn()} onSelectTenant={mockSelect} />
    );

    const accessBtn = await screen.findByRole("button", {
      name: /Acessar Bancada/i,
    });
    fireEvent.click(accessBtn);

    await waitFor(() => {
      expect(storage.getActiveTenantId()).toBe("tenant-matriz");
      expect(storage.getActiveTenantRole()).toBe("GESTOR");
      expect(mockSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: "tenant-matriz", role: "GESTOR" })
      );
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("exibe estado de erro e permite tentar novamente com refetch", async () => {
    (tenantsApi.listTenantsWithRoles as any).mockRejectedValueOnce(
      new Error("Falha na conexão com a API")
    );

    renderWithProviders(<TenantList onCreateTenantClick={vi.fn()} />);

    expect(
      await screen.findByText(/Falha ao Carregar Almoxarifados/i)
    ).toBeDefined();
    expect(screen.getByText(/Falha na conexão com a API/i)).toBeDefined();

    (tenantsApi.listTenantsWithRoles as any).mockResolvedValueOnce([
      {
        id: "t-1",
        name: "Galpão Recuperado",
        slug: "galpao-rec",
        is_active: true,
        created_at: "2026-11-10T18:00:00Z",
        role: "AUDITOR",
      },
    ]);

    const retryBtn = screen.getByRole("button", { name: /Tentar Novamente/i });
    fireEvent.click(retryBtn);

    expect(await screen.findByText("Galpão Recuperado")).toBeDefined();
    expect(screen.getByText("AUDITOR")).toBeDefined();
  });
});
