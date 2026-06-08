import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@test/utils/render";
import EmVotacaoPage from "@/app/(pages)/em-votacao/page";
import { ProposalStatus } from "@/services/governanceService";
import type { Proposal } from "@/services/governanceService";

// ----- hoisted mocks -----
const { mockUseWallet, mockUseProposalList, mockFinalize, mockWait } =
  vi.hoisted(() => ({
    mockUseWallet: vi.fn(),
    mockUseProposalList: vi.fn(),
    mockFinalize: vi.fn(),
    mockWait: vi.fn().mockResolvedValue({}),
  }));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: mockUseWallet,
}));

vi.mock("@/hooks/useProposalList", () => ({
  useProposalList: mockUseProposalList,
}));

vi.mock("@/hooks/useGovernance", async (importActual) => {
  const actual = await importActual<typeof import("@/hooks/useGovernance")>();
  return {
    ...actual,
    useGovernance: vi.fn(() => ({
      finalize: mockFinalize,
      propose: vi.fn(),
      vote: vi.fn(),
      loading: false,
      error: null,
    })),
  };
});

// useVoteStatus retorna hasVoted=false por padrão (não votou)
vi.mock("@/hooks/useVoteStatus", () => ({
  useVoteStatus: vi.fn(() => ({ hasVoted: false, loading: false })),
}));
vi.mock("@/hooks/useMyDonations", () => ({
  useMyDonations: vi.fn(() => ({ donations: [], loading: false, error: null })),
}));

// ----- helpers -----
const NOW = Math.floor(Date.now() / 1000);
const PAST = BigInt(NOW - 3600); // 1h atrás — expirada
const FUTURE = BigInt(NOW + 86400); // 1d no futuro — ativa

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    proposalId: 1n,
    kind: 0,
    target: "0x1234567890123456789012345678901234567890",
    snapshotBlock: 100n,
    deadline: FUTURE,
    status: ProposalStatus.Active,
    yesWeight: 0n,
    noWeight: 0n,
    quorum: 100n,
    nameMetadataHash: "0x00",
    name: "Instituição Teste",
    metadata: "Área: saúde",
    ...overrides,
  };
}

function setupWallet(connected = true, role: string | null = null) {
  mockUseWallet.mockReturnValue({
    provider: connected ? { _isProvider: true } : null,
    signer: connected ? { _isSigner: true } : null,
    address: connected ? "0xabc" : null,
    role,
  });
}

function setupProposals(proposals: Proposal[]) {
  mockUseProposalList.mockReturnValue({
    proposals,
    loading: false,
    error: null,
    refetch: vi.fn(),
    refreshSingleProposal: vi.fn(),
  });
}

// ----- testes -----

describe("EmVotacaoPage — botão Finalizar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFinalize.mockResolvedValue({ wait: mockWait });
    mockWait.mockResolvedValue({});
  });

  describe("TC-GOV-FIN-01 — proposta com deadline expirada exibe botão Finalizar", () => {
    it("exibe botão Finalizar quando deadline passou e status ainda é Active", () => {
      setupWallet();
      setupProposals([makeProposal({ deadline: PAST })]);

      render(<EmVotacaoPage />);

      expect(
        screen.getByRole("button", { name: /finalizar/i }),
      ).toBeInTheDocument();
    });
  });

  describe("TC-GOV-FIN-02 — proposta com prazo expirado e yesWeight > noWeight exibe botão Finalizar", () => {
    it("exibe botão Finalizar quando prazo expirou, yesWeight > noWeight e quórum atingido", () => {
      setupWallet();
      setupProposals([
        makeProposal({
          yesWeight: 80n,
          noWeight: 20n,
          quorum: 100n,
          deadline: PAST,
        }),
      ]);

      render(<EmVotacaoPage />);

      expect(
        screen.getByRole("button", { name: /finalizar/i }),
      ).toBeInTheDocument();
    });

    it("não exibe botão Finalizar quando prazo não expirou mesmo com quórum atingido", () => {
      setupWallet();
      setupProposals([
        makeProposal({
          yesWeight: 100n,
          noWeight: 0n,
          quorum: 100n,
          deadline: FUTURE,
        }),
      ]);

      render(<EmVotacaoPage />);

      expect(
        screen.queryByRole("button", { name: /finalizar/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("TC-GOV-FIN-03 — proposta ativa sem quórum nem deadline expirada não exibe botão Finalizar", () => {
    it("não exibe botão Finalizar em proposta ativa normal", () => {
      setupWallet();
      setupProposals([
        makeProposal({ totalWeight: 10n, quorum: 100n, deadline: FUTURE }),
      ]);

      render(<EmVotacaoPage />);

      expect(
        screen.queryByRole("button", { name: /finalizar/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("TC-GOV-FIN-04 — proposta já finalizada (status !== Active) não exibe botão Finalizar", () => {
    it("não exibe botão Finalizar quando status é Approved", () => {
      setupWallet();
      setupProposals([
        makeProposal({ status: ProposalStatus.Approved, deadline: PAST }),
      ]);

      render(<EmVotacaoPage />);

      expect(
        screen.queryByRole("button", { name: /finalizar/i }),
      ).not.toBeInTheDocument();
    });

    it("não exibe botão Finalizar quando status é Rejected", () => {
      setupWallet();
      setupProposals([
        makeProposal({ status: ProposalStatus.Rejected, deadline: PAST }),
      ]);

      render(<EmVotacaoPage />);

      expect(
        screen.queryByRole("button", { name: /finalizar/i }),
      ).not.toBeInTheDocument();
    });

    it("não exibe botão Finalizar quando status é Executed", () => {
      setupWallet();
      setupProposals([
        makeProposal({ status: ProposalStatus.Executed, deadline: PAST }),
      ]);

      render(<EmVotacaoPage />);

      expect(
        screen.queryByRole("button", { name: /finalizar/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("TC-GOV-FIN-05 — clicar em Finalizar chama finalize com proposalId, name e metadata corretos", () => {
    it("ao confirmar, chama useGovernance.finalize com os dados da proposta", async () => {
      setupWallet();
      const proposal = makeProposal({ proposalId: 7n, deadline: PAST });
      setupProposals([proposal]);

      render(<EmVotacaoPage />);

      const btn = screen.getByRole("button", { name: /finalizar/i });
      fireEvent.click(btn);

      await waitFor(() => {
        expect(mockFinalize).toHaveBeenCalledWith(
          7n,
          proposal.name,
          proposal.metadata,
        );
      });
    });
  });

  describe("TC-GOV-FIN-06 — após finalize bem-sucedido o status real do contrato é recarregado", () => {
    it("chama refetch após finalize concluir com sucesso", async () => {
      const mockRefetch = vi.fn();
      setupWallet();
      mockUseProposalList.mockReturnValue({
        proposals: [makeProposal({ deadline: PAST })],
        loading: false,
        error: null,
        refetch: mockRefetch,
        refreshSingleProposal: vi.fn(),
      });

      render(<EmVotacaoPage />);

      fireEvent.click(screen.getByRole("button", { name: /finalizar/i }));

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("TC-GOV-FIN-07 — erro no finalize é exibido ao usuário", () => {
    it("exibe mensagem de erro quando finalize rejeita", async () => {
      mockFinalize.mockRejectedValueOnce(new Error("ProposalNotFinalizable()"));
      setupWallet();
      setupProposals([makeProposal({ deadline: PAST })]);

      render(<EmVotacaoPage />);

      fireEvent.click(screen.getByRole("button", { name: /finalizar/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/ocorreu um erro inesperado/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("TC-GOV-FIN-07B — erro de finalização é exibido em português legível", () => {
    it("traduz GovernanceDAO__NotFinalizable para mensagem em português", async () => {
      mockFinalize.mockRejectedValueOnce(
        new Error("execution reverted: GovernanceDAO__NotFinalizable()"),
      );
      setupWallet();
      setupProposals([makeProposal({ deadline: PAST })]);

      render(<EmVotacaoPage />);

      fireEvent.click(screen.getByRole("button", { name: /finalizar/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/aguarde o prazo encerrar/i),
        ).toBeInTheDocument();
      });
    });

    it("traduz GovernanceDAO__NotActive para mensagem em português", async () => {
      mockFinalize.mockRejectedValueOnce(
        new Error("execution reverted: GovernanceDAO__NotActive()"),
      );
      setupWallet();
      setupProposals([makeProposal({ deadline: PAST })]);

      render(<EmVotacaoPage />);

      fireEvent.click(screen.getByRole("button", { name: /finalizar/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/esta proposta não está mais ativa/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("TC-GOV-FIN-09 — erro de finalização é limpo quando proposta muda", () => {
    it("limpa finalizeError quando proposalId da proposta muda", async () => {
      mockFinalize.mockRejectedValueOnce(
        new Error("execution reverted: GovernanceDAO__NotFinalizable()"),
      );
      setupWallet();
      const proposal = makeProposal({ proposalId: 1n, deadline: PAST });
      mockUseProposalList.mockReturnValue({
        proposals: [proposal],
        loading: false,
        error: null,
        refetch: vi.fn(),
        refreshSingleProposal: vi.fn(),
      });

      const { rerender } = render(<EmVotacaoPage />);

      fireEvent.click(screen.getByRole("button", { name: /finalizar/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/aguarde o prazo encerrar/i),
        ).toBeInTheDocument();
      });

      // Simula refetch retornando proposta com proposalId diferente (nova proposta)
      const updatedProposal = makeProposal({
        proposalId: 2n,
        deadline: PAST,
        status: ProposalStatus.Active,
      });
      mockUseProposalList.mockReturnValue({
        proposals: [updatedProposal],
        loading: false,
        error: null,
        refetch: vi.fn(),
        refreshSingleProposal: vi.fn(),
      });

      rerender(<EmVotacaoPage />);

      await waitFor(() => {
        expect(
          screen.queryByText(/aguarde o prazo encerrar/i),
        ).not.toBeInTheDocument();
      });
    });

    it("limpa finalizeError quando status da proposta muda", async () => {
      mockFinalize.mockRejectedValueOnce(
        new Error("execution reverted: GovernanceDAO__NotFinalizable()"),
      );
      setupWallet();
      const proposal = makeProposal({
        proposalId: 1n,
        deadline: PAST,
        status: ProposalStatus.Active,
      });
      mockUseProposalList.mockReturnValue({
        proposals: [proposal],
        loading: false,
        error: null,
        refetch: vi.fn(),
        refreshSingleProposal: vi.fn(),
      });

      const { rerender } = render(<EmVotacaoPage />);

      fireEvent.click(screen.getByRole("button", { name: /finalizar/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/aguarde o prazo encerrar/i),
        ).toBeInTheDocument();
      });

      // Simula refetch retornando mesma proposta com status atualizado
      const finalizedProposal = makeProposal({
        proposalId: 1n,
        deadline: PAST,
        status: ProposalStatus.Approved,
      });
      mockUseProposalList.mockReturnValue({
        proposals: [finalizedProposal],
        loading: false,
        error: null,
        refetch: vi.fn(),
        refreshSingleProposal: vi.fn(),
      });

      rerender(<EmVotacaoPage />);

      // Proposta com status Approved não exibe botão Finalizar nem erro
      await waitFor(() => {
        expect(
          screen.queryByText(/aguarde o prazo encerrar/i),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("TC-GOV-FIN-08 — sem carteira conectada não exibe botão Finalizar", () => {
    it("exibe aviso de conectar carteira em vez de propostas", () => {
      setupWallet(false);
      mockUseProposalList.mockReturnValue({
        proposals: [],
        loading: false,
        error: null,
        refetch: vi.fn(),
        refreshSingleProposal: vi.fn(),
      });

      render(<EmVotacaoPage />);

      expect(screen.getByText(/conecte sua carteira/i)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /finalizar/i }),
      ).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// EmVotacaoPage — filtro de ProposalCard por status
// A página "Em Votação" exibe apenas propostas com status Active.
// Propostas finalizadas (Approved, Rejected, Executed) pertencem ao histórico.
// ============================================================================

describe("EmVotacaoPage — filtro de ProposalCard por status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupWallet();
  });

  describe("TC-GOV-FILTER-01 — proposta Active é exibida", () => {
    it("deve exibir card de proposta com status Active", () => {
      const proposal = makeProposal({
        proposalId: 1n,
        status: ProposalStatus.Active,
        name: "ONG Ativa",
      });
      setupProposals([proposal]);

      render(<EmVotacaoPage />);

      expect(screen.getByText("Proposta #1")).toBeInTheDocument();
    });
  });

  describe("TC-GOV-FILTER-02 — proposta Approved é ocultada", () => {
    it("deve ocultar card de proposta com status Approved", () => {
      const proposal = makeProposal({
        proposalId: 2n,
        status: ProposalStatus.Approved,
        name: "ONG Aprovada",
        deadline: PAST,
      });
      setupProposals([proposal]);

      render(<EmVotacaoPage />);

      expect(screen.queryByText("Proposta #2")).not.toBeInTheDocument();
    });
  });

  describe("TC-GOV-FILTER-03 — proposta Rejected é ocultada", () => {
    it("deve ocultar card de proposta com status Rejected", () => {
      const proposal = makeProposal({
        proposalId: 3n,
        status: ProposalStatus.Rejected,
        name: "ONG Rejeitada",
        deadline: PAST,
      });
      setupProposals([proposal]);

      render(<EmVotacaoPage />);

      expect(screen.queryByText("Proposta #3")).not.toBeInTheDocument();
    });
  });

  describe("TC-GOV-FILTER-04 — proposta Executed é ocultada", () => {
    it("deve ocultar card de proposta com status Executed", () => {
      const proposal = makeProposal({
        proposalId: 4n,
        status: ProposalStatus.Executed,
        name: "ONG Executada",
        deadline: PAST,
      });
      setupProposals([proposal]);

      render(<EmVotacaoPage />);

      expect(screen.queryByText("Proposta #4")).not.toBeInTheDocument();
    });
  });

  describe("TC-GOV-FILTER-05 — lista mista mostra apenas Active", () => {
    it("deve exibir apenas propostas Active quando há propostas de múltiplos status", () => {
      const proposals = [
        makeProposal({ proposalId: 10n, status: ProposalStatus.Active }),
        makeProposal({
          proposalId: 11n,
          status: ProposalStatus.Approved,
          deadline: PAST,
        }),
        makeProposal({
          proposalId: 12n,
          status: ProposalStatus.Rejected,
          deadline: PAST,
        }),
        makeProposal({
          proposalId: 13n,
          status: ProposalStatus.Executed,
          deadline: PAST,
        }),
      ];
      setupProposals(proposals);

      render(<EmVotacaoPage />);

      expect(screen.getByText("Proposta #10")).toBeInTheDocument();
      expect(screen.queryByText("Proposta #11")).not.toBeInTheDocument();
      expect(screen.queryByText("Proposta #12")).not.toBeInTheDocument();
      expect(screen.queryByText("Proposta #13")).not.toBeInTheDocument();
    });
  });

  describe("TC-GOV-FILTER-06 — todas finalizadas mostra mensagem vazia", () => {
    it("deve exibir mensagem de lista vazia quando todas as propostas estão finalizadas", () => {
      const proposals = [
        makeProposal({
          proposalId: 20n,
          status: ProposalStatus.Approved,
          deadline: PAST,
        }),
        makeProposal({
          proposalId: 21n,
          status: ProposalStatus.Rejected,
          deadline: PAST,
        }),
      ];
      setupProposals(proposals);

      render(<EmVotacaoPage />);

      expect(
        screen.getByText(/não há propostas em votação/i),
      ).toBeInTheDocument();
    });
  });
});
