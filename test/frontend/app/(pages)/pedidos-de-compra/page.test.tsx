import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@test/utils/render";
import PedidosDeCompraPage from "@/app/(pages)/pedidos-de-compra/page";
import { PurchaseStatus } from "@/services/purchaseService";
import type { Purchase } from "@/services/purchaseService";

// ----- hoisted mocks -----
const {
  mockUseWallet,
  mockUsePurchaseOrders,
  mockUseSuppliers,
  mockOpenDispute,
  mockProjectBalance,
  mockLockedBalance,
  mockUseIpfsMetadata,
  mockUsePurchaseManager,
} = vi.hoisted(() => ({
  mockUseWallet: vi.fn(),
  mockUsePurchaseOrders: vi.fn(),
  mockUseSuppliers: vi.fn(),
  mockOpenDispute: vi.fn(),
  mockProjectBalance: vi.fn(),
  mockLockedBalance: vi.fn(),
  mockUseIpfsMetadata: vi.fn(),
  mockUsePurchaseManager: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({ useWallet: mockUseWallet }));
vi.mock("@/hooks/usePurchaseOrders", () => ({
  usePurchaseOrders: mockUsePurchaseOrders,
}));
vi.mock("@/hooks/useSuppliers", () => ({ useSuppliers: mockUseSuppliers }));
vi.mock("@/hooks/usePurchaseManager", () => ({
  usePurchaseManager: mockUsePurchaseManager,
}));
vi.mock("@/hooks/useTreasury", () => ({
  useTreasury: vi.fn(() => ({
    projectBalance: mockProjectBalance,
    lockedBalance: mockLockedBalance,
    loading: false,
    error: null,
  })),
}));
vi.mock("@/hooks/useIpfsMetadata", () => ({
  useIpfsMetadata: mockUseIpfsMetadata,
}));

// ----- fixtures -----
const INSTITUTION = "0xINST000000000000000000000000000000000000";
const SUPPLIER = "0xAAAA000000000000000000000000000000000001";
const SUPPLIER_NAME = "Distribuidora Alpha";

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
    impactProofHash:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    confirmDeadline: 0n,
    disputeDeadline: 0n,
    supplierVoteWeight: 0n,
    institutionVoteWeight: 0n,
    ...overrides,
  };
}

const ORDER_OPEN = makeOrder(1n, PurchaseStatus.Open);
const ORDER_OPEN_EXPIRED = makeOrder(2n, PurchaseStatus.Open, {
  deliveryDeadline: 1n,
});
const ORDER_DELIVERED = makeOrder(3n, PurchaseStatus.Delivered, {
  confirmDeadline: 9_999_999_999n,
});
const ORDER_DELIVERED_CONFIRM_EXPIRED = makeOrder(
  7n,
  PurchaseStatus.Delivered,
  {
    confirmDeadline: 1n,
  },
);
const ORDER_DISPUTED = makeOrder(4n, PurchaseStatus.Disputed);
const ORDER_PAID = makeOrder(5n, PurchaseStatus.Paid, {
  impactProofHash:
    "0xdeadbeef00000000000000000000000000000000000000000000000000000000",
});
const ORDER_REFUNDED = makeOrder(6n, PurchaseStatus.Refunded);

const ONE_ETH = 1_000_000_000_000_000_000n;

// ----- helpers -----
function setupWallet(connected = true) {
  mockUseWallet.mockReturnValue({
    provider: connected ? { _isProvider: true } : null,
    signer: connected ? { _isSigner: true } : null,
    address: connected ? INSTITUTION : null,
    role: connected ? "instituicao" : null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
}

function setupOrders(orders: Purchase[] = [ORDER_OPEN]) {
  mockUsePurchaseOrders.mockReturnValue({
    orders,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
}

function setupSuppliers() {
  mockUseSuppliers.mockReturnValue({
    suppliers: [
      {
        address: SUPPLIER,
        name: SUPPLIER_NAME,
        serviceType: "Alimentos",
        approved: true,
      },
    ],
    loading: false,
    error: null,
  });
}

function setupBalances(project = ONE_ETH * 2n, locked = ONE_ETH) {
  mockProjectBalance.mockResolvedValue(project);
  mockLockedBalance.mockResolvedValue(locked);
}

function renderPage() {
  return render(<PedidosDeCompraPage />);
}

// ----- testes -----
describe("PedidosDeCompraPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenDispute.mockResolvedValue(undefined);
    mockUseIpfsMetadata.mockReturnValue({ metadata: null, loading: false });
    mockUsePurchaseManager.mockReturnValue({
      openDispute: mockOpenDispute,
      loading: false,
      error: null,
    });
    setupWallet();
    setupOrders();
    setupSuppliers();
    setupBalances();
  });

  it("renderiza sem erros", () => {
    expect(() => renderPage()).not.toThrow();
  });

  // ----------------------------------------------------------------
  describe("controle de acesso — TC-W02", () => {
    it("TC-W02 — sem carteira exibe aviso de conexao", () => {
      setupWallet(false);
      renderPage();
      expect(screen.getByText(/conecte sua carteira/i)).toBeDefined();
    });

    it("TC-W02 — sem carteira nao exibe lista de pedidos", () => {
      setupWallet(false);
      renderPage();
      expect(screen.queryByTestId("order-card-1")).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  describe("lista de pedidos", () => {
    it("exibe card para cada pedido", () => {
      setupOrders([ORDER_OPEN, ORDER_DELIVERED]);
      renderPage();
      expect(
        screen.getByTestId(`order-card-${ORDER_OPEN.purchaseId}`),
      ).toBeDefined();
      expect(
        screen.getByTestId(`order-card-${ORDER_DELIVERED.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe badge de status no card", () => {
      renderPage();
      expect(
        screen.getByTestId(`status-badge-${ORDER_OPEN.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe valor ETH do pedido no card", () => {
      renderPage();
      expect(screen.getByText(/0\.5/)).toBeDefined();
    });

    it("exibe nome do fornecedor no card", () => {
      renderPage();
      expect(screen.getByText(SUPPLIER_NAME)).toBeDefined();
    });

    it("exibe endereco truncado quando fornecedor nao esta na lista", () => {
      mockUseSuppliers.mockReturnValue({
        suppliers: [],
        loading: false,
        error: null,
      });
      renderPage();
      expect(screen.getByText(/0xAAAA\.\.\.0001/i)).toBeDefined();
    });

    it("exibe estado vazio quando nao ha pedidos", () => {
      setupOrders([]);
      renderPage();
      expect(screen.getByTestId("empty-orders")).toBeDefined();
    });

    it("exibe loader enquanto carrega", () => {
      mockUsePurchaseOrders.mockReturnValue({
        orders: [],
        loading: true,
        error: null,
        refetch: vi.fn(),
      });
      renderPage();
      expect(document.querySelector(".mantine-Loader-root")).not.toBeNull();
    });

    it("exibe erro quando hook retorna error", () => {
      mockUsePurchaseOrders.mockReturnValue({
        orders: [],
        loading: false,
        error: "Erro ao carregar pedidos",
        refetch: vi.fn(),
      });
      renderPage();
      expect(screen.getByText(/erro ao carregar pedidos/i)).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("titulo e descricao via IPFS no card", () => {
    it("exibe titulo quando metadados IPFS disponiveis", () => {
      mockUseIpfsMetadata.mockReturnValue({
        metadata: {
          title: "Cestas básicas",
          description: "100 cestas para famílias",
          createdAt: "2026-05-28",
        },
        loading: false,
      });
      setupOrders([ORDER_OPEN]);
      renderPage();
      expect(screen.getByText("Cestas básicas")).toBeDefined();
    });

    it("nao exibe titulo quando metadados IPFS indisponiveis", () => {
      setupOrders([ORDER_OPEN]);
      renderPage();
      expect(
        screen.queryByTestId(`order-title-${ORDER_OPEN.purchaseId}`),
      ).toBeNull();
    });

    it("exibe testids de titulo e descricao no card quando metadados disponiveis", () => {
      mockUseIpfsMetadata.mockReturnValue({
        metadata: {
          title: "Cestas básicas",
          description: "100 cestas para famílias",
          createdAt: "2026-05-28",
        },
        loading: false,
      });
      setupOrders([ORDER_OPEN]);
      renderPage();
      expect(
        screen.getByTestId(`order-title-${ORDER_OPEN.purchaseId}`),
      ).toBeDefined();
      expect(
        screen.getByTestId(`order-description-${ORDER_OPEN.purchaseId}`),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("botoes — pedido Open no prazo", () => {
    beforeEach(() => setupOrders([ORDER_OPEN]));

    it("nao exibe botao Abrir Disputa quando prazo nao expirou", () => {
      renderPage();
      expect(
        screen.queryByTestId(`btn-abrir-disputa-${ORDER_OPEN.purchaseId}`),
      ).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  describe("botoes — pedido Open com deliveryDeadline expirado", () => {
    beforeEach(() => setupOrders([ORDER_OPEN_EXPIRED]));

    it("exibe botao Abrir Disputa diretamente no card", () => {
      renderPage();
      expect(
        screen.getByTestId(
          `btn-abrir-disputa-${ORDER_OPEN_EXPIRED.purchaseId}`,
        ),
      ).toBeDefined();
    });

    it("chama openDispute ao clicar", async () => {
      renderPage();
      fireEvent.click(
        screen.getByTestId(
          `btn-abrir-disputa-${ORDER_OPEN_EXPIRED.purchaseId}`,
        ),
      );
      await waitFor(() => {
        expect(mockOpenDispute).toHaveBeenCalledWith(
          ORDER_OPEN_EXPIRED.purchaseId,
        );
      });
    });
  });

  // ----------------------------------------------------------------
  describe("botoes — pedido Delivered dentro do prazo de confirmacao", () => {
    beforeEach(() => setupOrders([ORDER_DELIVERED]));

    it("exibe botao Ir para Recebimentos quando confirmDeadline nao expirou", () => {
      renderPage();
      expect(
        screen.getByTestId(`btn-ir-recebimentos-${ORDER_DELIVERED.purchaseId}`),
      ).toBeDefined();
    });

    it("nao exibe botao Abrir Disputa quando confirmDeadline nao expirou", () => {
      renderPage();
      expect(
        screen.queryByTestId(`btn-abrir-disputa-${ORDER_DELIVERED.purchaseId}`),
      ).toBeNull();
    });

    it("exibe countdown de confirmacao no card quando confirmDeadline nao expirou", () => {
      renderPage();
      expect(
        screen.getByTestId(`confirm-countdown-${ORDER_DELIVERED.purchaseId}`),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("countdown de confirmacao — pedido Delivered com confirmDeadline expirado", () => {
    beforeEach(() => setupOrders([ORDER_DELIVERED_CONFIRM_EXPIRED]));

    it("nao exibe countdown de confirmacao quando confirmDeadline expirou", () => {
      renderPage();
      expect(
        screen.queryByTestId(
          `confirm-countdown-${ORDER_DELIVERED_CONFIRM_EXPIRED.purchaseId}`,
        ),
      ).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  describe("pedido Delivered com confirmDeadline expirado — UC-08", () => {
    beforeEach(() => setupOrders([ORDER_DELIVERED_CONFIRM_EXPIRED]));

    it("nao exibe botao Abrir Disputa para a instituicao — apenas fornecedor pode abrir", () => {
      renderPage();
      expect(
        screen.queryByTestId(
          `btn-abrir-disputa-${ORDER_DELIVERED_CONFIRM_EXPIRED.purchaseId}`,
        ),
      ).toBeNull();
    });

    it("exibe texto informativo quando confirmDeadline expirou", () => {
      renderPage();
      expect(
        screen.getByTestId(
          `confirm-expired-info-${ORDER_DELIVERED_CONFIRM_EXPIRED.purchaseId}`,
        ),
      ).toBeDefined();
    });

    it("nao exibe botao Ir para Recebimentos quando confirmDeadline expirou", () => {
      renderPage();
      expect(
        screen.queryByTestId(
          `btn-ir-recebimentos-${ORDER_DELIVERED_CONFIRM_EXPIRED.purchaseId}`,
        ),
      ).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  describe("botoes — pedido Disputed", () => {
    beforeEach(() => setupOrders([ORDER_DISPUTED]));

    it("exibe botao Ver Disputa diretamente no card", () => {
      renderPage();
      expect(
        screen.getByTestId(`btn-ver-disputa-${ORDER_DISPUTED.purchaseId}`),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("botoes — pedido Paid", () => {
    beforeEach(() => setupOrders([ORDER_PAID]));

    it("exibe hash do Proof of Impact diretamente no card", () => {
      renderPage();
      expect(
        screen.getByTestId(`impact-proof-hash-${ORDER_PAID.purchaseId}`),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("botoes — pedido Refunded", () => {
    beforeEach(() => setupOrders([ORDER_REFUNDED]));

    it("exibe mensagem de valor devolvido diretamente no card", () => {
      renderPage();
      expect(
        screen.getByTestId(`refunded-info-${ORDER_REFUNDED.purchaseId}`),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("exibicao de erro de transacao", () => {
    it("exibe alerta de erro quando usePurchaseManager retorna erro", () => {
      mockUsePurchaseManager.mockReturnValue({
        openDispute: mockOpenDispute,
        loading: false,
        error: "Pedido de compra não encontrado.",
      });
      setupOrders([ORDER_OPEN_EXPIRED]);
      renderPage();
      expect(screen.getByTestId("tx-error")).toBeDefined();
      expect(
        screen.getByText("Pedido de compra não encontrado."),
      ).toBeDefined();
    });

    it("nao exibe alerta de erro quando error e null", () => {
      setupOrders([ORDER_OPEN_EXPIRED]);
      renderPage();
      expect(screen.queryByTestId("tx-error")).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  describe("reatividade — atualiza UI automaticamente sem recarregar pagina", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("botao Abrir Disputa aparece sozinho quando deliveryDeadline expira", async () => {
      vi.useFakeTimers();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 2);
      const order = makeOrder(99n, PurchaseStatus.Open, {
        deliveryDeadline: deadline,
      });
      setupOrders([order]);
      renderPage();

      expect(screen.queryByTestId("btn-abrir-disputa-99")).toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByTestId("btn-abrir-disputa-99")).toBeDefined();
    });

    it("texto de confirmacao expirada aparece sozinho quando confirmDeadline expira — mesmo com deliveryDeadline ja expirado", async () => {
      vi.useFakeTimers();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 2);
      // deliveryDeadline=1n simula pedido já entregue (prazo de entrega no passado);
      // countdown de entrega para imediatamente — confirmDeadline precisa de seu proprio contador
      const order = makeOrder(100n, PurchaseStatus.Delivered, {
        deliveryDeadline: 1n,
        confirmDeadline: deadline,
      });
      setupOrders([order]);
      renderPage();

      expect(screen.queryByTestId("confirm-expired-info-100")).toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByTestId("confirm-expired-info-100")).toBeDefined();
    });

    it("botao Ir para Recebimentos some sozinho quando confirmDeadline expira — mesmo com deliveryDeadline ja expirado", async () => {
      vi.useFakeTimers();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 2);
      const order = makeOrder(101n, PurchaseStatus.Delivered, {
        deliveryDeadline: 1n,
        confirmDeadline: deadline,
      });
      setupOrders([order]);
      renderPage();

      expect(screen.getByTestId("btn-ir-recebimentos-101")).toBeDefined();

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.queryByTestId("btn-ir-recebimentos-101")).toBeNull();
    });
  });
});
