import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import { render, screen } from "@testing-library/react";
import { useRBAC } from "../useRBAC";
import { Can } from "@/shared/components/Can";
import { TenantRole, ActionType, RBAC_PERMISSIONS_MATRIX } from "@/shared/types/rbac.types";
import { TenantProvider } from "@/features/tenants/hooks/useTenant";

describe("useRBAC", () => {
  describe("Critérios de Aceitação Obrigatórios", () => {
    it("usuário com papel ALMOXARIFE tem can('create_product') === false e can('stock_in') === true", () => {
      const { result } = renderHook(() => useRBAC("ALMOXARIFE"));
      expect(result.current.can("create_product")).toBe(false);
      expect(result.current.can("stock_in")).toBe(true);
      expect(result.current.can("stock_out")).toBe(true);
      expect(result.current.can("stock_adjustment")).toBe(true);
      expect(result.current.can("view_audit")).toBe(false);
      expect(result.current.can("reconcile_inventory")).toBe(false);
    });

    it("usuário com papel AUDITOR tem can('stock_in') === false e can('stock_adjustment') === true", () => {
      const { result } = renderHook(() => useRBAC("AUDITOR"));
      expect(result.current.can("stock_in")).toBe(false);
      expect(result.current.can("stock_out")).toBe(false);
      expect(result.current.can("stock_adjustment")).toBe(true);
      expect(result.current.can("create_product")).toBe(false);
      expect(result.current.can("view_audit")).toBe(true);
      expect(result.current.can("reconcile_inventory")).toBe(true);
    });

    it("usuário com papel OWNER tem todas as permissões ativas", () => {
      const { result } = renderHook(() => useRBAC("OWNER"));
      const allActions = Object.keys(RBAC_PERMISSIONS_MATRIX) as ActionType[];

      for (const action of allActions) {
        expect(result.current.can(action)).toBe(true);
      }
      expect(result.current.isOwner()).toBe(true);
    });

    it("usuário com papel GESTOR pode criar produtos, gerenciar categorias e dar entradas/saídas, mas não altera tenant nem membros de nível owner", () => {
      const { result } = renderHook(() => useRBAC("GESTOR"));
      expect(result.current.can("create_product")).toBe(true);
      expect(result.current.can("edit_product")).toBe(true);
      expect(result.current.can("stock_in")).toBe(true);
      expect(result.current.can("stock_out")).toBe(true);
      expect(result.current.can("stock_adjustment")).toBe(true);
      expect(result.current.can("manage_categories")).toBe(true);
      expect(result.current.can("invite_member")).toBe(true);

      // Bloqueados para GESTOR
      expect(result.current.can("manage_members")).toBe(false);
      expect(result.current.can("manage_tenant")).toBe(false);
      expect(result.current.isOwner()).toBe(false);
      expect(result.current.isGestor()).toBe(true);
    });

    it("usuário sem papel não possui nenhuma permissão", () => {
      const { result } = renderHook(() => useRBAC(null));
      expect(result.current.can("view_dashboard")).toBe(false);
      expect(result.current.can("create_product")).toBe(false);
      expect(result.current.can("stock_in")).toBe(false);
      expect(result.current.hasRole("OWNER")).toBe(false);
    });
  });

  describe("hasRole helper", () => {
    it("valida papel único ou lista de papéis", () => {
      const { result } = renderHook(() => useRBAC("ALMOXARIFE"));
      expect(result.current.hasRole("ALMOXARIFE")).toBe(true);
      expect(result.current.hasRole(["ALMOXARIFE", "GESTOR"])).toBe(true);
      expect(result.current.hasRole(["OWNER", "GESTOR"])).toBe(false);
    });
  });

  describe("integração com TenantProvider", () => {
    it("herda o papel definido no TenantProvider", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
          TenantProvider,
          { initialTenantId: "t-1", initialRole: "AUDITOR" as TenantRole },
          children
        );

      const { result } = renderHook(() => useRBAC(), { wrapper });
      expect(result.current.role).toBe("AUDITOR");
      expect(result.current.can("stock_adjustment")).toBe(true);
      expect(result.current.can("stock_in")).toBe(false);
    });
  });

  describe("componente <Can />", () => {
    it("renderiza children quando o usuário tem permissão", () => {
      render(
        React.createElement(
          Can,
          { I: "stock_in", role: "ALMOXARIFE" },
          React.createElement("span", { "data-testid": "allowed" }, "Botão Entrada")
        )
      );
      expect(screen.getByTestId("allowed")).toBeDefined();
    });

    it("renderiza fallback quando o usuário não tem permissão", () => {
      render(
        React.createElement(
          Can,
          {
            I: "create_product",
            role: "ALMOXARIFE",
            fallback: React.createElement("span", { "data-testid": "forbidden" }, "Sem Permissão"),
          },
          React.createElement("span", { "data-testid": "allowed" }, "Novo Produto")
        )
      );
      expect(screen.queryByTestId("allowed")).toBeNull();
      expect(screen.getByTestId("forbidden")).toBeDefined();
    });
  });
});
