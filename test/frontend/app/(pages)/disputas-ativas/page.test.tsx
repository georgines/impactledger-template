import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@test/utils/render";
import DisputasAtivasPage from "@/app/(pages)/disputas-ativas/page";
import { PurchaseStatus } from "@/services/purchaseService";
import type { Purchase } from "@/services/purchaseService";

// ----- hoisted mocks -----
const {
  mockUseWallet,
  mockUseDisputeOrders,
  mockVoteOnDispute,
  mockFinalizeDispute,
  mockUseProposalCountdown,
  mockUseDisputeEvidences,
  mockUseSuppliers,
  mockUseInstitutions,
  mockUseMyDonations,
} = vi.hoisted(() => ({
  mockUseWallet: vi.fn(),
  mockUseDisputeOrders: vi.fn(),
  mockVoteOnDispute: vi.fn(),
  mockFinalizeDispute: vi.fn(),
  mockUseProposalCountdown: vi.fn(),
  mockUseDisputeEvidences: vi.fn(),
  mockUseSuppliers: vi.fn(),
  mockUseInstitutions: vi.fn(),
  mockUseMyDonations: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({ useWallet: mockUseWallet }));
vi.mock("@/hooks/useDisputeOrders", () => ({
  useDisputeOrders: mockUseDisputeOrders,
}));
vi.mock("@/hooks/useProposalCountdown", () => ({
  useProposalCountdown: mockUseProposalCountdown,
}));
vi.mock("@/hooks/useDisputeEvidences", () => ({
  useDisputeEvidences: mockUseDisputeEvidences,
}));
vi.mock("@/hooks/useSuppliers", () => ({
  useSuppliers: mockUseSuppliers,
}));
vi.mock("@/hooks/useInstitutions", () => ({
  useInstitutions: mockUseInstitutions,
}));
vi.mock("@/hooks/useMyDonations", () => ({
  useMyDonations: mockUseMyDonations,
}));
vi.mock("@/hooks/usePurchaseManager", () => ({
  usePurchaseManager: vi.fn(() => ({
    voteOnDispute: mockVoteOnDispute,
    finalizeDispute: mockFinalizeDispute,
    loading: false,
    error: null,
  })),
}));

// ----- fixtures -----
const DONOR = "0xDONR000000000000000000000000000000000000";
const INSTITUTION = "0xINST000000000000000000000000000000000000";
const SUPPLIER = "0xAAAA000000000000000000000000000000000001";
const EMPTY_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function makeDisputedOrder(purchaseId: bigint): Purchase {
  return {
    purchaseId,
    institution: INSTITUTION,
    supplier: SUPPLIER,
    amount: 500_000_000_000_000_000n,
    deliveryDeadline: 1n,
    descriptionHash: "0xhash",
    status: PurchaseStatus.Disputed,
    impactProofHash: EMPTY_HASH,
    confirmDeadline: 0n,
    disputeDeadline: 9_999_999_999n,
    supplierVoteWeight: 0n,
    institutionVoteWeight: 0n,
  };
}

const DISPUTE_A = makeDisputedOrder(1n);
const DISPUTE_B = makeDisputedOrder(2n);

// ----- helpers -----
function setupWallet(connected = true) {
  mockUseWallet.mockReturnValue({
    provider: connected ? { _isProvider: true } : null,
    signer: connected ? { _isSigner: true } : null,
    address: connected ? DONOR : null,
    role: connected ? "doador" : null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
}

function setupOrders(orders: Purchase[] = []) {
  mockUseDisputeOrders.mockReturnValue({
    orders,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
}

function renderPage() {
  return render(<DisputasAtivasPage />);
}

// ----- testes -----
describe("DisputasAtivasPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVoteOnDispute.mockResolvedValue(undefined);
    mockFinalizeDispute.mockResolvedValue(undefined);
    mockUseProposalCountdown.mockImplementation((deadline: bigint) => {
      if (deadline <= BigInt(1))
        return { secondsLeft: 0, expired: true, display: "Expirada" };
      return { secondsLeft: 999, expired: false, display: "16min 39s" };
    });
    mockUseDisputeEvidences.mockReturnValue({
      evidences: [],
      loading: false,
      refetch: vi.fn(),
    });
    mockUseMyDonations.mockReturnValue({
      donations: [
        { institution: "0xINST", amount: 1n, txHash: "0x1", blockNumber: 1 },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseSuppliers.mockReturnValue({
      suppliers: [
        {
          address: SUPPLIER,
          name: "Distribuidora Alpha",
          serviceType: "Alimentos",
          approved: true,
        },
      ],
      loading: false,
      error: null,
    });
    mockUseInstitutions.mockReturnValue({
      institutions: [
        {
          address: INSTITUTION,
          name: "Abrigo AnimaTodos",
          areaOfWork: "Animais",
          status: 1,
        },
      ],
      loading: false,
      error: null,
    });
    setupWallet();
    setupOrders();
  });

  it("renderiza sem erros", () => {
    expect(() => renderPage()).not.toThrow();
  });

  // ----------------------------------------------------------------
  describe("controle de acesso", () => {
    it("sem carteira exibe aviso de conexao", () => {
      setupWallet(false);
      renderPage();
      expect(screen.getByText(/conecte sua carteira/i)).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("estado vazio", () => {
    it("exibe mensagem quando nao ha disputas ativas", () => {
      setupOrders([]);
      renderPage();
      expect(screen.getByTestId("empty-disputas-ativas")).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("TC-DA01 e TC-DA02 — exibicao de disputas", () => {
    beforeEach(() => setupOrders([DISPUTE_A]));

    it("exibe card de disputa ativa", () => {
      renderPage();
      expect(
        screen.getByTestId(`dispute-card-${DISPUTE_A.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe botao Apoiar Fornecedor", () => {
      renderPage();
      expect(
        screen.getByTestId(`btn-votar-fornecedor-${DISPUTE_A.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe botao Apoiar Instituicao", () => {
      renderPage();
      expect(
        screen.getByTestId(`btn-votar-instituicao-${DISPUTE_A.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe multiplas disputas", () => {
      setupOrders([DISPUTE_A, DISPUTE_B]);
      renderPage();
      expect(
        screen.getByTestId(`dispute-card-${DISPUTE_A.purchaseId}`),
      ).toBeDefined();
      expect(
        screen.getByTestId(`dispute-card-${DISPUTE_B.purchaseId}`),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("votacao — TC-DA03 e TC-DA04", () => {
    beforeEach(() => setupOrders([DISPUTE_A]));

    it("TC-DA03 — clicar Apoiar Fornecedor chama voteOnDispute com true", async () => {
      renderPage();
      fireEvent.click(
        screen.getByTestId(`btn-votar-fornecedor-${DISPUTE_A.purchaseId}`),
      );
      await waitFor(() => {
        expect(mockVoteOnDispute).toHaveBeenCalledWith(
          DISPUTE_A.purchaseId,
          true,
        );
      });
    });

    it("TC-DA04 — clicar Apoiar Instituicao chama voteOnDispute com false", async () => {
      renderPage();
      fireEvent.click(
        screen.getByTestId(`btn-votar-instituicao-${DISPUTE_A.purchaseId}`),
      );
      await waitFor(() => {
        expect(mockVoteOnDispute).toHaveBeenCalledWith(
          DISPUTE_A.purchaseId,
          false,
        );
      });
    });

    it("exibe confirmacao de voto apos votar", async () => {
      renderPage();
      fireEvent.click(
        screen.getByTestId(`btn-votar-fornecedor-${DISPUTE_A.purchaseId}`),
      );
      await waitFor(() => {
        expect(screen.getByTestId("vote-success")).toBeDefined();
      });
    });
  });

  // ----------------------------------------------------------------
  describe("progresso de quórum — TC-D08", () => {
    it("exibe pesos de voto do fornecedor e da instituicao", () => {
      const disputeComVotos = {
        ...DISPUTE_A,
        supplierVoteWeight: 300n,
        institutionVoteWeight: 100n,
      };
      setupOrders([disputeComVotos]);
      renderPage();
      expect(
        screen.getByTestId(`quorum-supplier-${DISPUTE_A.purchaseId}`),
      ).toBeDefined();
      expect(
        screen.getByTestId(`quorum-institution-${DISPUTE_A.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe zeros quando nenhum voto registrado", () => {
      setupOrders([DISPUTE_A]);
      renderPage();
      expect(
        screen.getByTestId(`quorum-supplier-${DISPUTE_A.purchaseId}`),
      ).toBeDefined();
      expect(
        screen.getByTestId(`quorum-institution-${DISPUTE_A.purchaseId}`),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("countdown do prazo de disputa", () => {
    it("exibe countdown do prazo de disputa no card", () => {
      setupOrders([DISPUTE_A]);
      renderPage();
      expect(
        screen.getByTestId(`dispute-countdown-${DISPUTE_A.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe texto Expirada quando prazo de disputa zerou", () => {
      const disputeExpirada = { ...DISPUTE_A, disputeDeadline: 1n };
      setupOrders([disputeExpirada]);
      renderPage();
      const countdown = screen.getByTestId(
        `dispute-countdown-${DISPUTE_A.purchaseId}`,
      );
      expect(countdown.textContent).toContain("Expirada");
    });
  });

  // ----------------------------------------------------------------
  describe("linha do tempo — nomes e evidencias", () => {
    beforeEach(() => setupOrders([DISPUTE_A]));

    it("exibe linha do tempo no card de disputa", () => {
      renderPage();
      expect(
        screen.getByTestId(`dispute-timeline-${DISPUTE_A.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe nome da instituicao na linha do tempo", () => {
      renderPage();
      expect(screen.getByText(/Abrigo AnimaTodos/)).toBeDefined();
    });

    it("exibe nome do fornecedor na linha do tempo", () => {
      renderPage();
      expect(screen.getByText(/Distribuidora Alpha/)).toBeDefined();
    });

    it("exibe hash de evidencia quando existe evidencia na disputa", () => {
      mockUseDisputeEvidences.mockReturnValue({
        evidences: [
          {
            ipfsHash:
              "0xdeadbeef00000000000000000000000000000000000000000000000000000001",
            submittedBy: INSTITUTION,
          },
        ],
        loading: false,
        refetch: vi.fn(),
      });
      renderPage();
      expect(
        screen.getByTestId(`timeline-evidence-${DISPUTE_A.purchaseId}-0`),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("finalizeDispute — TC-DA03 e TC-DA04", () => {
    it("nao exibe botao Executar Veredicto quando disputeDeadline nao expirou", () => {
      setupOrders([DISPUTE_A]);
      renderPage();
      expect(
        screen.queryByTestId(`btn-finalizar-disputa-${DISPUTE_A.purchaseId}`),
      ).toBeNull();
    });

    it("exibe botao Executar Veredicto quando disputeDeadline expirou", () => {
      const disputeExpirada = { ...DISPUTE_A, disputeDeadline: 1n };
      setupOrders([disputeExpirada]);
      renderPage();
      expect(
        screen.getByTestId(`btn-finalizar-disputa-${DISPUTE_A.purchaseId}`),
      ).toBeDefined();
    });

    it("chama finalizeDispute com purchaseId correto ao clicar", async () => {
      const disputeExpirada = { ...DISPUTE_A, disputeDeadline: 1n };
      setupOrders([disputeExpirada]);
      renderPage();
      fireEvent.click(
        screen.getByTestId(`btn-finalizar-disputa-${DISPUTE_A.purchaseId}`),
      );
      await waitFor(() => {
        expect(mockFinalizeDispute).toHaveBeenCalledWith(DISPUTE_A.purchaseId);
      });
    });
  });
});
