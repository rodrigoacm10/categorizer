import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickActionToolbar } from "../QuickActionToolbar";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";
import { TenantRole } from "@/shared/types/rbac.types";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("QuickActionToolbar (FT-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRole = (role: TenantRole, onSearchSubmit?: (q: string) => void) => {
    return render(
      <TenantProvider initialTenantId="tenant-test-123" initialRole={role}>
        <QuickActionToolbar onSearchSubmit={onSearchSubmit} />
      </TenantProvider>
    );
  };

  describe("Permissões RBAC para Papel AUDITOR", () => {
    it("desabilita Entrada (+) e Saída (-) com tooltips explicativos, mas mantém Ajuste (Δ) habilitado", () => {
      renderWithRole("AUDITOR");

      // Botão Registrar Entrada (+) deve estar desabilitado
      const entradaBtn = screen.getByRole("button", {
        name: /Registrar Entrada de Estoque \(Desabilitado\)/i,
      });
      expect(entradaBtn).toBeDefined();
      expect(entradaBtn.getAttribute("disabled")).not.toBeNull();
      expect(entradaBtn.getAttribute("title")).toContain(
        "Papel AUDITOR não tem permissão para registrar entradas físicas"
      );

      // Botão Registrar Saída (-) deve estar desabilitado
      const saidaBtn = screen.getByRole("button", {
        name: /Registrar Saída de Estoque \(Desabilitado\)/i,
      });
      expect(saidaBtn).toBeDefined();
      expect(saidaBtn.getAttribute("disabled")).not.toBeNull();
      expect(saidaBtn.getAttribute("title")).toContain(
        "Papel AUDITOR não tem permissão para registrar saídas físicas"
      );

      // Botão Ajuste de Inventário (Δ) DEVE ser um link habilitado
      const ajusteLink = screen.getByRole("link", {
        name: /Ajuste de Inventário/i,
      });
      expect(ajusteLink).toBeDefined();
      expect(ajusteLink.getAttribute("href")).toBe("/inventory/move?mode=ADJUSTMENT");
    });
  });

  describe("Permissões RBAC para Papel ALMOXARIFE", () => {
    it("habilita Entrada (+), Saída (-) e Ajuste (Δ)", () => {
      renderWithRole("ALMOXARIFE");

      const entradaLink = screen.getByRole("link", {
        name: /Registrar Entrada de Estoque/i,
      });
      expect(entradaLink.getAttribute("href")).toBe("/inventory/move?mode=IN");

      const saidaLink = screen.getByRole("link", {
        name: /Registrar Saída de Estoque/i,
      });
      expect(saidaLink.getAttribute("href")).toBe("/inventory/move?mode=OUT");

      const ajusteLink = screen.getByRole("link", {
        name: /Ajuste de Inventário/i,
      });
      expect(ajusteLink.getAttribute("href")).toBe("/inventory/move?mode=ADJUSTMENT");
    });
  });

  describe("Permissões RBAC para Papel GESTOR", () => {
    it("habilita todas as ações rápidas", () => {
      renderWithRole("GESTOR");

      expect(screen.getByRole("link", { name: /Registrar Entrada de Estoque/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /Registrar Saída de Estoque/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /Ajuste de Inventário/i })).toBeDefined();
    });
  });

  describe("Permissões RBAC para Papel OWNER", () => {
    it("habilita todas as ações rápidas com acesso irrestrito", () => {
      renderWithRole("OWNER");

      expect(screen.getByRole("link", { name: /Registrar Entrada de Estoque/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /Registrar Saída de Estoque/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /Ajuste de Inventário/i })).toBeDefined();
    });
  });

  describe("Busca Rápida de Código / SKU (Ctrl+K)", () => {
    it("renderiza o input com atalho Ctrl+K e permite submissão de busca", () => {
      const mockSearch = vi.fn();
      renderWithRole("OWNER", mockSearch);

      const searchInput = screen.getByPlaceholderText(/Buscar produto, código ou EAN \(Ctrl\+K\)/i);
      expect(searchInput).toBeDefined();
      expect(searchInput.getAttribute("id")).toBe("quick-search-input");
      expect(searchInput.getAttribute("data-quick-search")).toBe("true");

      fireEvent.change(searchInput, { target: { value: "PARAFUSO-M8" } });
      fireEvent.submit(searchInput.closest("form")!);

      expect(mockSearch).toHaveBeenCalledWith("PARAFUSO-M8");
    });

    it("redireciona para /products?search=... se nenhum callback customizado for fornecido", () => {
      renderWithRole("OWNER");

      const searchInput = screen.getByPlaceholderText(/Buscar produto, código ou EAN \(Ctrl\+K\)/i);
      fireEvent.change(searchInput, { target: { value: "CABO-10MM" } });
      fireEvent.submit(searchInput.closest("form")!);

      expect(mockPush).toHaveBeenCalledWith("/products?search=CABO-10MM");
    });
  });
});
