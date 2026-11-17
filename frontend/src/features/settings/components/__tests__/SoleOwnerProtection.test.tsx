import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemberListTable, SOLE_OWNER_TOOLTIP_TEXT } from "../MemberListTable";
import { TenantMember } from "../../types/members.types";

describe("SoleOwnerProtection (FT-20)", () => {
  const soleOwnerMember: TenantMember = {
    user_id: "u-sole-owner",
    email: "proprietario@empresa.com",
    full_name: "Único Proprietário",
    role: "OWNER",
    joined_at: "2026-11-01T10:00:00Z",
  };

  const gestorMember: TenantMember = {
    user_id: "u-gestor",
    email: "gestor@empresa.com",
    full_name: "Mariana Gestora",
    role: "GESTOR",
    joined_at: "2026-11-05T14:30:00Z",
  };

  const secondOwnerMember: TenantMember = {
    user_id: "u-second-owner",
    email: "segundo.proprietario@empresa.com",
    full_name: "Segundo Proprietário",
    role: "OWNER",
    joined_at: "2026-11-08T11:00:00Z",
  };

  const onRoleChange = vi.fn();
  const onRemoveMember = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("trava o dropdown de papel (disabled) quando houver apenas 1 OWNER ativo", () => {
    render(
      <MemberListTable
        members={[soleOwnerMember, gestorMember]}
        canManageMembers={true}
        ownersCount={1}
        onRoleChange={onRoleChange}
        onRemoveMember={onRemoveMember}
      />
    );

    const ownerSelect = screen.getByTestId("role-select-u-sole-owner") as HTMLSelectElement;
    expect(ownerSelect).toBeDefined();
    expect(ownerSelect.disabled).toBe(true);
    expect(ownerSelect.getAttribute("title")).toBe(SOLE_OWNER_TOOLTIP_TEXT);

    // Gestor não é sole owner, logo seu dropdown permanece habilitado
    const gestorSelect = screen.getByTestId("role-select-u-gestor") as HTMLSelectElement;
    expect(gestorSelect.disabled).toBe(false);
  });

  it("trava o botão de remover membro (disabled) para o único OWNER", () => {
    render(
      <MemberListTable
        members={[soleOwnerMember, gestorMember]}
        canManageMembers={true}
        ownersCount={1}
        onRoleChange={onRoleChange}
        onRemoveMember={onRemoveMember}
      />
    );

    const removeOwnerBtn = screen.getByTestId("remove-member-btn-u-sole-owner") as HTMLButtonElement;
    expect(removeOwnerBtn).toBeDefined();
    expect(removeOwnerBtn.disabled).toBe(true);
    expect(removeOwnerBtn.getAttribute("title")).toBe(SOLE_OWNER_TOOLTIP_TEXT);

    // Botão de remover do gestor continua habilitado
    const removeGestorBtn = screen.getByTestId("remove-member-btn-u-gestor") as HTMLButtonElement;
    expect(removeGestorBtn.disabled).toBe(false);
  });

  it("exibe badge visual indicando 'Único Titular' para o sole owner", () => {
    render(
      <MemberListTable
        members={[soleOwnerMember, gestorMember]}
        canManageMembers={true}
        ownersCount={1}
        onRoleChange={onRoleChange}
        onRemoveMember={onRemoveMember}
      />
    );

    const badge = screen.getByTestId("sole-owner-badge-u-sole-owner");
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("Único Titular");
  });

  it("habilita alteração de papel e remoção quando existirem 2 ou mais OWNERs ativos", () => {
    render(
      <MemberListTable
        members={[soleOwnerMember, secondOwnerMember, gestorMember]}
        canManageMembers={true}
        ownersCount={2}
        onRoleChange={onRoleChange}
        onRemoveMember={onRemoveMember}
      />
    );

    // Ambos os owners devem ter dropdowns habilitados
    const firstOwnerSelect = screen.getByTestId("role-select-u-sole-owner") as HTMLSelectElement;
    expect(firstOwnerSelect.disabled).toBe(false);

    const secondOwnerSelect = screen.getByTestId("role-select-u-second-owner") as HTMLSelectElement;
    expect(secondOwnerSelect.disabled).toBe(false);

    // Botões de remover de ambos devem estar habilitados
    const removeFirstBtn = screen.getByTestId("remove-member-btn-u-sole-owner") as HTMLButtonElement;
    expect(removeFirstBtn.disabled).toBe(false);

    const removeSecondBtn = screen.getByTestId("remove-member-btn-u-second-owner") as HTMLButtonElement;
    expect(removeSecondBtn.disabled).toBe(false);

    // Não deve haver badge de único titular
    expect(screen.queryByTestId("sole-owner-badge-u-sole-owner")).toBeNull();
  });

  it("bloqueia remoção no modal caso o membro alvo seja o único titular", () => {
    render(
      <MemberListTable
        members={[soleOwnerMember]}
        canManageMembers={true}
        ownersCount={1}
        onRoleChange={onRoleChange}
        onRemoveMember={onRemoveMember}
      />
    );

    // O botão na tabela já está desabilitado, garantindo proteção em camada dupla
    const removeOwnerBtn = screen.getByTestId("remove-member-btn-u-sole-owner") as HTMLButtonElement;
    expect(removeOwnerBtn.disabled).toBe(true);
    fireEvent.click(removeOwnerBtn);

    // Modal não deve ser aberto
    expect(screen.queryByTestId("confirm-remove-modal")).toBeNull();
  });
});
