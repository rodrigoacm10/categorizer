import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InviteMemberModal } from "../InviteMemberModal";
import { membersApi } from "../../services/members.api";
import { ProblemDetailsError } from "@/shared/lib/api-client";

vi.mock("../../services/members.api", () => ({
  membersApi: {
    inviteMember: vi.fn(),
  },
}));

describe("InviteMemberModal (FT-19)", () => {
  const tenantId = "t-tenant-1";
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o modal com campos de email, opções de papel e botões de ação", () => {
    render(
      <InviteMemberModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        tenantId={tenantId}
      />
    );

    expect(screen.getByTestId("invite-member-modal")).toBeDefined();
    expect(screen.getByTestId("member-email-input")).toBeDefined();
    expect(screen.getByTestId("role-option-ALMOXARIFE")).toBeDefined();
    expect(screen.getByTestId("role-option-GESTOR")).toBeDefined();
    expect(screen.getByTestId("role-option-AUDITOR")).toBeDefined();
    expect(screen.getByTestId("role-option-OWNER")).toBeDefined();
  });

  it("envia convite com sucesso para a API e dispara onSuccess", async () => {
    const mockNewMember = {
      user_id: "u-new-1",
      email: "novo@empresa.com",
      full_name: "Novo Colaborador",
      role: "GESTOR" as const,
      joined_at: "2026-11-16T12:00:00Z",
    };

    vi.mocked(membersApi.inviteMember).mockResolvedValueOnce(mockNewMember);

    render(
      <InviteMemberModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        tenantId={tenantId}
      />
    );

    const emailInput = screen.getByTestId("member-email-input");
    fireEvent.change(emailInput, { target: { value: "novo@empresa.com" } });

    const gestorRadio = screen.getByTestId("role-option-GESTOR").querySelector("input");
    if (gestorRadio) {
      fireEvent.click(gestorRadio);
    }

    const submitBtn = screen.getByTestId("submit-invite-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(membersApi.inviteMember).toHaveBeenCalledWith(tenantId, {
        email: "novo@empresa.com",
        role: "GESTOR",
      });
      expect(onSuccess).toHaveBeenCalledWith(mockNewMember);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("exibe banner de erro RFC 7807 quando a API rejeitar o convite", async () => {
    vi.mocked(membersApi.inviteMember).mockRejectedValueOnce(
      new ProblemDetailsError({
        type: "https://api.estoque.local/errors/member-already-exists",
        title: "Membro já associado",
        status: 409,
        detail: "O usuário com este email já possui vínculo ativo com este almoxarifado.",
      })
    );

    render(
      <InviteMemberModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        tenantId={tenantId}
      />
    );

    const emailInput = screen.getByTestId("member-email-input");
    fireEvent.change(emailInput, { target: { value: "existente@empresa.com" } });

    const submitBtn = screen.getByTestId("submit-invite-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId("invite-member-error-banner")).toBeDefined();
      expect(
        screen.getByText(/O usuário com este email já possui vínculo ativo/i)
      ).toBeDefined();
    });
  });

  it("fecha o modal ao clicar no botão cancelar ou no botão fechar (X)", () => {
    render(
      <InviteMemberModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        tenantId={tenantId}
      />
    );

    const cancelBtn = screen.getByTestId("cancel-invite-button");
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();

    const closeBtn = screen.getByTestId("close-invite-modal");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
