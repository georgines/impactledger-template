import { describe, it, expect, afterEach } from "vitest";
import { parseServerEnv } from "@/env";

describe("parseServerEnv", () => {
  afterEach(() => {
    delete process.env.CHAVE_PINATA;
    delete process.env.URL_GATEWAY_PINATA;
  });

  it("retorna env válido quando CHAVE_PINATA está configurado", () => {
    process.env.CHAVE_PINATA = "meu-jwt-de-teste";

    const env = parseServerEnv();

    expect(env.CHAVE_PINATA).toBe("meu-jwt-de-teste");
  });

  it("usa gateway padrão quando URL_GATEWAY_PINATA não está definida", () => {
    process.env.CHAVE_PINATA = "meu-jwt-de-teste";

    const env = parseServerEnv();

    expect(env.URL_GATEWAY_PINATA).toBe("https://gateway.pinata.cloud/ipfs");
  });

  it("retorna gateway configurado quando URL_GATEWAY_PINATA está definida", () => {
    process.env.CHAVE_PINATA = "meu-jwt-de-teste";
    process.env.URL_GATEWAY_PINATA = "https://meu-gateway.cloud/ipfs";

    const env = parseServerEnv();

    expect(env.URL_GATEWAY_PINATA).toBe("https://meu-gateway.cloud/ipfs");
  });

  it("lança erro quando CHAVE_PINATA não está definida", () => {
    expect(() => parseServerEnv()).toThrow("IPFS não configurado no servidor");
  });

  it("lança erro quando CHAVE_PINATA é string vazia", () => {
    process.env.CHAVE_PINATA = "";

    expect(() => parseServerEnv()).toThrow("IPFS não configurado no servidor");
  });

  it("lança erro quando URL_GATEWAY_PINATA não é URL válida", () => {
    process.env.CHAVE_PINATA = "meu-jwt-de-teste";
    process.env.URL_GATEWAY_PINATA = "nao-e-uma-url";

    expect(() => parseServerEnv()).toThrow("IPFS não configurado no servidor");
  });
});
