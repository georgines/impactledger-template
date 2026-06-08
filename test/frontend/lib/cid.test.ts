import { describe, it, expect } from "vitest";
import { cidToBytes32, bytes32ToCid } from "@/lib/cid";

describe("cid", () => {
  const testBytes32 = "0x" + "ab".repeat(32);

  it('bytes32ToCid produz CIDv1 começando com "b"', () => {
    const cid = bytes32ToCid(testBytes32);
    expect(cid.startsWith("b")).toBe(true);
  });

  it("bytes32ToCid não começa com Qm (não é CIDv0)", () => {
    const cid = bytes32ToCid(testBytes32);
    expect(cid.startsWith("Qm")).toBe(false);
  });

  it("cidToBytes32 e bytes32ToCid são funções inversas (round-trip)", () => {
    const cid = bytes32ToCid(testBytes32);
    expect(cidToBytes32(cid)).toBe(testBytes32);
  });

  it("cidToBytes32 normaliza prefixo 0x em lowercase", () => {
    const cid = bytes32ToCid(testBytes32);
    const result = cidToBytes32(cid);
    expect(result.startsWith("0x")).toBe(true);
    expect(result).toBe(result.toLowerCase());
  });

  it("cidToBytes32 aceita CIDv0 (Qm...)", () => {
    const cidv0 = "QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB";
    expect(() => cidToBytes32(cidv0)).not.toThrow();
    expect(cidToBytes32(cidv0)).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("cidToBytes32 aceita CIDv1 com prefixo multibase 'b'", () => {
    const cidv1 = bytes32ToCid(testBytes32);
    expect(() => cidToBytes32(cidv1)).not.toThrow();
    expect(cidToBytes32(cidv1)).toBe(testBytes32);
  });

  it("round-trip com CIDv1 real do Pinata", () => {
    const cid = "bafkreieszz2fztvsbycjcsehuqsf7spr7jvree3ig2kol64iyekfw7qkme";
    const bytes32 = cidToBytes32(cid);
    expect(bytes32ToCid(bytes32)).toBe(cid);
  });

  it("bytes32ToCid lança erro para hex com comprimento inválido", () => {
    expect(() => bytes32ToCid("0x1234")).toThrow("bytes32 inválido");
  });

  it("cidToBytes32 lança erro para CID com comprimento inválido", () => {
    expect(() => cidToBytes32("abc")).toThrow();
  });

  it("cidToBytes32 lança erro para CID com caractere inválido", () => {
    expect(() => cidToBytes32("0xnao_e_base58")).toThrow();
  });
});
