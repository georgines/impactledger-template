import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@test/utils/render";
import PedidosRecebidosPage from "@/app/(pages)/pedidos-recebidos/page";
import { PurchaseStatus } from "@/services/purchaseService";
import type { Purchase } from "@/services/purchaseService";

// ----- hoisted mocks -----
const {
  mockUseWallet,
  mockUseSupplierOrders,
  mockConfirmDelivery,
  mockOpenDispute,
  mockUseIpfsMetadata,
  mockUsePurchaseManager,
} = vi.hoisted(() => ({
  mockUseWallet: vi.fn(),
  mockUseSupplierOrders: vi.fn(),
  mockConfirmDelivery: vi.fn(),
  mockOpenDispute: vi.fn(),
  mockUseIpfsMetadata: vi.fn(),
  mockUsePurchaseManager: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({ useWallet: mockUseWallet }));
vi.mock("@/hooks/useSupplierOrders", () => ({
  useSupplierOrders: mockUseSupplierOrders,
}));
vi.mock("@/hooks/usePurchaseManager", () => ({
  usePurchaseManager: mockUsePurchaseManager,
}));
vi.mock("@/hooks/useIpfsMetadata", () => ({
  useIpfsMetadata: mockUseIpfsMetadata,
}));
vi.mock("@/hooks/useInstitutions", () => ({
  useInstitutions: vi.fn(() => ({
    institutions: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

// ----- fixtures -----
const SUPPLIER = "0xAAAA000000000000000000000000000000000001";
const INSTITUTION = "0xINST000000000000000000000000000000000000";
const EMPTY_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function makeOrder(
  purchaseId: bigint,
  status: PurchaseStatus,
  overrides: Partial<Purchase> = {},
): Purchase {
  return {
    purchaseId,
    institution: INSTITUTION,
    supplier: SUPPLIER,
    amount: 500_000_000_000_000_000n,
    deliveryDeadline: 9_999_999_999n,
    descriptionHash: "0xhash",
    status,
    impactProofHash: EMPTY_HASH,
    confirmDeadline: 9_999_999_999n,
    disputeDeadline: 0n,
    supplierVoteWeight: 0n,
    institutionVoteWeight: 0n,
    ...overrides,
  };
}

const ORDER_OPEN = makeOrder(1n, PurchaseStatus.Open);
const ORDER_OPEN_EXPIRED = makeOrder(7n, PurchaseStatus.Open, {
  deliveryDeadline: 1n,
});
const ORDER_DELIVERED = makeOrder(2n, PurchaseStatus.Delivered);
const ORDER_DELIVERED_CONFIRM_EXPIRED = makeOrder(
  6n,
  PurchaseStatus.Delivered,
  {
    confirmDeadline: 1n,
  },
);
const ORDER_DISPUTED = makeOrder(3n, PurchaseStatus.Disputed, {
  disputeDeadline: 9_999_999_999n,
});
const ORDER_PAID = makeOrder(4n, PurchaseStatus.Paid);
const ORDER_REFUNDED = makeOrder(5n, PurchaseStatus.Refunded);

// ----- helpers -----
function setupWallet(connected = true) {
  mockUseWallet.mockReturnValue({
    provider: connected ? { _isProvider: true } : null,
    signer: connected ? { _isSigner: true } : null,
    address: connected ? SUPPLIER : null,
    role: connected ? "fornecedor" : null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
}

function setupOrders(orders: Purchase[] = []) {
  mockUseSupplierOrders.mockReturnValue({
    orders,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
}

function renderPage() {
  return render(<PedidosRecebidosPage />);
}

// ----- testes -----
describe("PedidosRecebidosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirmDelivery.mockResolvedValue(undefined);
    mockOpenDispute.mockResolvedValue(undefined);
    mockUseIpfsMetadata.mockReturnValue({ metadata: null, loading: false });
    mockUsePurchaseManager.mockReturnValue({
      confirmDelivery: mockConfirmDelivery,
      openDispute: mockOpenDispute,
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
    it("exibe mensagem quando nao ha pedidos", () => {
      setupOrders([]);
      renderPage();
      expect(screen.getByTestId("empty-pedidos-recebidos")).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("informacoes do card", () => {
    it("exibe card para cada pedido", () => {
      setupOrders([ORDER_OPEN]);
      renderPage();
      expect(
        screen.getByTestId(`order-card-${ORDER_OPEN.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe badge de status no card", () => {
      setupOrders([ORDER_OPEN]);
      renderPage();
      expect(
        screen.getByTestId(`status-badge-${ORDER_OPEN.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe valor ETH do pedido", () => {
      setupOrders([ORDER_OPEN]);
      renderPage();
      expect(screen.getByText(/0\.5/)).toBeDefined();
    });

    it("exibe titulo do pedido quando IPFS disponivel", () => {
      mockUseIpfsMetadata.mockReturnValue({
        metadata: {
          title: "Materiais escolares",
          description: "100 kits",
          createdAt: "2026-05-28",
        },
        loading: false,
      });
      setupOrders([ORDER_OPEN]);
      renderPage();
      expect(
        screen.getByTestId(`order-title-${ORDER_OPEN.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe descricao do pedido quando IPFS disponivel", () => {
      mockUseIpfsMetadata.mockReturnValue({
        metadata: {
          title: "Materiais escolares",
          description: "100 kits",
          createdAt: "2026-05-28",
        },
        loading: false,
      });
      setupOrders([ORDER_OPEN]);
      renderPage();
      expect(
        screen.getByTestId(`order-description-${ORDER_OPEN.purchaseId}`),
      ).toBeDefined();
    });

    it("nao exibe titulo quando metadados IPFS indisponiveis", () => {
      setupOrders([ORDER_OPEN]);
      renderPage();
      expect(
        screen.queryByTestId(`order-title-${ORDER_OPEN.purchaseId}`),
      ).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  describe("status Open dentro do prazo — TC-F01", () => {
    beforeEach(() => setupOrders([ORDER_OPEN]));

    it("exibe botao Confirmar Entrega para pedido Open", () => {
      renderPage();
      expect(
        screen.getByTestId(`btn-confirmar-entrega-${ORDER_OPEN.purchaseId}`),
      ).toBeDefined();
    });

    it("TC-F01 — clicar Confirmar Entrega chama confirmDelivery com purchaseId correto", async () => {
      renderPage();
      fireEvent.click(
        screen.getByTestId(`btn-confirmar-entrega-${ORDER_OPEN.purchaseId}`),
      );
      await waitFor(() => {
        expect(mockConfirmDelivery).toHaveBeenCalledWith(ORDER_OPEN.purchaseId);
      });
    });
  });

  // ----------------------------------------------------------------
  describe("status Open com deliveryDeadline expirado — UC-07", () => {
    beforeEach(() => setupOrders([ORDER_OPEN_EXPIRED]));

    it("nao exibe botao Confirmar Entrega quando prazo expirou — apenas instituicao abre disputa", () => {
      renderPage();
      expect(
        screen.queryByTestId(
          `btn-confirmar-entrega-${ORDER_OPEN_EXPIRED.purchaseId}`,
        ),
      ).toBeNull();
    });

    it("exibe texto informativo quando deliveryDeadline expirou", () => {
      renderPage();
      expect(
        screen.getByTestId(
          `delivery-expired-info-${ORDER_OPEN_EXPIRED.purchaseId}`,
        ),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("status Delivered dentro do prazo", () => {
    beforeEach(() => setupOrders([ORDER_DELIVERED]));

    it("nao exibe botao Confirmar Entrega", () => {
      renderPage();
      expect(
        screen.queryByTestId(
          `btn-confirmar-entrega-${ORDER_DELIVERED.purchaseId}`,
        ),
      ).toBeNull();
    });

    it("nao exibe botao Abrir Disputa quando prazo nao expirou", () => {
      renderPage();
      expect(
        screen.queryByTestId(`btn-abrir-disputa-${ORDER_DELIVERED.purchaseId}`),
      ).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  describe("status Delivered com confirmDeadline expirado — UC-08", () => {
    beforeEach(() => setupOrders([ORDER_DELIVERED_CONFIRM_EXPIRED]));

    it("exibe botao Abrir Disputa quando confirmDeadline expirou", () => {
      renderPage();
      expect(
        screen.getByTestId(
          `btn-abrir-disputa-${ORDER_DELIVERED_CONFIRM_EXPIRED.purchaseId}`,
        ),
      ).toBeDefined();
    });

    it("chama openDispute com purchaseId correto ao clicar — UC-08", async () => {
      renderPage();
      fireEvent.click(
        screen.getByTestId(
          `btn-abrir-disputa-${ORDER_DELIVERED_CONFIRM_EXPIRED.purchaseId}`,
        ),
      );
      await waitFor(() => {
        expect(mockOpenDispute).toHaveBeenCalledWith(
          ORDER_DELIVERED_CONFIRM_EXPIRED.purchaseId,
        );
      });
    });
  });

  // ----------------------------------------------------------------
  describe("status Disputed", () => {
    beforeEach(() => setupOrders([ORDER_DISPUTED]));

    it("exibe card do pedido em disputa com badge", () => {
      renderPage();
      expect(
        screen.getByTestId(`order-card-${ORDER_DISPUTED.purchaseId}`),
      ).toBeDefined();
      expect(
        screen.getByTestId(`status-badge-${ORDER_DISPUTED.purchaseId}`),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("status Paid e Refunded — TC-F04", () => {
    it("TC-F04 — exibe card para pedido Paid", () => {
      setupOrders([ORDER_PAID]);
      renderPage();
      expect(
        screen.getByTestId(`order-card-${ORDER_PAID.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe card para pedido Refunded", () => {
      setupOrders([ORDER_REFUNDED]);
      renderPage();
      expect(
        screen.getByTestId(`order-card-${ORDER_REFUNDED.purchaseId}`),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("exibicao de erro de transacao", () => {
    it("exibe alerta tx-error quando usePurchaseManager retorna erro", () => {
      mockUsePurchaseManager.mockReturnValue({
        confirmDelivery: mockConfirmDelivery,
        openDispute: mockOpenDispute,
        loading: false,
        error: "Pedido de compra não encontrado.",
      });
      setupOrders([ORDER_DELIVERED_CONFIRM_EXPIRED]);
      renderPage();
      expect(screen.getByTestId("tx-error")).toBeDefined();
      expect(
        screen.getByText("Pedido de compra não encontrado."),
      ).toBeDefined();
    });

    it("nao exibe alerta tx-error quando error e null", () => {
      setupOrders([ORDER_OPEN]);
      renderPage();
      expect(screen.queryByTestId("tx-error")).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  describe("reatividade — atualiza UI automaticamente sem recarregar pagina", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("texto informativo aparece sozinho quando deliveryDeadline expira", async () => {
      vi.useFakeTimers();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 2);
      const order = makeOrder(99n, PurchaseStatus.Open, {
        deliveryDeadline: deadline,
      });
      setupOrders([order]);
      renderPage();

      expect(screen.queryByTestId("delivery-expired-info-99")).toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByTestId("delivery-expired-info-99")).toBeDefined();
    });

    it("botao Confirmar Entrega some sozinho quando deliveryDeadline expira", async () => {
      vi.useFakeTimers();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 2);
      const order = makeOrder(100n, PurchaseStatus.Open, {
        deliveryDeadline: deadline,
      });
      setupOrders([order]);
      renderPage();

      expect(screen.getByTestId("btn-confirmar-entrega-100")).toBeDefined();

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.queryByTestId("btn-confirmar-entrega-100")).toBeNull();
    });

    it("botao Abrir Disputa aparece sozinho quando confirmDeadline expira — mesmo com deliveryDeadline ja expirado", async () => {
      vi.useFakeTimers();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 2);
      // deliveryDeadline=1n simula pedido entregue; countdown de entrega para imediatamente
      const order = makeOrder(101n, PurchaseStatus.Delivered, {
        deliveryDeadline: 1n,
        confirmDeadline: deadline,
      });
      setupOrders([order]);
      renderPage();

      expect(screen.queryByTestId("btn-abrir-disputa-101")).toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByTestId("btn-abrir-disputa-101")).toBeDefined();
    });

    it("mensagem de aguardando some sozinha quando confirmDeadline expira — mesmo com deliveryDeadline ja expirado", async () => {
      vi.useFakeTimers();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 2);
      const order = makeOrder(102n, PurchaseStatus.Delivered, {
        deliveryDeadline: 1n,
        confirmDeadline: deadline,
      });
      setupOrders([order]);
      renderPage();

      expect(
        screen.getByText(/aguardando confirmação da instituição/i),
      ).toBeDefined();

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(
        screen.queryByText(/aguardando confirmação da instituição/i),
      ).toBeNull();
    });
  });
});
