import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePurchaseManager } from "@/hooks/usePurchaseManager";

const {
  mockOpenPurchase,
  mockConfirmDelivery,
  mockConfirmReceipt,
  mockSubmitImpactProof,
  mockConfirmReceiptAndSubmitProof,
  mockOpenDispute,
  mockAddDisputeEvidence,
  mockVoteOnDispute,
  mockFinalizeDispute,
  mockGetPurchase,
  mockWait,
} = vi.hoisted(() => ({
  mockOpenPurchase: vi.fn(),
  mockConfirmDelivery: vi.fn(),
  mockConfirmReceipt: vi.fn(),
  mockSubmitImpactProof: vi.fn(),
  mockConfirmReceiptAndSubmitProof: vi.fn(),
  mockOpenDispute: vi.fn(),
  mockAddDisputeEvidence: vi.fn(),
  mockVoteOnDispute: vi.fn(),
  mockFinalizeDispute: vi.fn(),
  mockGetPurchase: vi.fn(),
  mockWait: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/services/contractService", () => ({
  getPurchaseManagerContract: vi.fn(() => ({
    openPurchase: mockOpenPurchase,
    confirmDelivery: mockConfirmDelivery,
    confirmReceipt: mockConfirmReceipt,
    submitImpactProof: mockSubmitImpactProof,
    confirmReceiptAndSubmitProof: mockConfirmReceiptAndSubmitProof,
    openDispute: mockOpenDispute,
    addDisputeEvidence: mockAddDisputeEvidence,
    voteOnDispute: mockVoteOnDispute,
    finalizeDispute: mockFinalizeDispute,
    getPurchase: mockGetPurchase,
  })),
}));

const mockSigner = { _isSigner: true } as never;

describe("usePurchaseManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenPurchase.mockResolvedValue({ wait: mockWait });
    mockConfirmDelivery.mockResolvedValue({ wait: mockWait });
    mockConfirmReceipt.mockResolvedValue({ wait: mockWait });
    mockSubmitImpactProof.mockResolvedValue({ wait: mockWait });
    mockOpenDispute.mockResolvedValue({ wait: mockWait });
    mockConfirmReceiptAndSubmitProof.mockResolvedValue({ wait: mockWait });
    mockAddDisputeEvidence.mockResolvedValue({ wait: mockWait });
    mockVoteOnDispute.mockResolvedValue({ wait: mockWait });
    mockFinalizeDispute.mockResolvedValue({ wait: mockWait });
  });

  it("estado inicial tem loading false e error null", () => {
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("createOrder chama openPurchase passando descriptionHash diretamente sem keccak", async () => {
    const IPFS_HASH = "0x" + "ab".repeat(32);
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.createOrder(
        "0xfornecedor",
        500n,
        1735689600n,
        IPFS_HASH,
      );
    });

    expect(mockOpenPurchase).toHaveBeenCalledWith(
      "0xfornecedor",
      500n,
      1735689600n,
      IPFS_HASH,
    );
  });

  it("createOrder aguarda confirmação da transação", async () => {
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.createOrder(
        "0xfornecedor",
        100n,
        1735689600n,
        "Produto Y",
      );
    });

    expect(mockWait).toHaveBeenCalled();
  });

  it("confirmDelivery chama PurchaseManager.confirmDelivery com o purchaseId correto", async () => {
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.confirmDelivery(42n);
    });

    expect(mockConfirmDelivery).toHaveBeenCalledWith(42n);
  });

  it("define error quando openPurchase lança exceção", async () => {
    mockOpenPurchase.mockRejectedValueOnce(
      new Error("Fornecedor não aprovado"),
    );

    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current
        .createOrder("0xinvalido", 100n, 1735689600n, "Produto Z")
        .catch(() => {});
    });

    expect(result.current.error).toBe(
      "Ocorreu um erro inesperado. Tente novamente.",
    );
  });

  it("define error quando confirmDelivery lança exceção", async () => {
    mockConfirmDelivery.mockRejectedValueOnce(new Error("Prazo expirado"));

    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.confirmDelivery(1n).catch(() => {});
    });

    expect(result.current.error).toBe(
      "Ocorreu um erro inesperado. Tente novamente.",
    );
  });

  it("confirmReceipt chama PurchaseManager.confirmReceipt com o purchaseId correto", async () => {
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.confirmReceipt(7n);
    });

    expect(mockConfirmReceipt).toHaveBeenCalledWith(7n);
  });

  it("confirmReceipt aguarda confirmacao da transacao", async () => {
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.confirmReceipt(7n);
    });

    expect(mockWait).toHaveBeenCalled();
  });

  it("confirmReceipt define error quando contrato lanca excecao", async () => {
    mockConfirmReceipt.mockRejectedValueOnce(new Error("Status invalido"));

    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.confirmReceipt(7n).catch(() => {});
    });

    expect(result.current.error).toBe(
      "Ocorreu um erro inesperado. Tente novamente.",
    );
  });

  it("submitImpactProof chama PurchaseManager.submitImpactProof com purchaseId e hash corretos", async () => {
    const hash =
      "0xdeadbeef00000000000000000000000000000000000000000000000000000000";
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.submitImpactProof(9n, hash);
    });

    expect(mockSubmitImpactProof).toHaveBeenCalledWith(9n, hash);
  });

  it("submitImpactProof aguarda confirmacao da transacao", async () => {
    const hash =
      "0xdeadbeef00000000000000000000000000000000000000000000000000000000";
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.submitImpactProof(9n, hash);
    });

    expect(mockWait).toHaveBeenCalled();
  });

  it("submitImpactProof define error quando hash e bytes32 zero", async () => {
    mockSubmitImpactProof.mockRejectedValueOnce(
      new Error("PurchaseManager__EmptyProofHash"),
    );

    const emptyHash =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.submitImpactProof(9n, emptyHash).catch(() => {});
    });

    expect(result.current.error).toBe(
      "O comprovante de impacto não pode ser vazio.",
    );
  });

  it("openDispute chama PurchaseManager.openDispute com purchaseId correto", async () => {
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.openDispute(11n);
    });

    expect(mockOpenDispute).toHaveBeenCalledWith(11n);
  });

  it("openDispute aguarda confirmacao da transacao", async () => {
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.openDispute(11n);
    });

    expect(mockWait).toHaveBeenCalled();
  });

  it("openDispute define error quando contrato lanca excecao", async () => {
    mockOpenDispute.mockRejectedValueOnce(
      new Error("PurchaseManager__DeadlineNotExpired"),
    );

    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.openDispute(11n).catch(() => {});
    });

    expect(result.current.error).toBe("O prazo ainda não expirou.");
  });

  it("confirmReceiptAndSubmitProof chama contrato com purchaseId e ipfsHash corretos", async () => {
    const HASH = "0x" + "cd".repeat(32);
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.confirmReceiptAndSubmitProof(5n, HASH);
    });

    expect(mockConfirmReceiptAndSubmitProof).toHaveBeenCalledWith(5n, HASH);
    expect(mockWait).toHaveBeenCalled();
  });

  it("confirmReceiptAndSubmitProof define error quando contrato lanca excecao", async () => {
    mockConfirmReceiptAndSubmitProof.mockRejectedValueOnce(
      new Error("PurchaseManager__InvalidStatus"),
    );

    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current
        .confirmReceiptAndSubmitProof(5n, "0xhash")
        .catch(() => {});
    });

    expect(result.current.error).toBe("Status inválido para esta operação.");
  });

  it("addDisputeEvidence chama contrato com purchaseId e ipfsHash corretos", async () => {
    const HASH = "0x" + "ab".repeat(32);
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.addDisputeEvidence(7n, HASH);
    });

    expect(mockAddDisputeEvidence).toHaveBeenCalledWith(7n, HASH);
    expect(mockWait).toHaveBeenCalled();
  });

  it("addDisputeEvidence define error quando contrato lanca excecao", async () => {
    mockAddDisputeEvidence.mockRejectedValueOnce(
      new Error("PurchaseManager__DisputeWindowClosed"),
    );

    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.addDisputeEvidence(7n, "0xhash").catch(() => {});
    });

    expect(result.current.error).toBe("O período de disputa está encerrado.");
  });

  it("voteOnDispute chama contrato com purchaseId e supportSupplier corretos", async () => {
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.voteOnDispute(3n, true);
    });

    expect(mockVoteOnDispute).toHaveBeenCalledWith(3n, true);
    expect(mockWait).toHaveBeenCalled();
  });

  it("voteOnDispute passa supportSupplier false para voto contra fornecedor", async () => {
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.voteOnDispute(3n, false);
    });

    expect(mockVoteOnDispute).toHaveBeenCalledWith(3n, false);
  });

  it("voteOnDispute define error quando contrato lanca excecao", async () => {
    mockVoteOnDispute.mockRejectedValueOnce(
      new Error("PurchaseManager__AlreadyVoted"),
    );

    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.voteOnDispute(3n, true).catch(() => {});
    });

    expect(result.current.error).toBe("Você já votou nesta disputa.");
  });

  it("finalizeDispute chama contrato com purchaseId correto", async () => {
    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.finalizeDispute(9n);
    });

    expect(mockFinalizeDispute).toHaveBeenCalledWith(9n);
    expect(mockWait).toHaveBeenCalled();
  });

  it("finalizeDispute define error quando contrato lanca excecao", async () => {
    mockFinalizeDispute.mockRejectedValueOnce(
      new Error("PurchaseManager__InvalidStatus"),
    );

    const { result } = renderHook(() => usePurchaseManager(mockSigner));

    await act(async () => {
      await result.current.finalizeDispute(9n).catch(() => {});
    });

    expect(result.current.error).toBe("Status inválido para esta operação.");
  });
});
