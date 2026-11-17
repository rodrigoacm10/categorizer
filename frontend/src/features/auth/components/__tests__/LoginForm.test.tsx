import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "../LoginForm";
import { authApi } from "../../services/auth.api";
import { storage } from "@/shared/lib/storage";
import { ProblemDetailsError } from "@/shared/types/rfc7807.types";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";

const mockPush = vi.fn();
let mockSearchParamsGet = vi.fn().mockReturnValue(null);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}));

vi.mock("../../services/auth.api", () => ({
  authApi: {
    login: vi.fn(),
    getMe: vi.fn(),
  },
}));

describe("LoginForm (FT-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.clearAll();
    mockSearchParamsGet = vi.fn().mockReturnValue(null);
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(<TenantProvider>{ui}</TenantProvider>);
  };

  it("renderiza os campos de e-mail institucional e senha de acesso", () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByLabelText(/E-mail Institucional/i)).toBeDefined();
    expect(screen.getByLabelText(/Senha de Acesso/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Entrar na Bancada/i })).toBeDefined();
  });

  it("impede o envio se o e-mail for inválido ou a senha tiver menos de 8 caracteres", async () => {
    renderWithProviders(<LoginForm />);

    const submitBtn = screen.getByRole("button", { name: /Entrar na Bancada/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/E-mail institucional é obrigatório/i)
    ).toBeDefined();
    expect(
      await screen.findByText(/Senha de acesso é obrigatória/i)
    ).toBeDefined();
    expect(authApi.login).not.toHaveBeenCalled();

    // Testa e-mail inválido
    const emailInput = screen.getByLabelText(/E-mail Institucional/i);
    fireEvent.change(emailInput, { target: { value: "invalido-sem-arroba" } });

    // Testa senha curta
    const passwordInput = screen.getByLabelText(/Senha de Acesso/i);
    fireEvent.change(passwordInput, { target: { value: "12345" } });

    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/Informe um endereço de e-mail válido/i)
    ).toBeDefined();
    expect(
      await screen.findByText(/A senha deve conter no mínimo 8 caracteres/i)
    ).toBeDefined();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it("alterna a visibilidade da senha entre texto e password ao clicar no botão de revelação", () => {
    renderWithProviders(<LoginForm />);

    const passwordInput = screen.getByLabelText(/Senha de Acesso/i) as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    const toggleBtn = screen.getByLabelText(/Exibir senha/i);
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe("text");

    const hideBtn = screen.getByLabelText(/Ocultar senha/i);
    fireEvent.click(hideBtn);
    expect(passwordInput.type).toBe("password");
  });

  it("redireciona para /dashboard automaticamente se o usuário pertencer a exatamente 1 tenant", async () => {
    (authApi.login as any).mockResolvedValueOnce({
      access_token: "jwt-token-xyz",
      token_type: "bearer",
      expires_in: 3600,
    });

    (authApi.getMe as any).mockResolvedValueOnce({
      id: "u-1",
      email: "operador@empresa.com",
      full_name: "Operador Teste",
      is_active: true,
      tenants: [
        {
          tenant_id: "tenant-matriz",
          tenant_name: "Almoxarifado Matriz",
          tenant_slug: "matriz",
          role: "ALMOXARIFE",
        },
      ],
    });

    renderWithProviders(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/E-mail Institucional/i), {
      target: { value: "operador@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText(/Senha de Acesso/i), {
      target: { value: "SenhaForte123" },
    });

    const submitBtn = screen.getByRole("button", { name: /Entrar na Bancada/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: "operador@empresa.com",
        password: "SenhaForte123",
      });
      expect(storage.getToken()).toBe("jwt-token-xyz");
      expect(storage.getActiveTenantId()).toBe("tenant-matriz");
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("redireciona para /tenants se o usuário possuir múltiplos tenants", async () => {
    (authApi.login as any).mockResolvedValueOnce({
      access_token: "jwt-token-xyz",
      token_type: "bearer",
      expires_in: 3600,
    });

    (authApi.getMe as any).mockResolvedValueOnce({
      id: "u-1",
      email: "gestor@empresa.com",
      full_name: "Gestor Multi",
      is_active: true,
      tenants: [
        {
          tenant_id: "tenant-1",
          tenant_name: "Galpão 1",
          tenant_slug: "galpao-1",
          role: "GESTOR",
        },
        {
          tenant_id: "tenant-2",
          tenant_name: "Galpão 2",
          tenant_slug: "galpao-2",
          role: "ALMOXARIFE",
        },
      ],
    });

    renderWithProviders(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/E-mail Institucional/i), {
      target: { value: "gestor@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText(/Senha de Acesso/i), {
      target: { value: "SenhaForte123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Entrar na Bancada/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/tenants");
    });
  });

  it("redireciona para /tenants se o usuário possuir zero tenants vinculados", async () => {
    (authApi.login as any).mockResolvedValueOnce({
      access_token: "jwt-token-xyz",
      token_type: "bearer",
      expires_in: 3600,
    });

    (authApi.getMe as any).mockResolvedValueOnce({
      id: "u-1",
      email: "novo@empresa.com",
      full_name: "Novo Usuário",
      is_active: true,
      tenants: [],
    });

    renderWithProviders(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/E-mail Institucional/i), {
      target: { value: "novo@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText(/Senha de Acesso/i), {
      target: { value: "SenhaForte123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Entrar na Bancada/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/tenants");
    });
  });

  it("exibe banner de erro RFC 7807 para credenciais inválidas (status 401)", async () => {
    (authApi.login as any).mockRejectedValueOnce(
      new ProblemDetailsError({
        type: "https://api.extensao.local/errors/invalid-credentials",
        title: "Unauthorized",
        status: 401,
        detail: "E-mail ou senha incorretos.",
      })
    );

    renderWithProviders(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/E-mail Institucional/i), {
      target: { value: "operador@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText(/Senha de Acesso/i), {
      target: { value: "SenhaErrada123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Entrar na Bancada/i }));

    expect(
      await screen.findByText(/E-mail ou senha incorretos\. Verifique suas credenciais\./i)
    ).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("exibe banner de erro RFC 7807 para usuário inativo (status 403)", async () => {
    (authApi.login as any).mockRejectedValueOnce(
      new ProblemDetailsError({
        type: "https://api.extensao.local/errors/user-inactive",
        title: "Forbidden",
        status: 403,
        detail: "Usuário desativado.",
      })
    );

    renderWithProviders(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/E-mail Institucional/i), {
      target: { value: "inativo@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText(/Senha de Acesso/i), {
      target: { value: "SenhaCorreta123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Entrar na Bancada/i }));

    expect(
      await screen.findByText(/Esta conta de usuário encontra-se desativada\. Contate o administrador\./i)
    ).toBeDefined();
  });

  it("exibe banner de sucesso quando redirecionado do cadastro (?registered=true)", () => {
    mockSearchParamsGet = vi.fn().mockImplementation((key: string) => {
      if (key === "registered") return "true";
      return null;
    });

    renderWithProviders(<LoginForm />);

    expect(screen.getByText(/Conta criada com sucesso!/i)).toBeDefined();
  });
});
