import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOrderConfirmation } from "@/hooks/useOrderConfirmation";

const {
  mockConfirmDelivery,
  mockConfirmReceipt,
  mockSubmitImpactProof,
  mockConfirmReceiptAndSubmitProof,
  mockWait,
} = vi.hoisted(() => ({
  mockConfirmDelivery: vi.fn(),
  mockConfirmReceipt: vi.fn(),
  mockSubmitImpactProof: vi.fn(),
  mockConfirmReceiptAndSubmitProof: vi.fn(),
  mockWait: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/services/contractService", () => ({
  getPurchaseManagerContract: vi.fn(() => ({
    confirmDelivery: mockConfirmDelivery,
    confirmReceipt: mockConfirmReceipt,
    submitImpactProof: mockSubmitImpactProof,
    confirmReceiptAndSubmitProof: mockConfirmReceiptAndSubmitProof,
  })),
}));

vi.mock("@/services/contractErrors", () => ({
  translateContractError: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Erro inesperado",
  ),
}));

const mockSigner = { _isSigner: true } as never;
const HASH = "0x" + "cd".repeat(32);

describe("useOrderConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirmDelivery.mockResolvedValue({ wait: mockWait });
    mockConfirmReceipt.mockResolvedValue({ wait: mockWait });
    mockSubmitImpactProof.mockResolvedValue({ wait: mockWait });
    mockConfirmReceiptAndSubmitProof.mockResolvedValue({ wait: mockWait });
  });

  it("estado inicial tem loading=false e error=null", () => {
    const { result } = renderHook(() => useOrderConfirmation(mockSigner));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("confirmDelivery chama contrato com purchaseId correto", async () => {
    const { result } = renderHook(() => useOrderConfirmation(mockSigner));
    await act(async () => {
      await result.current.confirmDelivery(42n);
    });
    expect(mockConfirmDelivery).toHaveBeenCalledWith(42n);
    expect(mockWait).toHaveBeenCalled();
  });

  it("confirmReceipt chama contrato com purchaseId correto", async () => {
    const { result } = renderHook(() => useOrderConfirmation(mockSigner));
    await act(async () => {
      await result.current.confirmReceipt(7n);
    });
    expect(mockConfirmReceipt).toHaveBeenCalledWith(7n);
  });

  it("submitImpactProof chama contrato com purchaseId e hash corretos", async () => {
    const { result } = renderHook(() => useOrderConfirmation(mockSigner));
    await act(async () => {
      await result.current.submitImpactProof(9n, HASH);
    });
    expect(mockSubmitImpactProof).toHaveBeenCalledWith(9n, HASH);
  });

  it("confirmReceiptAndSubmitProof chama contrato com purchaseId e hash corretos", async () => {
    const { result } = renderHook(() => useOrderConfirmation(mockSigner));
    await act(async () => {
      await result.current.confirmReceiptAndSubmitProof(5n, HASH);
    });
    expect(mockConfirmReceiptAndSubmitProof).toHaveBeenCalledWith(5n, HASH);
  });

  it("define error quando confirmDelivery lança exceção", async () => {
    mockConfirmDelivery.mockRejectedValueOnce(new Error("Prazo expirado"));
    const { result } = renderHook(() => useOrderConfirmation(mockSigner));
    await act(async () => {
      await result.current.confirmDelivery(1n).catch(() => {});
    });
    expect(result.current.error).toBe("Prazo expirado");
  });

  it("lança erro quando signer é null", async () => {
    const { result } = renderHook(() => useOrderConfirmation(null));
    await expect(result.current.confirmDelivery(1n)).rejects.toThrow(
      "Signer não disponível",
    );
  });
});
