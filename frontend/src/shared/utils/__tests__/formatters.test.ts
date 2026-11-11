import { describe, it, expect } from "vitest";
import {
  formatQuantity,
  formatDate,
  formatDateOnly,
  formatScaledQuantity,
  formatDeltaQuantity,
} from "../formatters";

describe("formatters utils", () => {
  describe("formatQuantity", () => {
    it("formata valor decimal numérico", () => {
      expect(formatQuantity(2.5, "KG")).toBe("2,5 KG");
      expect(formatQuantity(0.125, "L")).toBe("0,125 L");
      expect(formatQuantity(100)).toBe("100");
    });

    it("formata valor decimal a partir de string", () => {
      expect(formatQuantity("2,5", "KG")).toBe("2,5 KG");
      expect(formatQuantity("2.5", "UN")).toBe("2,5 UN");
    });

    it("retorna '0' para null, undefined ou inválido", () => {
      expect(formatQuantity(null)).toBe("0");
      expect(formatQuantity(undefined)).toBe("0");
      expect(formatQuantity("invalido")).toBe("0");
    });
  });

  describe("formatDate e formatDateOnly", () => {
    it("formata data e hora para padrão pt-BR", () => {
      const dateStr = "2026-11-11T13:45:30.000Z";
      const result = formatDate(dateStr);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it("formata apenas data para padrão pt-BR", () => {
      const dateStr = "2026-11-11T13:45:30.000Z";
      const result = formatDateOnly(dateStr);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it("retorna '-' para datas nulas ou inválidas", () => {
      expect(formatDate(null)).toBe("-");
      expect(formatDate(undefined)).toBe("-");
      expect(formatDate("invalida")).toBe("-");
      expect(formatDateOnly(null)).toBe("-");
    });
  });

  describe("re-exports from scale", () => {
    it("re-exporta formatScaledQuantity e formatDeltaQuantity corretamente", () => {
      expect(formatScaledQuantity(2500, "KG")).toBe("2,5 KG");
      expect(formatDeltaQuantity(-1000, "UN")).toBe("-1 UN");
    });
  });
});
