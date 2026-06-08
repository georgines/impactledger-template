import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGovernance } from "@/hooks/useGovernance";

const { mockPropose, mockVote, mockGetProposal, mockFinalize, mockWait } =
  vi.hoisted(() => ({
    mockPropose: vi.fn(),
    mockVote: vi.fn(),
    mockGetProposal: vi.fn(),
    mockFinalize: vi.fn(),
    mockWait: vi.fn().mockResolvedValue({}),
  }));

vi.mock("@/services/contractService", () => ({
  getGovernanceDAOContract: vi.fn(() => ({
    propose: mockPropose,
    vote: mockVote,
    getProposal: mockGetProposal,
    finalize: mockFinalize,
  })),
}));

const mockSigner = { _isSigner: true } as never;

describe("useGovernance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPropose.mockResolvedValue({ wait: mockWait });
    mockVote.mockResolvedValue({ wait: mockWait });
    mockFinalize.mockResolvedValue({ wait: mockWait });
    mockWait.mockResolvedValue({ logs: [], toJSON: () => ({}) });
  });

  it("estado inicial tem loading false e error null", () => {
    const { result } = renderHook(() => useGovernance(mockSigner));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("propose chama GovernanceDAO.propose com os argumentos corretos", async () => {
    const proposalInput = {
      kind: 0,
      target: "0xtarget",
      name: "Proposta Teste",
      metadata: "ipfs://hash",
      purchaseId: 0n,
      disputeVerdict: false,
    };

    const { result } = renderHook(() => useGovernance(mockSigner));

    await act(async () => {
      await result.current.propose(proposalInput);
    });

    expect(mockPropose).toHaveBeenCalledWith(
      proposalInput.kind,
      proposalInput.target,
      proposalInput.name,
      proposalInput.metadata,
    );
  });

  it("vote chama GovernanceDAO.vote com proposalId e support", async () => {
    const { result } = renderHook(() => useGovernance(mockSigner));

    await act(async () => {
      await result.current.vote(1n, true);
    });

    expect(mockVote).toHaveBeenCalledWith(1n, true);
  });

  it("vote chama GovernanceDAO.vote com support=false", async () => {
    const { result } = renderHook(() => useGovernance(mockSigner));

    await act(async () => {
      await result.current.vote(2n, false);
    });

    expect(mockVote).toHaveBeenCalledWith(2n, false);
  });

  it("define error traduzido quando propose reverte com custom error", async () => {
    mockPropose.mockRejectedValueOnce(
      new Error("execution reverted: GovernanceDAO__OnlyOperator()"),
    );

    const { result } = renderHook(() => useGovernance(mockSigner));

    await act(async () => {
      await result.current.propose({} as never).catch(() => {});
    });

    expect(result.current.error).toBe(
      "Apenas o operador pode executar esta ação.",
    );
  });

  it("define error genérico quando propose lança exceção desconhecida", async () => {
    mockPropose.mockRejectedValueOnce(new Error("Network timeout"));

    const { result } = renderHook(() => useGovernance(mockSigner));

    await act(async () => {
      await result.current.propose({} as never).catch(() => {});
    });

    expect(result.current.error).toBe(
      "Ocorreu um erro inesperado. Tente novamente.",
    );
  });

  // --- finalize ---

  it("hook expõe a função finalize", () => {
    const { result } = renderHook(() => useGovernance(mockSigner));
    expect(typeof result.current.finalize).toBe("function");
  });

  it("finalize chama GovernanceDAO.finalize com proposalId, name e metadata", async () => {
    const { result } = renderHook(() => useGovernance(mockSigner));

    await act(async () => {
      await result.current.finalize(5n, "Instituição Alpha", "Área: saúde");
    });

    expect(mockFinalize).toHaveBeenCalledWith(
      5n,
      "Instituição Alpha",
      "Área: saúde",
    );
    expect(mockWait).toHaveBeenCalledTimes(1);
  });

  it("finalize seta loading=true durante execução e false após conclusão", async () => {
    let resolveWait!: () => void;
    mockFinalize.mockResolvedValue({
      wait: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveWait = resolve;
          }),
      ),
    });

    const { result } = renderHook(() => useGovernance(mockSigner));

    let finalizePromise: Promise<void>;
    act(() => {
      finalizePromise = result.current.finalize(1n, "nome", "meta");
    });

    // loading deve ser true enquanto a tx não termina
    expect(result.current.loading).toBe(true);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      resolveWait();
      await finalizePromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it("finalize define error quando o contrato reverte", async () => {
    mockFinalize.mockRejectedValueOnce(new Error("ProposalNotFinalizable()"));

    const { result } = renderHook(() => useGovernance(mockSigner));

    await act(async () => {
      await result.current.finalize(3n, "nome", "meta").catch(() => {});
    });

    expect(result.current.error).toBe(
      "Ocorreu um erro inesperado. Tente novamente.",
    );
  });

  // --- tradução de custom errors ---

  it("finalize traduz GovernanceDAO__NotFinalizable para mensagem legível", async () => {
    mockFinalize.mockRejectedValueOnce(
      new Error("execution reverted: GovernanceDAO__NotFinalizable()"),
    );

    const { result } = renderHook(() => useGovernance(mockSigner));

    await act(async () => {
      await result.current.finalize(3n, "nome", "meta").catch(() => {});
    });

    expect(result.current.error).toBe(
      "A proposta ainda não pode ser finalizada. Aguarde o prazo encerrar.",
    );
  });

  it("finalize traduz GovernanceDAO__NotActive para mensagem legível", async () => {
    mockFinalize.mockRejectedValueOnce(
      new Error("execution reverted: GovernanceDAO__NotActive()"),
    );

    const { result } = renderHook(() => useGovernance(mockSigner));

    await act(async () => {
      await result.current.finalize(3n, "nome", "meta").catch(() => {});
    });

    expect(result.current.error).toBe("Esta proposta não está mais ativa.");
  });

  it("finalize traduz GovernanceDAO__InvalidNameMetadata para mensagem legível", async () => {
    mockFinalize.mockRejectedValueOnce(
      new Error("execution reverted: GovernanceDAO__InvalidNameMetadata()"),
    );

    const { result } = renderHook(() => useGovernance(mockSigner));

    await act(async () => {
      await result.current.finalize(3n, "nome", "meta").catch(() => {});
    });

    expect(result.current.error).toBe(
      "Dados da proposta inválidos. Recarregue a página e tente novamente.",
    );
  });

  it("finalize exibe mensagem genérica para custom error desconhecido", async () => {
    mockFinalize.mockRejectedValueOnce(
      new Error("execution reverted: GovernanceDAO__SomeOtherError()"),
    );

    const { result } = renderHook(() => useGovernance(mockSigner));

    await act(async () => {
      await result.current.finalize(3n, "nome", "meta").catch(() => {});
    });

    expect(result.current.error).toBe(
      "Ocorreu um erro inesperado. Tente novamente.",
    );
  });

  it("finalize lança erro quando signer é null", async () => {
    const { result } = renderHook(() => useGovernance(null));

    await expect(
      act(async () => {
        await result.current.finalize(1n, "nome", "meta");
      }),
    ).rejects.toThrow();
  });
});
