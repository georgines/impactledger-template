import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@test/utils/render";
import MeusRecebimentosPage from "@/app/(pages)/meus-recebimentos/page";
import { PurchaseStatus } from "@/services/purchaseService";
import type { Purchase } from "@/services/purchaseService";

// ----- hoisted mocks -----
const {
  mockUseWallet,
  mockUsePurchaseOrders,
  mockUseSuppliers,
  mockConfirmReceipt,
  mockConfirmReceiptAndSubmitProof,
  mockSubmitImpactProof,
  mockOpenDispute,
  mockUploadAsBytes32,
} = vi.hoisted(() => ({
  mockUseWallet: vi.fn(),
  mockUsePurchaseOrders: vi.fn(),
  mockUseSuppliers: vi.fn(),
  mockConfirmReceipt: vi.fn(),
  mockConfirmReceiptAndSubmitProof: vi.fn(),
  mockSubmitImpactProof: vi.fn(),
  mockOpenDispute: vi.fn(),
  mockUploadAsBytes32: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({ useWallet: mockUseWallet }));
vi.mock("@/hooks/usePurchaseOrders", () => ({
  usePurchaseOrders: mockUsePurchaseOrders,
}));
vi.mock("@/hooks/useSuppliers", () => ({ useSuppliers: mockUseSuppliers }));
vi.mock("@/hooks/usePurchaseManager", () => ({
  usePurchaseManager: vi.fn(() => ({
    confirmReceipt: mockConfirmReceipt,
    confirmReceiptAndSubmitProof: mockConfirmReceiptAndSubmitProof,
    submitImpactProof: mockSubmitImpactProof,
    openDispute: mockOpenDispute,
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
const SUPPLIER_NAME = "Distribuidora Beta";
const CREATED_AT = 1748563200; // 2026-05-30
const PROOF_HASH =
  "0xdeadbeef00000000000000000000000000000000000000000000000000000000";
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

const ORDER_DELIVERED = makeOrder(1n, PurchaseStatus.Delivered, {
  createdAt: CREATED_AT,
});
const ORDER_DELIVERED_CONFIRM_EXPIRED = makeOrder(
  5n,
  PurchaseStatus.Delivered,
  {
    confirmDeadline: 1n,
    createdAt: CREATED_AT,
  },
);
const ORDER_CONFIRMED = makeOrder(2n, PurchaseStatus.Confirmed, {
  createdAt: CREATED_AT,
});
const ORDER_PAID = makeOrder(3n, PurchaseStatus.Paid, {
  impactProofHash: PROOF_HASH,
  createdAt: CREATED_AT,
});
const ORDER_REFUNDED = makeOrder(4n, PurchaseStatus.Refunded, {
  createdAt: CREATED_AT,
});

// ----- helpers -----
function setupSuppliers(withName = true) {
  mockUseSuppliers.mockReturnValue({
    suppliers: withName
      ? [
          {
            address: SUPPLIER,
            name: SUPPLIER_NAME,
            serviceType: "Alimentos",
            approved: true,
          },
        ]
      : [],
    loading: false,
    error: null,
  });
}

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

function setupOrders(orders: Purchase[] = []) {
  mockUsePurchaseOrders.mockReturnValue({
    orders,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
}

function renderPage() {
  return render(<MeusRecebimentosPage />);
}

// ----- testes -----
describe("MeusRecebimentosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirmReceipt.mockResolvedValue(undefined);
    mockConfirmReceiptAndSubmitProof.mockResolvedValue(undefined);
    mockSubmitImpactProof.mockResolvedValue(undefined);
    mockUploadAsBytes32.mockResolvedValue(PROOF_HASH);
    setupWallet();
    setupOrders();
    setupSuppliers();
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
  });

  // ----------------------------------------------------------------
  describe("nome do fornecedor e data nos cards", () => {
    it("exibe nome do fornecedor no card Delivered quando esta na lista", () => {
      setupOrders([ORDER_DELIVERED]);
      renderPage();
      expect(screen.getByText(SUPPLIER_NAME)).toBeDefined();
    });

    it("exibe endereco truncado no card Delivered quando fornecedor nao esta na lista", () => {
      setupSuppliers(false);
      setupOrders([ORDER_DELIVERED]);
      renderPage();
      expect(screen.getByText(/0xAAAA\.\.\.0001/i)).toBeDefined();
    });

    it("exibe nome do fornecedor no card Confirmed", () => {
      setupOrders([ORDER_CONFIRMED]);
      renderPage();
      expect(screen.getByText(SUPPLIER_NAME)).toBeDefined();
    });

    it("exibe nome do fornecedor no card de historico", () => {
      setupOrders([ORDER_PAID]);
      renderPage();
      expect(screen.getByText(SUPPLIER_NAME)).toBeDefined();
    });

    it("exibe data do pedido no card Delivered", () => {
      setupOrders([ORDER_DELIVERED]);
      renderPage();
      expect(
        screen.getByTestId(`order-date-${ORDER_DELIVERED.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe data do pedido no card Confirmed", () => {
      setupOrders([ORDER_CONFIRMED]);
      renderPage();
      expect(
        screen.getByTestId(`order-date-${ORDER_CONFIRMED.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe data do pedido no card de historico", () => {
      setupOrders([ORDER_PAID]);
      renderPage();
      expect(
        screen.getByTestId(`order-date-${ORDER_PAID.purchaseId}`),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("estado vazio", () => {
    it("exibe mensagem quando nao ha pedidos para confirmar ou enviar proof", () => {
      setupOrders([]);
      renderPage();
      expect(screen.getByTestId("empty-recebimentos")).toBeDefined();
    });

    it("exibe empty state quando so ha pedidos Paid e Refunded e nenhum pendente", () => {
      setupOrders([ORDER_PAID, ORDER_REFUNDED]);
      renderPage();
      expect(screen.queryByTestId("section-aguardando-proof")).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  describe("secao Aguardando Proof of Impact — status Delivered", () => {
    beforeEach(() => setupOrders([ORDER_DELIVERED]));

    it("exibe secao quando ha pedidos Delivered", () => {
      renderPage();
      expect(screen.getByTestId("section-aguardando-proof")).toBeDefined();
    });

    it("exibe countdown de confirmacao quando confirmDeadline vigente", () => {
      renderPage();
      expect(
        screen.getByTestId(`confirm-countdown-${ORDER_DELIVERED.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe card do pedido Delivered", () => {
      renderPage();
      expect(
        screen.getByTestId(`confirmed-card-${ORDER_DELIVERED.purchaseId}`),
      ).toBeDefined();
    });

    it("nao exibe botao Confirmar Recebimento isolado para pedido Delivered", () => {
      renderPage();
      expect(
        screen.queryByTestId(
          `btn-confirmar-recebimento-${ORDER_DELIVERED.purchaseId}`,
        ),
      ).toBeNull();
    });

    it("exibe input de upload de proof para pedido Delivered", () => {
      renderPage();
      expect(
        screen.getByTestId(`input-proof-file-${ORDER_DELIVERED.purchaseId}`),
      ).toBeDefined();
    });

    it("TC-I05 — enviar proof para pedido Delivered chama confirmReceiptAndSubmitProof com hash correto", async () => {
      renderPage();

      const fileInput = screen.getByTestId(
        `input-proof-file-${ORDER_DELIVERED.purchaseId}`,
      ) as HTMLInputElement;
      const file = new File(["evidence"], "proof.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      fireEvent.click(
        screen.getByTestId(`btn-confirmar-${ORDER_DELIVERED.purchaseId}`),
      );

      await waitFor(() => {
        expect(mockUploadAsBytes32).toHaveBeenCalledWith(file);
        expect(mockConfirmReceiptAndSubmitProof).toHaveBeenCalledWith(
          ORDER_DELIVERED.purchaseId,
          PROOF_HASH,
        );
      });
    });

    it("pedido Delivered nao chama submitImpactProof separado", async () => {
      renderPage();

      const fileInput = screen.getByTestId(
        `input-proof-file-${ORDER_DELIVERED.purchaseId}`,
      ) as HTMLInputElement;
      fireEvent.change(fileInput, {
        target: { files: [new File(["e"], "p.jpg")] },
      });
      fireEvent.click(
        screen.getByTestId(`btn-confirmar-${ORDER_DELIVERED.purchaseId}`),
      );

      await waitFor(() =>
        expect(mockConfirmReceiptAndSubmitProof).toHaveBeenCalled(),
      );
      expect(mockSubmitImpactProof).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  describe("countdown de confirmacao — pedido Delivered com confirmDeadline expirado", () => {
    beforeEach(() => setupOrders([ORDER_DELIVERED_CONFIRM_EXPIRED]));

    it("nao exibe countdown quando confirmDeadline expirou", () => {
      renderPage();
      expect(
        screen.queryByTestId(
          `confirm-countdown-${ORDER_DELIVERED_CONFIRM_EXPIRED.purchaseId}`,
        ),
      ).toBeNull();
    });

    it("exibe botao Abrir Disputa quando confirmDeadline expirou", () => {
      renderPage();
      expect(
        screen.getByTestId(
          `btn-abrir-disputa-${ORDER_DELIVERED_CONFIRM_EXPIRED.purchaseId}`,
        ),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("secao Aguardando Proof of Impact — status Confirmed", () => {
    beforeEach(() => setupOrders([ORDER_CONFIRMED]));

    it("exibe secao quando ha pedidos Confirmed", () => {
      renderPage();
      expect(screen.getByTestId("section-aguardando-proof")).toBeDefined();
    });

    it("exibe card do pedido Confirmed", () => {
      renderPage();
      expect(
        screen.getByTestId(`confirmed-card-${ORDER_CONFIRMED.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe input de upload de arquivo para Proof of Impact", () => {
      renderPage();
      expect(
        screen.getByTestId(`input-proof-file-${ORDER_CONFIRMED.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe botao Registrar Proof of Impact", () => {
      renderPage();
      expect(
        screen.getByTestId(`btn-submit-proof-${ORDER_CONFIRMED.purchaseId}`),
      ).toBeDefined();
    });

    it("TC-I05 — upload + submit envia proof com hash correto", async () => {
      renderPage();

      const fileInput = screen.getByTestId(
        `input-proof-file-${ORDER_CONFIRMED.purchaseId}`,
      ) as HTMLInputElement;
      const file = new File(["evidence"], "proof.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      fireEvent.click(
        screen.getByTestId(`btn-submit-proof-${ORDER_CONFIRMED.purchaseId}`),
      );

      await waitFor(() => {
        expect(mockUploadAsBytes32).toHaveBeenCalledWith(file);
        expect(mockSubmitImpactProof).toHaveBeenCalledWith(
          ORDER_CONFIRMED.purchaseId,
          PROOF_HASH,
        );
      });
    });

    it("TC-I06 — botao submit desabilitado quando nenhum arquivo selecionado", () => {
      renderPage();
      const btn = screen.getByTestId(
        `btn-submit-proof-${ORDER_CONFIRMED.purchaseId}`,
      ) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("TC-I05 — pedido Confirmed chama submitImpactProof sem confirmReceiptAndSubmitProof", async () => {
      renderPage();

      const fileInput = screen.getByTestId(
        `input-proof-file-${ORDER_CONFIRMED.purchaseId}`,
      ) as HTMLInputElement;
      fireEvent.change(fileInput, {
        target: { files: [new File(["e"], "p.jpg")] },
      });
      fireEvent.click(
        screen.getByTestId(`btn-submit-proof-${ORDER_CONFIRMED.purchaseId}`),
      );

      await waitFor(() =>
        expect(mockSubmitImpactProof).toHaveBeenCalledWith(
          ORDER_CONFIRMED.purchaseId,
          PROOF_HASH,
        ),
      );
      expect(mockConfirmReceiptAndSubmitProof).not.toHaveBeenCalled();
    });

    it("TC-I06 — exibe alerta de sucesso apos enviar Proof of Impact", async () => {
      renderPage();

      const fileInput = screen.getByTestId(
        `input-proof-file-${ORDER_CONFIRMED.purchaseId}`,
      ) as HTMLInputElement;
      const file = new File(["evidence"], "proof.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [file] } });

      fireEvent.click(
        screen.getByTestId(`btn-submit-proof-${ORDER_CONFIRMED.purchaseId}`),
      );

      await waitFor(() => {
        expect(screen.getByTestId("proof-success")).toBeDefined();
      });
    });
  });

  // ----------------------------------------------------------------
  describe("secao Historico — status Paid e Refunded", () => {
    it("exibe secao de historico quando ha pedidos Paid", () => {
      setupOrders([ORDER_PAID]);
      renderPage();
      expect(screen.getByTestId("section-historico")).toBeDefined();
    });

    it("exibe card de historico para pedido Paid", () => {
      setupOrders([ORDER_PAID]);
      renderPage();
      expect(
        screen.getByTestId(`history-card-${ORDER_PAID.purchaseId}`),
      ).toBeDefined();
    });

    it("exibe card de historico para pedido Refunded", () => {
      setupOrders([ORDER_REFUNDED]);
      renderPage();
      expect(
        screen.getByTestId(`history-card-${ORDER_REFUNDED.purchaseId}`),
      ).toBeDefined();
    });
  });
});
