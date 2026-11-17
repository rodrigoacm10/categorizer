import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TenantSwitcher } from "../TenantSwitcher";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";
import { tenantsApi } from "@/features/tenants/services/tenants.api";
import { TenantWithRole } from "@/features/tenants/types/tenant.types";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@/features/tenants/services/tenants.api", () => ({
  tenantsApi: {
    listTenantsWithRoles: vi.fn(),
  },
}));

describe("TenantSwitcher (FT-08)", () => {
  let queryClient: QueryClient;

  const mockTenants: TenantWithRole[] = [
    {
      id: "tenant-central",
      name: "Almoxarifado Central",
      slug: "almoxarifado-central",
      description: "Galpão Principal",
      role: "OWNER",
      is_active: true,
      created_at: "2026-11-10T10:00:00Z",
      updated_at: "2026-11-10T10:00:00Z",
    },
    {
      id: "tenant-filial",
      name: "Filial Sul - Peças",
      slug: "filial-sul",
      description: "Depósito Secundário",
      role: "ALMOXARIFE",
      is_active: true,
      created_at: "2026-11-10T10:00:00Z",
      updated_at: "2026-11-10T10:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWithProviders = (initialTenantId: string = "tenant-central") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TenantProvider initialTenantId={initialTenantId} initialRole="OWNER">
          <TenantSwitcher />
        </TenantProvider>
      </QueryClientProvider>
    );
  };

  it("renderiza o botão gatilho com o nome do almoxarifado ativo e papel", async () => {
    (tenantsApi.listTenantsWithRoles as any).mockResolvedValueOnce(mockTenants);

    renderWithProviders("tenant-central");

    await waitFor(() => {
      expect(screen.getByText("Almoxarifado Central")).toBeDefined();
    });

    const trigger = screen.getByRole("button", {
      name: /Alternar almoxarifado ativo/i,
    });
    expect(trigger).toBeDefined();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("abre o dropdown ao clicar e lista os almoxarifados com busca rápida", async () => {
    (tenantsApi.listTenantsWithRoles as any).mockResolvedValue(mockTenants);

    renderWithProviders("tenant-central");

    await screen.findByText("Almoxarifado Central");

    const trigger = screen.getByRole("button", {
      name: /Alternar almoxarifado ativo/i,
    });
    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    // Campo de busca rápida
    const searchInput = screen.getByPlaceholderText(/Filtrar por nome ou slug.../i);
    expect(searchInput).toBeDefined();

    // Opções listadas
    expect(await screen.findByRole("option", { name: /Filial Sul - Peças/i })).toBeDefined();
  });

  it("filtra almoxarifados pelo texto digitado no input de busca rápida", async () => {
    (tenantsApi.listTenantsWithRoles as any).mockResolvedValue(mockTenants);

    renderWithProviders("tenant-central");

    await screen.findByText("Almoxarifado Central");

    fireEvent.click(screen.getByRole("button", { name: /Alternar almoxarifado ativo/i }));

    const searchInput = screen.getByPlaceholderText(/Filtrar por nome ou slug.../i);
    fireEvent.change(searchInput, { target: { value: "sul" } });

    expect(await screen.findByText("Filial Sul - Peças")).toBeDefined();
    expect(screen.queryByRole("option", { name: /Almoxarifado Central/i })).toBeNull();
  });

  it("ao selecionar um novo almoxarifado, purga o cache de queries e redireciona para /dashboard", async () => {
    (tenantsApi.listTenantsWithRoles as any).mockResolvedValue(mockTenants);
    const clearSpy = vi.spyOn(queryClient, "clear");

    renderWithProviders("tenant-central");

    await screen.findByText("Almoxarifado Central");

    fireEvent.click(screen.getByRole("button", { name: /Alternar almoxarifado ativo/i }));

    // Clica no outro almoxarifado (Filial Sul)
    const filialOption = await screen.findByRole("option", { name: /Filial Sul - Peças/i });
    fireEvent.click(filialOption);

    // Deve purgar o cache do React Query
    expect(clearSpy).toHaveBeenCalled();

    // Deve redirecionar para a bancada
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("fecha o dropdown ao pressionar a tecla Escape", async () => {
    (tenantsApi.listTenantsWithRoles as any).mockResolvedValue(mockTenants);

    renderWithProviders("tenant-central");

    const trigger = screen.getByRole("button", { name: /Alternar almoxarifado ativo/i });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("permite navegar para /tenants pelo botão de gerenciar almoxarifados", async () => {
    (tenantsApi.listTenantsWithRoles as any).mockResolvedValue(mockTenants);

    renderWithProviders("tenant-central");

    fireEvent.click(screen.getByRole("button", { name: /Alternar almoxarifado ativo/i }));

    const manageBtn = screen.getByRole("button", {
      name: /Gerenciar \/ Criar Almoxarifado/i,
    });
    fireEvent.click(manageBtn);

    expect(mockPush).toHaveBeenCalledWith("/tenants");
  });
});
