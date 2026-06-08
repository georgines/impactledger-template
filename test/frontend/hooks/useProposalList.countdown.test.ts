import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useProposalList } from "@/hooks/useProposalList";
import { ProposalStatus } from "@/services/governanceService";

// ============================================================================
// Mocks — espelham o padrão de useProposalList.test.ts
// ============================================================================

const { mockFetchProposals, mockFetchSingleProposal } = vi.hoisted(() => ({
  mockFetchProposals: vi.fn(),
  mockFetchSingleProposal: vi.fn(),
}));

vi.mock("@/services/governanceService", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/services/governanceService")>();
  return {
    ...original,
    fetchProposals: mockFetchProposals,
    fetchSingleProposal: mockFetchSingleProposal,
  };
});

const mockProvider = {} as never;

function makeProposal(overrides: Record<string, unknown> = {}) {
  return {
    proposalId: 1n,
    kind: 3,
    target: "0xABC",
    snapshotBlock: 100n,
    deadline: 9999999n,
    status: ProposalStatus.Active,
    yesWeight: 50n,
    noWeight: 0n,
    quorum: 100n,
    nameMetadataHash: "0x" + "00".repeat(32),
    name: "ONG Exemplo",
    metadata: "Investigação concluída",
    ...overrides,
  };
}

// ============================================================================
// refreshSingleProposal — parte do retorno de useProposalList
// ============================================================================

describe("useProposalList — refreshSingleProposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Caminho feliz ---

  it("expõe refreshSingleProposal no retorno do hook", async () => {
    mockFetchProposals.mockResolvedValue([]);

    const { result } = renderHook(() => useProposalList(mockProvider));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(typeof result.current.refreshSingleProposal).toBe("function");
  });

  it("atualiza apenas a proposta com o proposalId correspondente no array", async () => {
    const p1 = makeProposal({ proposalId: 1n, yesWeight: 50n });
    const p2 = makeProposal({ proposalId: 2n, yesWeight: 10n });
    mockFetchProposals.mockResolvedValue([p1, p2]);

    const { result } = renderHook(() => useProposalList(mockProvider));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // p1 ganha mais votos on-chain
    const updatedP1 = makeProposal({ proposalId: 1n, yesWeight: 80n });
    mockFetchSingleProposal.mockResolvedValue(updatedP1);

    await act(async () => {
      await result.current.refreshSingleProposal(1n);
    });

    expect(result.current.proposals).toHaveLength(2);
    expect(result.current.proposals[0].yesWeight).toBe(80n);
    expect(result.current.proposals[1].yesWeight).toBe(10n); // p2 inalterado
  });

  it("não altera outras propostas quando refreshSingleProposal é chamado", async () => {
    const p1 = makeProposal({ proposalId: 1n });
    const p2 = makeProposal({ proposalId: 2n, name: "Outro" });
    const p3 = makeProposal({ proposalId: 3n, name: "Terceiro" });
    mockFetchProposals.mockResolvedValue([p1, p2, p3]);

    const { result } = renderHook(() => useProposalList(mockProvider));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updatedP2 = makeProposal({
      proposalId: 2n,
      name: "Outro",
      status: ProposalStatus.Executed,
    });
    mockFetchSingleProposal.mockResolvedValue(updatedP2);

    await act(async () => {
      await result.current.refreshSingleProposal(2n);
    });

    expect(result.current.proposals[0].proposalId).toBe(1n);
    expect(result.current.proposals[1].status).toBe(ProposalStatus.Executed);
    expect(result.current.proposals[2].name).toBe("Terceiro");
  });

  it("chama fetchSingleProposal com o proposalId e provider corretos", async () => {
    const p1 = makeProposal({ proposalId: 5n });
    mockFetchProposals.mockResolvedValue([p1]);
    mockFetchSingleProposal.mockResolvedValue(p1);

    const { result } = renderHook(() => useProposalList(mockProvider));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refreshSingleProposal(5n);
    });

    expect(mockFetchSingleProposal).toHaveBeenCalledOnce();
    expect(mockFetchSingleProposal).toHaveBeenCalledWith(
      5n,
      mockProvider,
      expect.objectContaining({ name: expect.any(String) }),
    );
  });

  it("preserva name e metadata originais ao passar para fetchSingleProposal", async () => {
    const p1 = makeProposal({
      proposalId: 3n,
      name: "ONG Solar",
      metadata: "educação",
    });
    mockFetchProposals.mockResolvedValue([p1]);
    mockFetchSingleProposal.mockResolvedValue(p1);

    const { result } = renderHook(() => useProposalList(mockProvider));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refreshSingleProposal(3n);
    });

    expect(mockFetchSingleProposal).toHaveBeenCalledWith(
      3n,
      mockProvider,
      expect.objectContaining({ name: "ONG Solar", metadata: "educação" }),
    );
  });

  it("não chama fetchProposals completo (sem refetch global)", async () => {
    const p1 = makeProposal({ proposalId: 1n });
    mockFetchProposals.mockResolvedValue([p1]);
    mockFetchSingleProposal.mockResolvedValue(p1);

    const { result } = renderHook(() => useProposalList(mockProvider));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callCountBefore = mockFetchProposals.mock.calls.length;

    await act(async () => {
      await result.current.refreshSingleProposal(1n);
    });

    expect(mockFetchProposals.mock.calls.length).toBe(callCountBefore);
  });

  // --- Caminho triste ---

  it("não modifica proposals quando fetchSingleProposal lança erro", async () => {
    const p1 = makeProposal({ proposalId: 1n, yesWeight: 50n });
    mockFetchProposals.mockResolvedValue([p1]);
    mockFetchSingleProposal.mockRejectedValue(new Error("Contrato offline"));

    const { result } = renderHook(() => useProposalList(mockProvider));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      try {
        await result.current.refreshSingleProposal(1n);
      } catch {
        // erro esperado
      }
    });

    // Proposal original permanece inalterada
    expect(result.current.proposals[0].yesWeight).toBe(50n);
  });

  it("não falha silenciosamente: relança o erro de fetchSingleProposal", async () => {
    const p1 = makeProposal({ proposalId: 1n });
    mockFetchProposals.mockResolvedValue([p1]);
    mockFetchSingleProposal.mockRejectedValue(new Error("Rede indisponível"));

    const { result } = renderHook(() => useProposalList(mockProvider));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.refreshSingleProposal(1n);
      }),
    ).rejects.toThrow("Rede indisponível");
  });

  it("não faz nada quando proposalId não existe no array", async () => {
    const p1 = makeProposal({ proposalId: 1n });
    mockFetchProposals.mockResolvedValue([p1]);
    mockFetchSingleProposal.mockResolvedValue(
      makeProposal({ proposalId: 99n }),
    );

    const { result } = renderHook(() => useProposalList(mockProvider));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refreshSingleProposal(99n);
    });

    // Array não se expande com proposta desconhecida
    expect(result.current.proposals).toHaveLength(1);
    expect(result.current.proposals[0].proposalId).toBe(1n);
  });
});
