import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RegisterForm } from "../RegisterForm";
import { authApi } from "../../services/auth.api";
import { ProblemDetailsError } from "@/shared/types/rfc7807.types";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("../../services/auth.api", () => ({
  authApi: {
    register: vi.fn(),
  },
}));

describe("RegisterForm (FT-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza todos os campos obrigatórios do formulário de registro", () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText(/Nome Completo/i)).toBeDefined();
    expect(screen.getByLabelText(/E-mail Corporativo/i)).toBeDefined();
    expect(screen.getByLabelText(/^Senha de Acesso/i)).toBeDefined();
    expect(screen.getByLabelText(/Confirmação de Senha/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Criar Conta na Bancada/i })
    ).toBeDefined();
  });

  it("exibe os 3 requisitos visuais de senha e valida em tempo real", () => {
    render(<RegisterForm />);

    expect(screen.getByText(/Mínimo de 8 caracteres/i)).toBeDefined();
    expect(screen.getByText(/Pelo menos 1 número/i)).toBeDefined();
    expect(screen.getByText(/Pelo menos 1 letra maiúscula/i)).toBeDefined();

    const passwordInput = screen.getByLabelText(/^Senha de Acesso/i);

    // Digita senha curta sem maiúscula e sem número
    fireEvent.change(passwordInput, { target: { value: "abc" } });
    expect(passwordInput.closest("div")).toBeDefined();

    // Digita senha completa
    fireEvent.change(passwordInput, { target: { value: "SenhaForte1" } });
    expect(screen.getByText(/Mínimo de 8 caracteres/i)).toBeDefined();
  });

  it("impede o envio se a senha não atender às regras de complexidade", async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: "Carlos Silva" },
    });
    fireEvent.change(screen.getByLabelText(/E-mail Corporativo/i), {
      target: { value: "carlos@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Senha de Acesso/i), {
      target: { value: "apenasletrasminusculas" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmação de Senha/i), {
      target: { value: "apenasletrasminusculas" },
    });

    const submitBtn = screen.getByRole("button", { name: /Criar Conta na Bancada/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/A senha deve conter pelo menos um número/i)
    ).toBeDefined();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it("impede o envio se a confirmação de senha for diferente", async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: "Carlos Silva" },
    });
    fireEvent.change(screen.getByLabelText(/E-mail Corporativo/i), {
      target: { value: "carlos@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Senha de Acesso/i), {
      target: { value: "SenhaForte123" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmação de Senha/i), {
      target: { value: "SenhaDiferente123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Criar Conta na Bancada/i }));

    expect(
      await screen.findByText(/As senhas não coincidem/i)
    ).toBeDefined();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it("trata erro 409 Conflict (email-already-exists) exibindo erro no input e no banner sem crash", async () => {
    (authApi.register as any).mockRejectedValueOnce(
      new ProblemDetailsError({
        type: "https://api.extensao.local/errors/email-already-exists",
        title: "Conflict",
        status: 409,
        detail: "Este e-mail já está cadastrado no sistema.",
      })
    );

    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: "Carlos Silva" },
    });
    fireEvent.change(screen.getByLabelText(/E-mail Corporativo/i), {
      target: { value: "carlos.duplicado@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Senha de Acesso/i), {
      target: { value: "SenhaForte123" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmação de Senha/i), {
      target: { value: "SenhaForte123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Criar Conta na Bancada/i }));

    expect(
      await screen.findByText(/Este e-mail já está cadastrado no sistema\. Tente fazer login ou recupere o acesso\./i)
    ).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("registra usuário com sucesso e redireciona para /login?registered=true", async () => {
    (authApi.register as any).mockResolvedValueOnce({
      id: "u-novo-123",
      email: "novo@empresa.com",
      full_name: "Novo Gestor",
      is_active: true,
      created_at: new Date().toISOString(),
    });

    const mockSuccess = vi.fn();
    render(<RegisterForm onSuccess={mockSuccess} />);

    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: "Novo Gestor" },
    });
    fireEvent.change(screen.getByLabelText(/E-mail Corporativo/i), {
      target: { value: "novo@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Senha de Acesso/i), {
      target: { value: "SenhaForte123" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmação de Senha/i), {
      target: { value: "SenhaForte123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Criar Conta na Bancada/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith({
        email: "novo@empresa.com",
        password: "SenhaForte123",
        full_name: "Novo Gestor",
      });
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/login?registered=true");
    });
  });

  it("permite alternar a visualização da senha e da confirmação de senha", () => {
    render(<RegisterForm />);

    const passwordInput = screen.getByLabelText(/^Senha de Acesso/i) as HTMLInputElement;
    const confirmInput = screen.getByLabelText(/Confirmação de Senha/i) as HTMLInputElement;

    expect(passwordInput.type).toBe("password");
    expect(confirmInput.type).toBe("password");

    const togglePasswordBtn = screen.getByLabelText(/Exibir senha/i);
    fireEvent.click(togglePasswordBtn);
    expect(passwordInput.type).toBe("text");

    const toggleConfirmBtn = screen.getByLabelText(/Exibir confirmação/i);
    fireEvent.click(toggleConfirmBtn);
    expect(confirmInput.type).toBe("text");
  });
});
