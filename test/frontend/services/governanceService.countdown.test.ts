import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchSingleProposal,
  ProposalStatus,
} from "@/services/governanceService";

// ============================================================================
// Mocks — espelham o padrão já adotado em governanceService.test.ts
// ============================================================================

const { mockGetProposal } = vi.hoisted(() => ({
  mockGetProposal: vi.fn(),
}));

vi.mock("@/services/contractService", () => ({
  getGovernanceDAOContract: vi.fn(() => ({
    filters: { ProposalCreated: vi.fn().mockReturnValue({}) },
    queryFilter: vi.fn().mockResolvedValue([]),
    getProposal: mockGetProposal,
  })),
}));

const VALID_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const mockContractData = {
  id: 7n,
  kind: 2,
  target: VALID_ADDRESS,
  snapshotBlock: 50n,
  deadline: 9999999n,
  quorum: 100n,
  yesWeight: 30n,
  noWeight: 0n,
  status: 0, // Active no contrato
  nameMetadataHash: "0x" + "00".repeat(32),
};

// ============================================================================
// fetchSingleProposal — caminho feliz
// ============================================================================

describe("fetchSingleProposal", () => {
  const mockProvider = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Caminho feliz ---

  it("chama getProposal com o proposalId correto", async () => {
    mockGetProposal.mockResolvedValue(mockContractData);

    await fetchSingleProposal(7n, mockProvider, { name: "", metadata: "" });

    expect(mockGetProposal).toHaveBeenCalledOnce();
    expect(mockGetProposal).toHaveBeenCalledWith(7n);
  });

  it("mapeia campos do contrato para o objeto Proposal", async () => {
    mockGetProposal.mockResolvedValue(mockContractData);

    const proposal = await fetchSingleProposal(7n, mockProvider, {
      name: "",
      metadata: "",
    });

    expect(proposal.proposalId).toBe(7n);
    expect(proposal.kind).toBe(2);
    expect(proposal.target).toBe(VALID_ADDRESS);
    expect(proposal.snapshotBlock).toBe(50n);
    expect(proposal.deadline).toBe(9999999n);
    expect(proposal.quorum).toBe(100n);
    expect(proposal.yesWeight).toBe(30n);
    expect(proposal.noWeight).toBe(0n);
    expect(proposal.status).toBe(ProposalStatus.Active);
  });

  it("preserva name e metadata do objeto original passado", async () => {
    mockGetProposal.mockResolvedValue(mockContractData);

    const proposal = await fetchSingleProposal(7n, mockProvider, {
      name: "ONG Solar",
      metadata: "educação",
    });

    expect(proposal.name).toBe("ONG Solar");
    expect(proposal.metadata).toBe("educação");
  });

  it("preserva name e metadata mesmo quando strings vazias", async () => {
    mockGetProposal.mockResolvedValue(mockContractData);

    const proposal = await fetchSingleProposal(7n, mockProvider, {
      name: "",
      metadata: "",
    });

    expect(proposal.name).toBe("");
    expect(proposal.metadata).toBe("");
  });

  it("atualiza status retornado pelo contrato", async () => {
    mockGetProposal.mockResolvedValue({
      ...mockContractData,
      status: 1, // Executed no contrato
    });

    const proposal = await fetchSingleProposal(7n, mockProvider, {
      name: "X",
      metadata: "Y",
    });

    expect(proposal.status).toBe(ProposalStatus.Executed);
  });

  it("atualiza yesWeight e noWeight retornados pelo contrato", async () => {
    mockGetProposal.mockResolvedValue({
      ...mockContractData,
      yesWeight: 70n,
      noWeight: 29n,
    });

    const proposal = await fetchSingleProposal(7n, mockProvider, {
      name: "",
      metadata: "",
    });

    expect(proposal.yesWeight).toBe(70n);
    expect(proposal.noWeight).toBe(29n);
  });

  // --- Caminho triste ---

  it("propaga erro quando getProposal rejeita", async () => {
    mockGetProposal.mockRejectedValue(new Error("Contrato indisponível"));

    await expect(
      fetchSingleProposal(7n, mockProvider, { name: "", metadata: "" }),
    ).rejects.toThrow("Contrato indisponível");
  });

  it("não chama queryFilter (sem leitura de eventos)", async () => {
    const mockQueryFilter = vi.fn();
    const { getGovernanceDAOContract } =
      await import("@/services/contractService");
    vi.mocked(getGovernanceDAOContract).mockReturnValue({
      filters: { ProposalCreated: vi.fn().mockReturnValue({}) },
      queryFilter: mockQueryFilter,
      getProposal: mockGetProposal,
    } as never);

    mockGetProposal.mockResolvedValue(mockContractData);

    await fetchSingleProposal(7n, mockProvider, { name: "", metadata: "" });

    expect(mockQueryFilter).not.toHaveBeenCalled();
  });
});
