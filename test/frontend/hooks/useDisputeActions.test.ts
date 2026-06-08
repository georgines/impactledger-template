import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDisputeActions } from "@/hooks/useDisputeActions";

const {
  mockOpenDispute,
  mockAddDisputeEvidence,
  mockVoteOnDispute,
  mockFinalizeDispute,
  mockWait,
} = vi.hoisted(() => ({
  mockOpenDispute: vi.fn(),
  mockAddDisputeEvidence: vi.fn(),
  mockVoteOnDispute: vi.fn(),
  mockFinalizeDispute: vi.fn(),
  mockWait: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/services/contractService", () => ({
  getPurchaseManagerContract: vi.fn(() => ({
    openDispute: mockOpenDispute,
    addDisputeEvidence: mockAddDisputeEvidence,
    voteOnDispute: mockVoteOnDispute,
    finalizeDispute: mockFinalizeDispute,
  })),
}));

vi.mock("@/services/contractErrors", () => ({
  translateContractError: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Erro inesperado",
  ),
}));

const mockSigner = { _isSigner: true } as never;
const HASH = "0x" + "ab".repeat(32);

describe("useDisputeActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenDispute.mockResolvedValue({ wait: mockWait });
    mockAddDisputeEvidence.mockResolvedValue({ wait: mockWait });
    mockVoteOnDispute.mockResolvedValue({ wait: mockWait });
    mockFinalizeDispute.mockResolvedValue({ wait: mockWait });
  });

  it("estado inicial tem loading=false e error=null", () => {
    const { result } = renderHook(() => useDisputeActions(mockSigner));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("openDispute chama contrato com purchaseId correto", async () => {
    const { result } = renderHook(() => useDisputeActions(mockSigner));
    await act(async () => {
      await result.current.openDispute(11n);
    });
    expect(mockOpenDispute).toHaveBeenCalledWith(11n);
    expect(mockWait).toHaveBeenCalled();
  });

  it("addDisputeEvidence chama contrato com purchaseId e hash corretos", async () => {
    const { result } = renderHook(() => useDisputeActions(mockSigner));
    await act(async () => {
      await result.current.addDisputeEvidence(7n, HASH);
    });
    expect(mockAddDisputeEvidence).toHaveBeenCalledWith(7n, HASH);
  });

  it("voteOnDispute chama contrato com purchaseId e supportSupplier corretos", async () => {
    const { result } = renderHook(() => useDisputeActions(mockSigner));
    await act(async () => {
      await result.current.voteOnDispute(3n, true);
    });
    expect(mockVoteOnDispute).toHaveBeenCalledWith(3n, true);
  });

  it("voteOnDispute passa false para voto contra fornecedor", async () => {
    const { result } = renderHook(() => useDisputeActions(mockSigner));
    await act(async () => {
      await result.current.voteOnDispute(3n, false);
    });
    expect(mockVoteOnDispute).toHaveBeenCalledWith(3n, false);
  });

  it("finalizeDispute chama contrato com purchaseId correto", async () => {
    const { result } = renderHook(() => useDisputeActions(mockSigner));
    await act(async () => {
      await result.current.finalizeDispute(9n);
    });
    expect(mockFinalizeDispute).toHaveBeenCalledWith(9n);
  });

  it("define error quando openDispute lança exceção", async () => {
    mockOpenDispute.mockRejectedValueOnce(new Error("Disputa inválida"));
    const { result } = renderHook(() => useDisputeActions(mockSigner));
    await act(async () => {
      await result.current.openDispute(11n).catch(() => {});
    });
    expect(result.current.error).toBe("Disputa inválida");
    expect(result.current.loading).toBe(false);
  });

  it("lança erro quando signer é null", async () => {
    const { result } = renderHook(() => useDisputeActions(null));
    await expect(result.current.openDispute(1n)).rejects.toThrow(
      "Signer não disponível",
    );
  });
});
