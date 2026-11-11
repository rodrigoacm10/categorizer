import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTenant, TenantProvider } from "../useTenant";
import { storage } from "@/shared/lib/storage";

describe("useTenant hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.clearAll();
  });

  it("utiliza fallback gracioso para ler/gravar diretamente no storage quando renderizado fora do Provider", () => {
    storage.setActiveTenantId("t-fallback");
    storage.setActiveTenantRole("OWNER");

    const { result } = renderHook(() => useTenant());

    expect(result.current.tenantId).toBe("t-fallback");
    expect(result.current.role).toBe("OWNER");

    act(() => {
      result.current.setTenant("t-novo", "GESTOR");
    });

    expect(storage.getActiveTenantId()).toBe("t-novo");
    expect(storage.getActiveTenantRole()).toBe("GESTOR");

    act(() => {
      result.current.clearTenant();
    });

    expect(storage.getActiveTenantId()).toBeNull();
    expect(storage.getActiveTenantRole()).toBeNull();
  });

  it("sincroniza tenantId e role com storage no TenantProvider", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        TenantProvider,
        { initialTenantId: "t-init", initialRole: "ALMOXARIFE" },
        children
      );

    const { result } = renderHook(() => useTenant(), { wrapper });

    expect(result.current.tenantId).toBe("t-init");
    expect(result.current.role).toBe("ALMOXARIFE");

    act(() => {
      result.current.setTenant("t-alterado", "AUDITOR");
    });

    expect(result.current.tenantId).toBe("t-alterado");
    expect(result.current.role).toBe("AUDITOR");
    expect(storage.getActiveTenantId()).toBe("t-alterado");
    expect(storage.getActiveTenantRole()).toBe("AUDITOR");

    act(() => {
      result.current.clearTenant();
    });

    expect(result.current.tenantId).toBeNull();
    expect(result.current.role).toBeNull();
    expect(storage.getActiveTenantId()).toBeNull();
    expect(storage.getActiveTenantRole()).toBeNull();
  });
});
