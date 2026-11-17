import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BalancePreview } from "../BalancePreview";

describe("BalancePreview (FT-18)", () => {
  it("renderiza os 3 blocos contábeis com fonte monoespaçada e alinhamento tabular", () => {
    render(
      <BalancePreview
        currentQuantity={10}
        movementType="IN"
        quantityInput="5"
        unit="KG"
      />
    );

    expect(screen.getByText("Saldo Físico Atual")).toBeDefined();
    expect(screen.getByText("Delta da Operação")).toBeDefined();
    expect(screen.getByText("Saldo Físico Projetado")).toBeDefined();

    const currentVal = screen.getByTestId("current-balance-value");
    const deltaVal = screen.getByTestId("delta-value");
    const projectedVal = screen.getByTestId("projected-balance-value");

    expect(currentVal.textContent).toContain("10 KG");
    expect(currentVal.className).toContain("font-mono");
    expect(currentVal.className).toContain("tabular-nums");

    expect(deltaVal.textContent).toContain("+5 KG");
    expect(deltaVal.className).toContain("font-mono");
    expect(deltaVal.className).toContain("tabular-nums");
    expect(deltaVal.className).toContain("text-emerald-700");

    expect(projectedVal.textContent).toContain("15 KG");
    expect(projectedVal.className).toContain("font-mono");
    expect(projectedVal.className).toContain("tabular-nums");
  });

  it("renderiza saída (OUT) com delta negativo formatado", () => {
    render(
      <BalancePreview
        currentQuantity={20}
        movementType="OUT"
        quantityInput="4"
        unit="UN"
      />
    );

    const deltaVal = screen.getByTestId("delta-value");
    const projectedVal = screen.getByTestId("projected-balance-value");

    expect(deltaVal.textContent).toContain("-4 UN");
    expect(projectedVal.textContent).toContain("16 UN");
    expect(screen.queryByTestId("negative-balance-alert")).toBeNull();
  });

  it("transiciona para alerta vermelho e exibe mensagem de bloqueio em saldo negativo", () => {
    render(
      <BalancePreview
        currentQuantity={5}
        movementType="OUT"
        quantityInput="10"
        unit="KG"
      />
    );

    const container = screen.getByTestId("balance-preview");
    expect(container.className).toContain("border-rose-400");
    expect(container.className).toContain("bg-rose-50");
    expect(container.className).toContain("text-rose-900");

    const alert = screen.getByTestId("negative-balance-alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain(
      "Operação bloqueada: A quantidade solicitada excede o saldo físico disponível."
    );

    const projectedVal = screen.getByTestId("projected-balance-value");
    expect(projectedVal.className).toContain("text-rose-700");
  });

  it("renderiza ajuste físico (ADJUSTMENT) com símbolo delta Δ", () => {
    render(
      <BalancePreview
        currentQuantity={10}
        movementType="ADJUSTMENT"
        quantityInput="12"
        unit="M"
      />
    );

    const deltaVal = screen.getByTestId("delta-value");
    expect(deltaVal.textContent).toContain("Δ +2 M");
    expect(deltaVal.className).toContain("text-indigo-700");

    const projectedVal = screen.getByTestId("projected-balance-value");
    expect(projectedVal.textContent).toContain("12 M");
  });

  it("aceita simulação pré-calculada via prop", () => {
    const mockSimulation = {
      projectedBalance: 25000,
      projectedBalanceRaw: 25,
      delta: 5000,
      deltaRaw: 5,
      isNegative: false,
      isValid: true,
      formattedDelta: "+5 CX",
      formattedProjectedBalance: "25 CX",
      formattedCurrentBalance: "20 CX",
    };

    render(
      <BalancePreview
        movementType="IN"
        simulation={mockSimulation}
      />
    );

    expect(screen.getByTestId("current-balance-value").textContent).toContain("20 CX");
    expect(screen.getByTestId("delta-value").textContent).toContain("+5 CX");
    expect(screen.getByTestId("projected-balance-value").textContent).toContain("25 CX");
  });
});
