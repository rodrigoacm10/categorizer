import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateTenantModal } from "../CreateTenantModal";
import { tenantsApi } from "../../services/tenants.api";
import { TenantProvider } from "../../hooks/useTenant";
import { storage } from "@/shared/lib/storage";
import { ProblemDetailsError } from "@/shared/types/rfc7807.types";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("../../services/tenants.api", () => ({
  tenantsApi: {
    createTenant: vi.fn(),
  },
}));

describe("CreateTenantModal (FT-07)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    storage.clearAll();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
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

  it("não renderiza nada quando isOpen for false", () => {
    const { container } = renderWithProviders(
      <CreateTenantModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("gera automaticamente o slug em kebab-case a partir do nome do almoxarifado", () => {
    renderWithProviders(
      <CreateTenantModal isOpen={true} onClose={vi.fn()} />
    );

    const nameInput = screen.getByLabelText(/Nome do Almoxarifado/i);
    const slugInput = screen.getByLabelText(/Slug Identificador/i) as HTMLInputElement;

    fireEvent.change(nameInput, {
      target: { value: "Almoxarifado Central - Galpão 3!" },
    });

    expect(slugInput.value).toBe("almoxarifado-central-galpao-3");
  });

  it("permite edição manual do slug sem sobrescrever quando o nome mudar depois", () => {
    renderWithProviders(
      <CreateTenantModal isOpen={true} onClose={vi.fn()} />
    );

    const nameInput = screen.getByLabelText(/Nome do Almoxarifado/i);
    const slugInput = screen.getByLabelText(/Slug Identificador/i) as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: "Almoxarifado" } });
    expect(slugInput.value).toBe("almoxarifado");

    // Edita o slug manualmente
    fireEvent.change(slugInput, { target: { value: "meu-slug-personalizado" } });
    expect(slugInput.value).toBe("meu-slug-personalizado");

    // Altera o nome novamente; slug manual não deve ser sobrescrito
    fireEvent.change(nameInput, { target: { value: "Almoxarifado Novo" } });
    expect(slugInput.value).toBe("meu-slug-personalizado");
  });

  it("valida campos obrigatórios e formato de slug", async () => {
    renderWithProviders(
      <CreateTenantModal isOpen={true} onClose={vi.fn()} />
    );

    const submitBtn = screen.getByRole("button", {
      name: /Criar e Assumir Gestão/i,
    });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/O nome do almoxarifado deve ter no mínimo 2 caracteres/i)
    ).toBeDefined();
    expect(tenantsApi.createTenant).not.toHaveBeenCalled();

    // Testa slug com caracteres proibidos (ex: maiúsculas ou símbolos)
    const nameInput = screen.getByLabelText(/Nome do Almoxarifado/i);
    const slugInput = screen.getByLabelText(/Slug Identificador/i);

    fireEvent.change(nameInput, { target: { value: "Depósito" } });
    fireEvent.change(slugInput, { target: { value: "slug COM MAIÚSCULA!" } });

    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/O slug deve conter apenas letras minúsculas sem acento, números e hífens/i)
    ).toBeDefined();
  });

  it("cria o tenant com sucesso, define o criador como OWNER e redireciona para /dashboard", async () => {
    (tenantsApi.createTenant as any).mockResolvedValueOnce({
      id: "novo-tenant-999",
      name: "Almoxarifado Peças Pesadas",
      slug: "pecas-pesadas",
      description: "Estoque mecânico",
      is_active: true,
      created_at: new Date().toISOString(),
    });

    const mockClose = vi.fn();
    const mockSuccess = vi.fn();

    renderWithProviders(
      <CreateTenantModal
        isOpen={true}
        onClose={mockClose}
        onSuccess={mockSuccess}
      />
    );

    fireEvent.change(screen.getByLabelText(/Nome do Almoxarifado/i), {
      target: { value: "Almoxarifado Peças Pesadas" },
    });
    fireEvent.change(screen.getByLabelText(/Slug Identificador/i), {
      target: { value: "pecas-pesadas" },
    });
    fireEvent.change(screen.getByLabelText(/Finalidade Operacional/i), {
      target: { value: "Estoque mecânico" },
    });

    const submitBtn = screen.getByRole("button", {
      name: /Criar e Assumir Gestão/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(tenantsApi.createTenant).toHaveBeenCalledWith({
        name: "Almoxarifado Peças Pesadas",
        slug: "pecas-pesadas",
        description: "Estoque mecânico",
      });
      expect(storage.getActiveTenantId()).toBe("novo-tenant-999");
      expect(storage.getActiveTenantRole()).toBe("OWNER");
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("trata erro 409 Conflict para slug repetido com feedback direto no input de slug", async () => {
    (tenantsApi.createTenant as any).mockRejectedValueOnce(
      new ProblemDetailsError({
        type: "https://api.extensao.local/errors/tenant-slug-already-exists",
        title: "Conflict",
        status: 409,
        detail: "Slug 'matriz' já está em uso por outro tenant.",
      })
    );

    renderWithProviders(
      <CreateTenantModal isOpen={true} onClose={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText(/Nome do Almoxarifado/i), {
      target: { value: "Matriz" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Criar e Assumir Gestão/i })
    );

    expect(
      await screen.findByText(
        /Este identificador já está em uso por outro almoxarifado\. Escolha um nome diferente\./i
      )
    ).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("fecha o modal ao clicar em Cancelar ou pressionar ESC", () => {
    const mockClose = vi.fn();
    renderWithProviders(
      <CreateTenantModal isOpen={true} onClose={mockClose} />
    );

    const cancelBtn = screen.getByRole("button", { name: /Cancelar/i });
    fireEvent.click(cancelBtn);
    expect(mockClose).toHaveBeenCalledTimes(1);

    // Testa ESC
    fireEvent.keyDown(window, { key: "Escape" });
    expect(mockClose).toHaveBeenCalledTimes(2);
  });
});
