import { describe, it, expect } from "vitest";
import { parseLimit, validateUploadFile } from "@/lib/uploadValidation";

describe("parseLimit", () => {
  it("retorna undefined quando valor é null", () => {
    expect(parseLimit(null)).toBeUndefined();
  });

  it("retorna undefined para string não numérica", () => {
    expect(parseLimit("abc")).toBeUndefined();
  });

  it("retorna undefined para zero", () => {
    expect(parseLimit("0")).toBeUndefined();
  });

  it("retorna undefined para número negativo", () => {
    expect(parseLimit("-5")).toBeUndefined();
  });

  it("retorna o valor quando dentro do limite", () => {
    expect(parseLimit("10")).toBe(10);
  });

  it("limita ao máximo de 100", () => {
    expect(parseLimit("999999")).toBe(100);
  });

  it("retorna exatamente 100 no limite", () => {
    expect(parseLimit("100")).toBe(100);
  });

  it("retorna 1 para valor mínimo válido", () => {
    expect(parseLimit("1")).toBe(1);
  });
});

const MB = 1024 * 1024;

function makeBlob(sizeBytes: number, type: string): Blob {
  return new Blob([new Uint8Array(sizeBytes)], { type });
}

describe("validateUploadFile", () => {
  it("aceita JSON dentro do limite de tamanho", () => {
    expect(validateUploadFile(makeBlob(1 * MB, "application/json"))).toBeNull();
  });

  it("aceita imagem JPEG", () => {
    expect(validateUploadFile(makeBlob(1 * MB, "image/jpeg"))).toBeNull();
  });

  it("aceita imagem PNG", () => {
    expect(validateUploadFile(makeBlob(1 * MB, "image/png"))).toBeNull();
  });

  it("aceita imagem GIF", () => {
    expect(validateUploadFile(makeBlob(1 * MB, "image/gif"))).toBeNull();
  });

  it("aceita imagem WebP", () => {
    expect(validateUploadFile(makeBlob(1 * MB, "image/webp"))).toBeNull();
  });

  it("rejeita arquivo acima de 10 MB", () => {
    const erro = validateUploadFile(makeBlob(11 * MB, "application/json"));
    expect(erro).toMatch(/grande/i);
  });

  it("rejeita tipo não permitido", () => {
    const erro = validateUploadFile(makeBlob(1 * MB, "application/pdf"));
    expect(erro).toMatch(/não permitido/i);
  });

  it("rejeita executável", () => {
    const erro = validateUploadFile(
      makeBlob(1 * MB, "application/octet-stream"),
    );
    expect(erro).toMatch(/não permitido/i);
  });

  it("arquivo exatamente no limite de 10 MB é aceito", () => {
    expect(validateUploadFile(makeBlob(10 * MB, "image/png"))).toBeNull();
  });
});
