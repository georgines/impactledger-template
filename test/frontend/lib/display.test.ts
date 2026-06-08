import { describe, it, expect } from "vitest";
import { resolveAreaColor, getInitials } from "@/lib/display";

describe("resolveAreaColor", () => {
  it("retorna teal para area contendo 'saúde'", () => {
    expect(resolveAreaColor("Saúde Comunitária")).toBe("teal");
  });

  it("retorna blue para area contendo 'educação'", () => {
    expect(resolveAreaColor("Educação Infantil")).toBe("blue");
  });

  it("retorna violet para area contendo 'assistência'", () => {
    expect(resolveAreaColor("Assistência Social")).toBe("violet");
  });

  it("retorna green para area contendo 'ambiente'", () => {
    expect(resolveAreaColor("Meio Ambiente")).toBe("green");
  });

  it("retorna cyan para area contendo 'social'", () => {
    expect(resolveAreaColor("Trabalho Social")).toBe("cyan");
  });

  it("retorna indigo para area desconhecida", () => {
    expect(resolveAreaColor("Tecnologia")).toBe("indigo");
  });

  it("matching case-insensitive", () => {
    expect(resolveAreaColor("SAÚDE")).toBe("teal");
  });
});

describe("getInitials", () => {
  it("retorna iniciais das duas primeiras palavras", () => {
    expect(getInitials("Casa da Esperança")).toBe("CD");
  });

  it("retorna inicial unica para nome de uma palavra", () => {
    expect(getInitials("Alpha")).toBe("A");
  });

  it("retorna em maiusculo", () => {
    expect(getInitials("distribuidora beta")).toBe("DB");
  });

  it("retorna string vazia para nome vazio", () => {
    expect(getInitials("")).toBe("");
  });
});
