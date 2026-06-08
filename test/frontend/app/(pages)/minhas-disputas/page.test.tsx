import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@test/utils/render";
import MinhasDisputasPage from "@/app/(pages)/minhas-disputas/page";
import { PurchaseStatus } from "@/services/purchaseService";
import type { Purchase } from "@/services/purchaseService";

// ----- hoisted mocks -----
const {
  mockUseWallet,
  mockUseDisputeOrders,
  mockAddDisputeEvidence,
  mockUploadAsBytes32,
  mockUseProposalCountdown,
  mockUseDisputeEvidences,
  mockUseSuppliers,
  mockUseInstitutions,
} = vi.hoisted(() => ({
  mockUseWallet: vi.fn(),
  mockUseDisputeOrders: vi.fn(),
  mockAddDisputeEvidence: vi.fn(),
  mockUploadAsBytes32: vi.fn(),
  mockUseProposalCountdown: vi.fn(),
  mockUseDisputeEvidences: vi.fn(),
  mockUseSuppliers: vi.fn(),
  mockUseInstitutions: vi.fn(),
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
vi.mock("@/hooks/usePurchaseManager", () => ({
  usePurchaseManager: vi.fn(() => ({
    addDisputeEvidence: mockAddDisputeEvidence,
    loading: false,
    error: null,
  })),
}));
vi.mock("@/hooks/useIpfsUpload", () => ({
  useIpfsUpload: vi.fn(() => ({
    uploadAsBytes32: mockUploadAsBytes32,
    loading: false,
    error: null,
  })),
}));

// ----- fixtures -----
const INSTITUTION = "0xINST000000000000000000000000000000000000";
const SUPPLIER = "0xAAAA000000000000000000000000000000000001";
const OTHER_ADDR = "0xOTHR000000000000000000000000000000000002";
const EVIDENCE_HASH =
  "0xdeadbeef00000000000000000000000000000000000000000000000000000000";
const EMPTY_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function makeDisputedOrder(
  purchaseId: bigint,
  institution: string,
  supplier: string,
): Purchase {
  return {
    purchaseId,
    institution,
    supplier,
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

const DISPUTE_AS_INSTITUTION = makeDisputedOrder(1n, INSTITUTION, SUPPLIER);
const DISPUTE_AS_SUPPLIER = makeDisputedOrder(2n, OTHER_ADDR, INSTITUTION);
const UNRELATED_DISPUTE = makeDisputedOrder(3n, OTHER_ADDR, SUPPLIER);

// ----- helpers -----
function setupWallet(address = INSTITUTION) {
  mockUseWallet.mockReturnValue({
    provider: { _isProvider: true },
    signer: { _isSigner: true },
    address,
    role: "instituicao",
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
}

function setupDisconnected() {
  mockUseWallet.mockReturnValue({
    provider: null,
    signer: null,
    address: null,
    role: null,
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
  return render(<MinhasDisputasPage />);
}

// ----- testes -----
describe("MinhasDisputasPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddDisputeEvidence.mockResolvedValue(undefined);
    mockUploadAsBytes32.mockResolvedValue(EVIDENCE_HASH);
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
    mockUseSuppliers.mockReturnValue({
      suppliers: [
        {
          address: INSTITUTION,
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
          address: OTHER_ADDR,
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
      setupDisconnected();
      renderPage();
      expect(screen.getByText(/conecte sua carteira/i)).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("estado vazio", () => {
    it("exibe mensagem quando nao ha disputas relacionadas ao usuario", () => {
      setupOrders([]);
      renderPage();
      expect(screen.getByTestId("empty-minhas-disputas")).toBeDefined();
    });

    it("exibe empty quando disputas existem mas nenhuma e do usuario", () => {
      setupOrders([UNRELATED_DISPUTE]);
      renderPage();
      expect(screen.getByTestId("empty-minhas-disputas")).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("TC-DA01 — disputa como instituicao", () => {
    beforeEach(() => setupOrders([DISPUTE_AS_INSTITUTION]));

    it("exibe disputa onde usuario e a instituicao", () => {
      renderPage();
      expect(
        screen.getByTestId(`dispute-card-${DISPUTE_AS_INSTITUTION.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe formulario de upload de evidencia para disputa ativa", () => {
      renderPage();
      expect(
        screen.getByTestId(
          `input-evidence-file-${DISPUTE_AS_INSTITUTION.purchaseId}`,
        ),
      ).toBeDefined();
    });

    it("exibe botao Enviar Evidencia desabilitado sem arquivo", () => {
      renderPage();
      const btn = screen.getByTestId(
        `btn-enviar-evidencia-${DISPUTE_AS_INSTITUTION.purchaseId}`,
      ) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("TC-F03 — upload de evidencia chama addDisputeEvidence com hash correto", async () => {
      renderPage();

      const fileInput = screen.getByTestId(
        `input-evidence-file-${DISPUTE_AS_INSTITUTION.purchaseId}`,
      ) as HTMLInputElement;
      const file = new File(["evidence"], "evidence.jpg", {
        type: "image/jpeg",
      });
      fireEvent.change(fileInput, { target: { files: [file] } });

      fireEvent.click(
        screen.getByTestId(
          `btn-enviar-evidencia-${DISPUTE_AS_INSTITUTION.purchaseId}`,
        ),
      );

      await waitFor(() => {
        expect(mockUploadAsBytes32).toHaveBeenCalledWith(file);
        expect(mockAddDisputeEvidence).toHaveBeenCalledWith(
          DISPUTE_AS_INSTITUTION.purchaseId,
          EVIDENCE_HASH,
        );
      });
    });

    it("exibe confirmacao de sucesso apos enviar evidencia", async () => {
      renderPage();

      const fileInput = screen.getByTestId(
        `input-evidence-file-${DISPUTE_AS_INSTITUTION.purchaseId}`,
      ) as HTMLInputElement;
      const file = new File(["evidence"], "evidence.jpg", {
        type: "image/jpeg",
      });
      fireEvent.change(fileInput, { target: { files: [file] } });
      fireEvent.click(
        screen.getByTestId(
          `btn-enviar-evidencia-${DISPUTE_AS_INSTITUTION.purchaseId}`,
        ),
      );

      await waitFor(() => {
        expect(screen.getByTestId("evidence-success")).toBeDefined();
      });
    });
  });

  // ----------------------------------------------------------------
  describe("countdown do prazo de disputa", () => {
    it("exibe countdown do prazo de disputa no card", () => {
      setupOrders([DISPUTE_AS_INSTITUTION]);
      renderPage();
      expect(
        screen.getByTestId(
          `dispute-countdown-${DISPUTE_AS_INSTITUTION.purchaseId}`,
        ),
      ).toBeDefined();
    });

    it("desabilita botao de evidencia quando janela de disputa expirou", () => {
      const disputeExpirada = {
        ...DISPUTE_AS_INSTITUTION,
        disputeDeadline: 1n,
      };
      setupOrders([disputeExpirada]);
      renderPage();

      const fileInput = screen.getByTestId(
        `input-evidence-file-${disputeExpirada.purchaseId}`,
      ) as HTMLInputElement;
      const file = new File(["evidence"], "evidence.jpg", {
        type: "image/jpeg",
      });
      fireEvent.change(fileInput, { target: { files: [file] } });

      const btn = screen.getByTestId(
        `btn-enviar-evidencia-${disputeExpirada.purchaseId}`,
      ) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  describe("linha do tempo — nomes e evidencias", () => {
    beforeEach(() => setupOrders([DISPUTE_AS_INSTITUTION]));

    it("exibe linha do tempo no card de disputa", () => {
      renderPage();
      expect(
        screen.getByTestId(
          `dispute-timeline-${DISPUTE_AS_INSTITUTION.purchaseId}`,
        ),
      ).toBeDefined();
    });

    it("exibe hash de evidencia quando existe evidencia na disputa", () => {
      mockUseDisputeEvidences.mockReturnValue({
        evidences: [
          {
            ipfsHash: EVIDENCE_HASH,
            submittedBy: INSTITUTION,
          },
        ],
        loading: false,
        refetch: vi.fn(),
      });
      renderPage();
      expect(
        screen.getByTestId(
          `timeline-evidence-${DISPUTE_AS_INSTITUTION.purchaseId}-0`,
        ),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("TC-DA02 — disputa como fornecedor", () => {
    beforeEach(() => {
      setupWallet(INSTITUTION); // INSTITUTION address == supplier in this dispute
      setupOrders([DISPUTE_AS_SUPPLIER]);
    });

    it("exibe disputa onde usuario e o fornecedor", () => {
      renderPage();
      expect(
        screen.getByTestId(`dispute-card-${DISPUTE_AS_SUPPLIER.purchaseId}`),
      ).toBeDefined();
    });
  });
});
