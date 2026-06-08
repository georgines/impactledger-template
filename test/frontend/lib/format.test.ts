import { describe, it, expect } from "vitest";
import { truncateAddress, formatDate } from "@/lib/format";

describe("truncateAddress", () => {
  it("retorna os primeiros 6 e últimos 4 caracteres separados por ...", () => {
    expect(truncateAddress("0x1234567890abcdef1234")).toBe("0x1234...1234");
  });

  it("mantém o formato para endereços ethereum padrão", () => {
    const addr = "0xABCDEF1234567890ABCDEF1234567890ABCDEF12";
    expect(truncateAddress(addr)).toBe("0xABCD...EF12");
  });
});

describe("formatDate", () => {
  it("formata timestamp unix para data em pt-BR no formato dd/mm/aaaa", () => {
    const timestamp = 1748563200; // 2026-05-30 UTC
    const result = formatDate(timestamp);
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("retorna — para timestamp zero", () => {
    expect(formatDate(0)).toBe("—");
  });
});
