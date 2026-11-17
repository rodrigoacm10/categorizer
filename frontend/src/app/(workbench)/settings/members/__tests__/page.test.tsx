import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MembersSettingsPage from "../page";
import { membersApi } from "@/features/settings/services/members.api";
import { useTenant } from "@/features/tenants/hooks/useTenant";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { TenantMember, TenantMembersSummary } from "@/features/settings/types/members.types";

vi.mock("@/features/tenants/hooks/useTenant");
vi.mock("@/features/auth/hooks/useAuth");
vi.mock("@/shared/hooks/useRBAC");
vi.mock("@/features/settings/services/members.api");

describe("MembersSettingsPage (/settings/members - FT-19 & FT-20)", () => {
  const mockSummary: TenantMembersSummary = {
    total_members: 3,
    owners_count: 1,
    gestores_count: 1,
    almoxarifes_count: 1,
    auditores_count: 0,
  };

  const mockMembers: TenantMember[] = [
    {
      user_id: "u-owner-1",
      email: "dono@empresa.com",
      full_name: "Dono do Galpão",
      role: "OWNER",
      joined_at: "2026-11-01T10:00:00Z",
    },
    {
      user_id: "u-gestor-1",
      email: "gestora@empresa.com",
      full_name: "Gestora Operacional",
      role: "GESTOR",
      joined_at: "2026-11-05T10:00:00Z",
    },
    {
      user_id: "u-almox-1",
      email: "operador@empresa.com",
      full_name: "Operador de Estoque",
      role: "ALMOXARIFE",
      joined_at: "2026-11-10T10:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useTenant).mockReturnValue({
      tenantId: "t-galpao-central",
      role: "OWNER",
      isLoading: false,
      setTenant: vi.fn(),
      clearTenant: vi.fn(),
    });

    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "u-owner-1",
        email: "dono@empresa.com",
        full_name: "Dono do Galpão",
        is_active: true,
        tenants: [],
      },
      isLoading: false,
      isAuthenticated: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.mocked(useRBAC).mockReturnValue({
      role: "OWNER",
      can: (action: string) => {
        if (action === "view_members") return true;
        if (action === "invite_member") return true;
        if (action === "manage_members") return true;
        return true;
      },
      hasRole: () => true,
      isOwner: () => true,
      isGestor: () => false,
      isAlmoxarife: () => false,
      isAuditor: () => false,
    });

    vi.mocked(membersApi.getMembersSummary).mockResolvedValue(mockSummary);
    vi.mocked(membersApi.listMembers).mockResolvedValue({
      items: mockMembers,
      totalCount: 3,
      totalPages: 1,
    });
  });

  it("bloqueia acesso com tela informativa se o usuário não tiver permissão view_members", async () => {
    vi.mocked(useRBAC).mockReturnValue({
      role: "ALMOXARIFE",
      can: () => false,
      hasRole: () => false,
      isOwner: () => false,
      isGestor: () => false,
      isAlmoxarife: () => true,
      isAuditor: () => false,
    });

    render(<MembersSettingsPage />);

    expect(screen.getByTestId("members-access-denied")).toBeDefined();
    expect(screen.getByText("Acesso Restrito à Governança")).toBeDefined();
  });

  it("carrega e renderiza KPIs, filtros e tabela de membros com sucesso para OWNER", async () => {
    render(<MembersSettingsPage />);

    expect(screen.getByTestId("members-settings-page")).toBeDefined();
    expect(screen.getByText("Gestão de Equipe e Membros")).toBeDefined();

    await waitFor(() => {
      expect(membersApi.getMembersSummary).toHaveBeenCalledWith("t-galpao-central");
      expect(membersApi.listMembers).toHaveBeenCalledWith("t-galpao-central", {
        limit: 100,
        offset: 0,
        role: undefined,
        search: undefined,
      });
    });

    // Indicadores do KPI Strip
    expect(screen.getByTestId("member-kpi-strip")).toBeDefined();
    expect(screen.getByTestId("kpi-value-total").textContent).toBe("3");
    expect(screen.getByTestId("kpi-value-owners").textContent).toBe("1");

    // Tabela e linhas de membros
    expect(screen.getByTestId("member-row-u-owner-1")).toBeDefined();
    expect(screen.getByTestId("member-row-u-gestor-1")).toBeDefined();
    expect(screen.getByTestId("member-row-u-almox-1")).toBeDefined();

    // Botão de convidar membro visível para quem tem can("invite_member")
    expect(screen.getByTestId("invite-member-button")).toBeDefined();
  });

  it("filtra membros reativamente ao digitar na busca ou clicar em pílula de papel", async () => {
    render(<MembersSettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("member-row-u-owner-1")).toBeDefined();
    });

    const searchInput = screen.getByTestId("member-search-input");
    fireEvent.change(searchInput, { target: { value: "gestora" } });

    await waitFor(() => {
      expect(membersApi.listMembers).toHaveBeenCalledWith("t-galpao-central", {
        limit: 100,
        offset: 0,
        role: undefined,
        search: "gestora",
      });
    });

    const gestoresPill = screen.getByTestId("role-pill-GESTOR");
    fireEvent.click(gestoresPill);

    await waitFor(() => {
      expect(membersApi.listMembers).toHaveBeenCalledWith("t-galpao-central", {
        limit: 100,
        offset: 0,
        role: "GESTOR",
        search: "gestora",
      });
    });
  });

  it("abre modal de convite ao clicar em Convidar Membro", async () => {
    render(<MembersSettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("invite-member-button")).toBeDefined();
    });

    const inviteBtn = screen.getByTestId("invite-member-button");
    fireEvent.click(inviteBtn);

    expect(screen.getByTestId("invite-member-modal")).toBeDefined();
  });
});
