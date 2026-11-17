import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStockSimulation } from "../useStockSimulation";

describe("useStockSimulation (FT-18)", () => {
  it("calcula projeção correta para Entrada (IN) com sinal explícito +", () => {
    const { result } = renderHook(() =>
      useStockSimulation({
        currentQuantity: 10,
        movementType: "IN",
        quantityInput: "5",
        unit: "KG",
      })
    );

    expect(result.current.projectedBalance).toBe(15000); // 15 KG em escala 10^3
    expect(result.current.projectedBalanceRaw).toBe(15);
    expect(result.current.delta).toBe(5000);
    expect(result.current.deltaRaw).toBe(5);
    expect(result.current.isNegative).toBe(false);
    expect(result.current.isValid).toBe(true);
    expect(result.current.formattedDelta).toBe("+5 KG");
    expect(result.current.formattedProjectedBalance).toBe("15 KG");
    expect(result.current.formattedCurrentBalance).toBe("10 KG");
  });

  it("calcula projeção correta para Saída (OUT) com saldo remanescente suficiente", () => {
    const { result } = renderHook(() =>
      useStockSimulation({
        currentQuantity: 10,
        movementType: "OUT",
        quantityInput: "3,5",
        unit: "L",
      })
    );

    expect(result.current.projectedBalance).toBe(6500); // 10 - 3.5 = 6.5
    expect(result.current.projectedBalanceRaw).toBe(6.5);
    expect(result.current.delta).toBe(-3500);
    expect(result.current.deltaRaw).toBe(-3.5);
    expect(result.current.isNegative).toBe(false);
    expect(result.current.isValid).toBe(true);
    expect(result.current.formattedDelta).toBe("-3,5 L");
    expect(result.current.formattedProjectedBalance).toBe("6,5 L");
  });

  it("identifica saldo negativo (isNegative = true) em Saída (OUT) que excede o saldo físico", () => {
    const { result } = renderHook(() =>
      useStockSimulation({
        currentQuantity: 5,
        movementType: "OUT",
        quantityInput: "8",
        unit: "UN",
      })
    );

    expect(result.current.projectedBalance).toBe(-3000);
    expect(result.current.projectedBalanceRaw).toBe(-3);
    expect(result.current.delta).toBe(-8000);
    expect(result.current.isNegative).toBe(true);
    expect(result.current.isValid).toBe(true);
    expect(result.current.formattedDelta).toBe("-8 UN");
    expect(result.current.formattedProjectedBalance).toBe("-3 UN");
  });

  it("calcula projeção correta para Ajuste Físico (ADJUSTMENT) com delta positivo", () => {
    const { result } = renderHook(() =>
      useStockSimulation({
        currentQuantity: 10,
        movementType: "ADJUSTMENT",
        quantityInput: "14",
        unit: "M",
      })
    );

    expect(result.current.projectedBalance).toBe(14000);
    expect(result.current.projectedBalanceRaw).toBe(14);
    expect(result.current.delta).toBe(4000); // 14 - 10 = +4
    expect(result.current.deltaRaw).toBe(4);
    expect(result.current.isNegative).toBe(false);
    expect(result.current.isValid).toBe(true);
    expect(result.current.formattedDelta).toBe("+4 M");
    expect(result.current.formattedProjectedBalance).toBe("14 M");
  });

  it("calcula projeção correta para Ajuste Físico (ADJUSTMENT) com delta negativo", () => {
    const { result } = renderHook(() =>
      useStockSimulation({
        currentQuantity: 10,
        movementType: "ADJUSTMENT",
        quantityInput: "7,25",
        unit: "KG",
      })
    );

    expect(result.current.projectedBalance).toBe(7250);
    expect(result.current.projectedBalanceRaw).toBe(7.25);
    expect(result.current.delta).toBe(-2750); // 7.25 - 10 = -2.75
    expect(result.current.deltaRaw).toBe(-2.75);
    expect(result.current.isNegative).toBe(false); // Ajuste para 7.25 não é negativo
    expect(result.current.isValid).toBe(true);
    expect(result.current.formattedDelta).toBe("-2,75 KG");
    expect(result.current.formattedProjectedBalance).toBe("7,25 KG");
  });

  it("permite ajuste físico para zero (0)", () => {
    const { result } = renderHook(() =>
      useStockSimulation({
        currentQuantity: 5,
        movementType: "ADJUSTMENT",
        quantityInput: "0",
        unit: "UN",
      })
    );

    expect(result.current.projectedBalance).toBe(0);
    expect(result.current.delta).toBe(-5000);
    expect(result.current.isValid).toBe(true);
    expect(result.current.isNegative).toBe(false);
  });

  it("trata input vazio ou apenas espaços como inválido sem quebrar", () => {
    const { result } = renderHook(() =>
      useStockSimulation({
        currentQuantity: 10,
        movementType: "IN",
        quantityInput: "   ",
        unit: "UN",
      })
    );

    expect(result.current.isValid).toBe(false);
    expect(result.current.isNegative).toBe(false);
    expect(result.current.projectedBalance).toBe(10000);
    expect(result.current.delta).toBe(0);
  });

  it("trata texto inválido (NaN) graciosamente marcando isValid como false", () => {
    const { result } = renderHook(() =>
      useStockSimulation({
        currentQuantity: 10,
        movementType: "OUT",
        quantityInput: "abc",
      })
    );

    expect(result.current.isValid).toBe(false);
    expect(result.current.isNegative).toBe(false);
    expect(result.current.projectedBalance).toBe(10000);
    expect(result.current.delta).toBe(0);
  });

  it("suporta chamada com argumentos posicionais", () => {
    const { result } = renderHook(() =>
      useStockSimulation(20, "IN", 10)
    );

    expect(result.current.projectedBalance).toBe(30000);
    expect(result.current.delta).toBe(10000);
    expect(result.current.isValid).toBe(true);
  });
});
