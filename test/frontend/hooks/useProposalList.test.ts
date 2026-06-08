import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useProposalList } from "@/hooks/useProposalList";
import { ProposalStatus } from "@/services/governanceService";

const { mockFetchProposals } = vi.hoisted(() => ({
  mockFetchProposals: vi.fn(),
}));

vi.mock("@/services/governanceService", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/services/governanceService")>();
  return { ...original, fetchProposals: mockFetchProposals };
});

const mockProvider = {} as never;

const mockProposal = {
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
};

describe("useProposalList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("estado inicial tem loading false, proposals vazio e error null sem provider", () => {
    const { result } = renderHook(() => useProposalList(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.proposals).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("carrega propostas quando provider está disponível", async () => {
    mockFetchProposals.mockResolvedValue([mockProposal]);

    const { result } = renderHook(() => useProposalList(mockProvider));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.proposals).toHaveLength(1);
    expect(result.current.proposals[0].proposalId).toBe(1n);
    expect(result.current.error).toBeNull();
  });

  it("define error quando fetchProposals lança exceção", async () => {
    mockFetchProposals.mockRejectedValue(new Error("Falha na rede"));

    const { result } = renderHook(() => useProposalList(mockProvider));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Falha na rede");
    expect(result.current.proposals).toEqual([]);
  });

  it("não chama fetchProposals quando provider é null", () => {
    renderHook(() => useProposalList(null));
    expect(mockFetchProposals).not.toHaveBeenCalled();
  });

  it("expõe refetch para recarregar propostas", async () => {
    mockFetchProposals.mockResolvedValue([mockProposal]);

    const { result } = renderHook(() => useProposalList(mockProvider));

    await waitFor(() => expect(result.current.loading).toBe(false));

    mockFetchProposals.mockResolvedValue([
      mockProposal,
      { ...mockProposal, proposalId: 2n },
    ]);

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.proposals).toHaveLength(2);
  });
});
