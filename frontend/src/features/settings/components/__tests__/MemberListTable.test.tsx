import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemberListTable } from "../MemberListTable";
import { TenantMember } from "../../types/members.types";

describe("MemberListTable (FT-19)", () => {
  const mockMembers: TenantMember[] = [
    {
      user_id: "u-owner",
      email: "owner@empresa.com",
      full_name: "Carlos Dono",
      role: "OWNER",
      joined_at: "2026-11-01T10:00:00Z",
    },
    {
      user_id: "u-gestor",
      email: "gestor@empresa.com",
      full_name: "Mariana Gestora",
      role: "GESTOR",
      joined_at: "2026-11-05T14:30:00Z",
    },
    {
      user_id: "u-almox",
      email: "almox@empresa.com",
      full_name: "Pedro Almoxarife",
      role: "ALMOXARIFE",
      joined_at: "2026-11-10T08:15:00Z",
    },
  ];

  const onRoleChange = vi.fn();
  const onRemoveMember = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza lista de membros com dados de nome, email e data de ingresso", () => {
    render(
      <MemberListTable
        members={mockMembers}
        canManageMembers={true}
        ownersCount={2}
        onRoleChange={onRoleChange}
        onRemoveMember={onRemoveMember}
      />
    );

    expect(screen.getByTestId("member-list-table")).toBeDefined();
    expect(screen.getByText("Carlos Dono")).toBeDefined();
    expect(screen.getByText("owner@empresa.com")).toBeDefined();
    expect(screen.getByText("Mariana Gestora")).toBeDefined();
    expect(screen.getByText("gestor@empresa.com")).toBeDefined();
    expect(screen.getByText("Pedro Almoxarife")).toBeDefined();
  });

  it("permite que OWNER altere o papel de um membro via dropdown", async () => {
    onRoleChange.mockResolvedValueOnce(undefined);

    render(
      <MemberListTable
        members={mockMembers}
        canManageMembers={true}
        ownersCount={2}
        onRoleChange={onRoleChange}
        onRemoveMember={onRemoveMember}
      />
    );

    const gestorSelect = screen.getByTestId("role-select-u-gestor") as HTMLSelectElement;
    expect(gestorSelect).toBeDefined();
    expect(gestorSelect.value).toBe("GESTOR");

    fireEvent.change(gestorSelect, { target: { value: "ALMOXARIFE" } });

    await waitFor(() => {
      expect(onRoleChange).toHaveBeenCalledWith("u-gestor", "ALMOXARIFE");
    });
  });

  it("exibe badges somente-leitura e omite botões de exclusão quando canManageMembers for false (ex: GESTOR)", () => {
    render(
      <MemberListTable
        members={mockMembers}
        canManageMembers={false}
        ownersCount={2}
        onRoleChange={onRoleChange}
        onRemoveMember={onRemoveMember}
      />
    );

    // Dropdowns não devem existir
    expect(screen.queryByTestId("role-select-u-gestor")).toBeNull();

    // Badges estáticos devem existir
    expect(screen.getByTestId("role-badge-u-gestor").textContent).toContain("Gestor");
    expect(screen.getByTestId("role-badge-u-almox").textContent).toContain("Almoxarife");

    // Botões de remoção não devem estar presentes
    expect(screen.queryByTestId("remove-member-btn-u-gestor")).toBeNull();
  });

  it("abre modal de confirmação e remove membro ao confirmar", async () => {
    onRemoveMember.mockResolvedValueOnce(undefined);

    render(
      <MemberListTable
        members={mockMembers}
        canManageMembers={true}
        ownersCount={2}
        onRoleChange={onRoleChange}
        onRemoveMember={onRemoveMember}
      />
    );

    const removeBtn = screen.getByTestId("remove-member-btn-u-almox");
    fireEvent.click(removeBtn);

    expect(screen.getByTestId("confirm-remove-modal")).toBeDefined();
    expect(screen.getByText(/Tem certeza que deseja remover o vínculo de/i)).toBeDefined();

    const confirmBtn = screen.getByTestId("confirm-remove-button");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onRemoveMember).toHaveBeenCalledWith("u-almox");
    });
  });

  it("exibe estado vazio amigável quando nenhum membro for retornado", () => {
    render(
      <MemberListTable
        members={[]}
        canManageMembers={true}
        ownersCount={0}
        onRoleChange={onRoleChange}
        onRemoveMember={onRemoveMember}
      />
    );

    expect(screen.getByTestId("empty-members-row")).toBeDefined();
    expect(screen.getByText("Nenhum membro localizado")).toBeDefined();
  });
});
