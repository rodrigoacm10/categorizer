import { describe, it, expect } from "vitest";
import {
  toScaledInt,
  fromScaledInt,
  formatScaledQuantity,
  formatDeltaQuantity,
  SCALE_FACTOR,
} from "../scale";

describe("scale utils (10^3)", () => {
  it("SCALE_FACTOR deve ser 1000", () => {
    expect(SCALE_FACTOR).toBe(1000);
  });

  describe("toScaledInt", () => {
    it("converte string decimal com vírgula para inteiro escalado", () => {
      expect(toScaledInt("2,5")).toBe(2500);
      expect(toScaledInt("0,125")).toBe(125);
      expect(toScaledInt("10,000")).toBe(10000);
      expect(toScaledInt(" 12,5 ")).toBe(12500);
    });

    it("converte string decimal com ponto para inteiro escalado", () => {
      expect(toScaledInt("2.5")).toBe(2500);
      expect(toScaledInt("0.125")).toBe(125);
    });

    it("converte número float para inteiro escalado", () => {
      expect(toScaledInt(2.5)).toBe(2500);
      expect(toScaledInt(0.125)).toBe(125);
      expect(toScaledInt(10)).toBe(10000);
      expect(toScaledInt(-1.5)).toBe(-1500);
    });

    it("retorna 0 para valores nulos, indefinidos ou vazios", () => {
      expect(toScaledInt(null)).toBe(0);
      expect(toScaledInt(undefined)).toBe(0);
      expect(toScaledInt("")).toBe(0);
      expect(toScaledInt("   ")).toBe(0);
    });

    it("lança erro para entradas numéricas inválidas", () => {
      expect(() => toScaledInt("abc")).toThrow("Valor numérico inválido: abc");
      expect(() => toScaledInt("12.34.56")).toThrow();
      expect(() => toScaledInt(NaN)).toThrow();
    });
  });

  describe("fromScaledInt", () => {
    it("converte inteiro escalado de volta para decimal", () => {
      expect(fromScaledInt(2500)).toBe(2.5);
      expect(fromScaledInt(125)).toBe(0.125);
      expect(fromScaledInt(10000)).toBe(10);
      expect(fromScaledInt(-1500)).toBe(-1.5);
    });

    it("retorna 0 para valores nulos ou indefinidos", () => {
      expect(fromScaledInt(null)).toBe(0);
      expect(fromScaledInt(undefined)).toBe(0);
      expect(fromScaledInt(0)).toBe(0);
    });
  });

  describe("formatScaledQuantity", () => {
    it("formata quantidade escalada para padrão pt-BR", () => {
      expect(formatScaledQuantity(2500)).toBe("2,5");
      expect(formatScaledQuantity(125)).toBe("0,125");
      expect(formatScaledQuantity(10000)).toBe("10");
      expect(formatScaledQuantity(0)).toBe("0");
    });

    it("adiciona sufixo de unidade quando fornecido", () => {
      expect(formatScaledQuantity(2500, "KG")).toBe("2,5 KG");
      expect(formatScaledQuantity(1000, "UN")).toBe("1 UN");
      expect(formatScaledQuantity(125, "L")).toBe("0,125 L");
    });

    it("retorna '0' ou '0 <unidade>' para null ou undefined", () => {
      expect(formatScaledQuantity(null)).toBe("0");
      expect(formatScaledQuantity(undefined, "KG")).toBe("0 KG");
    });
  });

  describe("formatDeltaQuantity", () => {
    it("adiciona prefixo '+' explícito para valores positivos", () => {
      expect(formatDeltaQuantity(2500, "KG")).toBe("+2,5 KG");
      expect(formatDeltaQuantity(1000, "UN")).toBe("+1 UN");
      expect(formatDeltaQuantity(500)).toBe("+0,5");
    });

    it("formata valores negativos com '-' explícito", () => {
      expect(formatDeltaQuantity(-1000, "UN")).toBe("-1 UN");
      expect(formatDeltaQuantity(-2500, "KG")).toBe("-2,5 KG");
      expect(formatDeltaQuantity(-125, "L")).toBe("-0,125 L");
    });

    it("formata zero sem sinal '+' ou '-'", () => {
      expect(formatDeltaQuantity(0, "UN")).toBe("0 UN");
      expect(formatDeltaQuantity(0)).toBe("0");
      expect(formatDeltaQuantity(null, "KG")).toBe("0 KG");
    });
  });
});
