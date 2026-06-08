import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOrderCreation } from "@/hooks/useOrderCreation";

const { mockOpenPurchase, mockWait } = vi.hoisted(() => ({
  mockOpenPurchase: vi.fn(),
  mockWait: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/services/contractService", () => ({
  getPurchaseManagerContract: vi.fn(() => ({
    openPurchase: mockOpenPurchase,
  })),
}));

vi.mock("@/services/contractErrors", () => ({
  translateContractError: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Erro inesperado",
  ),
}));

const mockSigner = { _isSigner: true } as never;
const SUPPLIER = "0xAAAA000000000000000000000000000000000001";
const HASH = "0x" + "ab".repeat(32);

describe("useOrderCreation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenPurchase.mockResolvedValue({ wait: mockWait });
  });

  it("estado inicial tem loading=false e error=null", () => {
    const { result } = renderHook(() => useOrderCreation(mockSigner));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("createOrder chama openPurchase com argumentos corretos", async () => {
    const { result } = renderHook(() => useOrderCreation(mockSigner));
    await act(async () => {
      await result.current.createOrder(SUPPLIER, 500n, 1735689600n, HASH);
    });
    expect(mockOpenPurchase).toHaveBeenCalledWith(
      SUPPLIER,
      500n,
      1735689600n,
      HASH,
    );
  });

  it("createOrder aguarda confirmação da transação", async () => {
    const { result } = renderHook(() => useOrderCreation(mockSigner));
    await act(async () => {
      await result.current.createOrder(SUPPLIER, 100n, 1735689600n, HASH);
    });
    expect(mockWait).toHaveBeenCalled();
  });

  it("define error quando openPurchase lança exceção", async () => {
    mockOpenPurchase.mockRejectedValueOnce(new Error("Fornecedor inválido"));
    const { result } = renderHook(() => useOrderCreation(mockSigner));
    await act(async () => {
      await result.current
        .createOrder(SUPPLIER, 100n, 1735689600n, HASH)
        .catch(() => {});
    });
    expect(result.current.error).toBe("Fornecedor inválido");
    expect(result.current.loading).toBe(false);
  });

  it("lança erro quando signer é null", async () => {
    const { result } = renderHook(() => useOrderCreation(null));
    await expect(
      result.current.createOrder(SUPPLIER, 100n, 1735689600n, HASH),
    ).rejects.toThrow("Signer não disponível");
  });
});
