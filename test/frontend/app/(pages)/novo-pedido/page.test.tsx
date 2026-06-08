import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@test/utils/render";
import NovoPedidoPage from "@/app/(pages)/novo-pedido/page";

// ----- hoisted mocks -----
const {
  mockUseWallet,
  mockUseWalletContext,
  mockUseSuppliers,
  mockCreateOrder,
  mockGetAvailableBalance,
  mockUploadAsBytes32,
} = vi.hoisted(() => ({
  mockUseWallet: vi.fn(),
  mockUseWalletContext: vi.fn(),
  mockUseSuppliers: vi.fn(),
  mockCreateOrder: vi.fn(),
  mockGetAvailableBalance: vi.fn(),
  mockUploadAsBytes32: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({ useWallet: mockUseWallet }));
vi.mock("@/components/providers/WalletProvider", () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => children,
  useWalletContext: mockUseWalletContext,
}));
vi.mock("@/hooks/useSuppliers", () => ({ useSuppliers: mockUseSuppliers }));
vi.mock("@/hooks/usePurchaseManager", () => ({
  usePurchaseManager: vi.fn(() => ({
    createOrder: mockCreateOrder,
    loading: false,
    error: null,
  })),
}));
vi.mock("@/hooks/useTreasury", () => ({
  useTreasury: vi.fn(() => ({
    getAvailableBalance: mockGetAvailableBalance,
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
vi.mock("@/hooks/useInstitutions", () => ({
  useInstitutions: vi.fn(() => ({
    institutions: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

// ----- fixtures -----
const SUPPLIER_A = {
  address: "0xAAAA000000000000000000000000000000000001",
  name: "Distribuidora Alpha",
  serviceType: "Alimentos",
  approved: true,
};

const SUPPLIER_B = {
  address: "0xBBBB000000000000000000000000000000000002",
  name: "Transportes Beta",
  serviceType: "Transporte",
  approved: true,
};

const SUPPLIER_REVOKED = {
  address: "0xCCCC000000000000000000000000000000000003",
  name: "Revogado SA",
  serviceType: "Alimentos",
  approved: false,
};

const INSTITUTION_ADDRESS = "0xINST000000000000000000000000000000000000";
const ONE_ETH = 1_000_000_000_000_000_000n;

// ----- helpers -----
function setupWallet(connected = true) {
  const walletValue = {
    provider: connected ? { _isProvider: true } : null,
    signer: connected ? { _isSigner: true } : null,
    address: connected ? INSTITUTION_ADDRESS : null,
    role: connected ? "instituicao" : null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  mockUseWallet.mockReturnValue(walletValue);
  mockUseWalletContext.mockReturnValue(walletValue);
}

function setupSuppliers(suppliers = [SUPPLIER_A]) {
  mockUseSuppliers.mockReturnValue({
    suppliers,
    loading: false,
    error: null,
  });
}

function setupBalances(available = ONE_ETH) {
  mockGetAvailableBalance.mockResolvedValue(available);
}

async function renderPage() {
  await act(async () => {
    render(<NovoPedidoPage />);
  });
}

// ----- testes -----
describe("NovoPedidoPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateOrder.mockResolvedValue(undefined);
    mockUploadAsBytes32.mockResolvedValue("0x" + "ab".repeat(32));
    setupWallet();
    setupSuppliers();
    setupBalances();
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it("renderiza sem erros", async () => {
    await renderPage();
  });

  // ----------------------------------------------------------------
  describe("controle de acesso — TC-W02", () => {
    it("TC-W02 — sem carteira exibe aviso de conexao", async () => {
      setupWallet(false);
      await renderPage();
      expect(screen.getByText(/conecte sua carteira/i)).toBeDefined();
    });

    it("TC-W02 — sem carteira nao renderiza cards de fornecedores", async () => {
      setupWallet(false);
      await renderPage();
      expect(
        screen.queryByTestId(`supplier-card-${SUPPLIER_A.address}`),
      ).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  describe("galeria de fornecedores", () => {
    it("exibe card para cada fornecedor aprovado", async () => {
      setupSuppliers([SUPPLIER_A, SUPPLIER_B]);
      await renderPage();
      expect(
        screen.getByTestId(`supplier-card-${SUPPLIER_A.address}`),
      ).toBeDefined();
      expect(
        screen.getByTestId(`supplier-card-${SUPPLIER_B.address}`),
      ).toBeDefined();
    });

    it("nao exibe fornecedores nao aprovados", async () => {
      setupSuppliers([SUPPLIER_A, SUPPLIER_REVOKED]);
      await renderPage();
      expect(
        screen.queryByTestId(`supplier-card-${SUPPLIER_REVOKED.address}`),
      ).toBeNull();
    });

    it("exibe mensagem quando nao ha fornecedores aprovados", async () => {
      setupSuppliers([]);
      await renderPage();
      expect(screen.getByTestId("empty-suppliers")).toBeDefined();
    });

    it("exibe mensagem quando todos os fornecedores estao revogados", async () => {
      setupSuppliers([SUPPLIER_REVOKED]);
      await renderPage();
      expect(screen.getByTestId("empty-suppliers")).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("filtro de busca", () => {
    it("exibe input de busca", async () => {
      await renderPage();
      expect(screen.getByTestId("search-input")).toBeDefined();
    });

    it("filtra fornecedores por nome", async () => {
      setupSuppliers([SUPPLIER_A, SUPPLIER_B]);
      await renderPage();
      fireEvent.change(screen.getByTestId("search-input"), {
        target: { value: "Alpha" },
      });
      expect(
        screen.getByTestId(`supplier-card-${SUPPLIER_A.address}`),
      ).toBeDefined();
      expect(
        screen.queryByTestId(`supplier-card-${SUPPLIER_B.address}`),
      ).toBeNull();
    });

    it("filtra fornecedores por tipo de servico", async () => {
      setupSuppliers([SUPPLIER_A, SUPPLIER_B]);
      await renderPage();
      fireEvent.change(screen.getByTestId("search-input"), {
        target: { value: "Transporte" },
      });
      expect(
        screen.queryByTestId(`supplier-card-${SUPPLIER_A.address}`),
      ).toBeNull();
      expect(
        screen.getByTestId(`supplier-card-${SUPPLIER_B.address}`),
      ).toBeDefined();
    });

    it("busca e case-insensitive", async () => {
      setupSuppliers([SUPPLIER_A]);
      await renderPage();
      fireEvent.change(screen.getByTestId("search-input"), {
        target: { value: "alpha" },
      });
      expect(
        screen.getByTestId(`supplier-card-${SUPPLIER_A.address}`),
      ).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("modal de novo pedido", () => {
    it("modal nao esta visivel inicialmente", async () => {
      await renderPage();
      expect(screen.queryByTestId("modal-novo-pedido")).toBeNull();
    });

    it("abre modal ao clicar no card do fornecedor", async () => {
      await renderPage();
      fireEvent.click(
        screen.getByTestId(`supplier-card-${SUPPLIER_A.address}`),
      );
      await waitFor(() => {
        expect(screen.getByTestId("modal-novo-pedido")).toBeDefined();
      });
    });

    it("modal exibe nome do fornecedor selecionado", async () => {
      await renderPage();
      fireEvent.click(
        screen.getByTestId(`supplier-card-${SUPPLIER_A.address}`),
      );
      await waitFor(() => {
        expect(screen.getByText(SUPPLIER_A.name)).toBeDefined();
      });
    });

    it("modal exibe saldo disponivel", async () => {
      await renderPage();
      fireEvent.click(
        screen.getByTestId(`supplier-card-${SUPPLIER_A.address}`),
      );
      await waitFor(() => {
        expect(screen.getByTestId("balance-alert")).toBeDefined();
      });
    });

    it("modal exibe campos de titulo, descricao, valor e prazo", async () => {
      await renderPage();
      fireEvent.click(
        screen.getByTestId(`supplier-card-${SUPPLIER_A.address}`),
      );
      await waitFor(() => {
        expect(screen.getByTestId("input-title")).toBeDefined();
        expect(screen.getByTestId("input-description")).toBeDefined();
        expect(screen.getByTestId("input-amount")).toBeDefined();
        expect(screen.getByTestId("input-deadline")).toBeDefined();
      });
    });

    it("botao criar pedido desabilitado quando titulo esta vazio", async () => {
      await renderPage();
      fireEvent.click(
        screen.getByTestId(`supplier-card-${SUPPLIER_A.address}`),
      );
      await waitFor(() =>
        expect(screen.getByTestId("input-description")).toBeDefined(),
      );
      fireEvent.change(screen.getByTestId("input-description"), {
        target: { value: "Produto qualquer" },
      });
      fireEvent.change(screen.getByTestId("input-amount"), {
        target: { value: "0.5" },
      });
      fireEvent.change(screen.getByTestId("input-deadline"), {
        target: { value: "7" },
      });
      const btn = screen.getByTestId("btn-criar-pedido") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("botao criar pedido desabilitado com formulario vazio", async () => {
      await renderPage();
      fireEvent.click(
        screen.getByTestId(`supplier-card-${SUPPLIER_A.address}`),
      );
      await waitFor(() => {
        const btn = screen.getByTestId("btn-criar-pedido") as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
      });
    });
  });

  // ----------------------------------------------------------------
  describe("TC-I01 — criar pedido com sucesso", () => {
    it("TC-I01 — exibe confirmacao apos criar pedido com dados validos", async () => {
      await renderPage();
      fireEvent.click(
        screen.getByTestId(`supplier-card-${SUPPLIER_A.address}`),
      );

      await waitFor(() =>
        expect(screen.getByTestId("input-title")).toBeDefined(),
      );

      fireEvent.change(screen.getByTestId("input-title"), {
        target: { value: "Cestas básicas" },
      });
      fireEvent.change(screen.getByTestId("input-description"), {
        target: { value: "Cesta basica para 100 familias" },
      });
      fireEvent.change(screen.getByTestId("input-amount"), {
        target: { value: "0.5" },
      });
      fireEvent.change(screen.getByTestId("input-deadline"), {
        target: { value: "30" },
      });
      fireEvent.click(screen.getByTestId("btn-criar-pedido"));

      await waitFor(() => {
        expect(screen.getByTestId("order-success")).toBeDefined();
      });
      expect(mockUploadAsBytes32).toHaveBeenCalledOnce();
      expect(mockCreateOrder).toHaveBeenCalledOnce();
    });

    it("TC-I01 — createOrder recebe hash bytes32 do IPFS como descriptionHash", async () => {
      const FAKE_HASH = "0x" + "ab".repeat(32);
      mockUploadAsBytes32.mockResolvedValueOnce(FAKE_HASH);

      await renderPage();
      fireEvent.click(
        screen.getByTestId(`supplier-card-${SUPPLIER_A.address}`),
      );

      await waitFor(() =>
        expect(screen.getByTestId("input-title")).toBeDefined(),
      );

      fireEvent.change(screen.getByTestId("input-title"), {
        target: { value: "Cestas básicas" },
      });
      fireEvent.change(screen.getByTestId("input-description"), {
        target: { value: "100 cestas" },
      });
      fireEvent.change(screen.getByTestId("input-amount"), {
        target: { value: "0.5" },
      });
      fireEvent.change(screen.getByTestId("input-deadline"), {
        target: { value: "30" },
      });
      fireEvent.click(screen.getByTestId("btn-criar-pedido"));

      await waitFor(() => expect(mockCreateOrder).toHaveBeenCalledOnce());
      expect(mockCreateOrder).toHaveBeenCalledWith(
        SUPPLIER_A.address,
        expect.any(BigInt),
        expect.any(BigInt),
        FAKE_HASH,
      );
    });
  });

  // ----------------------------------------------------------------
  describe("TC-I03 — saldo insuficiente", () => {
    it("TC-I03 — botao criar desabilitado quando valor excede saldo disponivel", async () => {
      setupBalances(BigInt(0)); // saldo disponivel = 0
      await renderPage();
      fireEvent.click(
        screen.getByTestId(`supplier-card-${SUPPLIER_A.address}`),
      );

      await waitFor(() =>
        expect(screen.getByTestId("input-title")).toBeDefined(),
      );

      fireEvent.change(screen.getByTestId("input-title"), {
        target: { value: "Produto" },
      });
      fireEvent.change(screen.getByTestId("input-description"), {
        target: { value: "Produto qualquer" },
      });
      fireEvent.change(screen.getByTestId("input-amount"), {
        target: { value: "0.5" },
      });
      fireEvent.change(screen.getByTestId("input-deadline"), {
        target: { value: "7" },
      });

      const btn = screen.getByTestId("btn-criar-pedido") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  describe("TC-I02 / TC-I04 — erros do contrato", () => {
    it("TC-I02 — exibe erro quando contrato rejeita fornecedor nao aprovado", async () => {
      mockCreateOrder.mockRejectedValueOnce(
        new Error("SupplierRegistry__NotWhitelisted"),
      );
      await renderPage();
      fireEvent.click(
        screen.getByTestId(`supplier-card-${SUPPLIER_A.address}`),
      );

      await waitFor(() =>
        expect(screen.getByTestId("input-title")).toBeDefined(),
      );

      fireEvent.change(screen.getByTestId("input-title"), {
        target: { value: "Produto" },
      });
      fireEvent.change(screen.getByTestId("input-description"), {
        target: { value: "Produto qualquer" },
      });
      fireEvent.change(screen.getByTestId("input-amount"), {
        target: { value: "0.5" },
      });
      fireEvent.change(screen.getByTestId("input-deadline"), {
        target: { value: "7" },
      });
      fireEvent.click(screen.getByTestId("btn-criar-pedido"));

      await waitFor(() => {
        expect(screen.getByTestId("order-error")).toBeDefined();
      });
    });

    it("TC-I04 — exibe erro quando instituicao esta pausada", async () => {
      mockCreateOrder.mockRejectedValueOnce(new Error("InstitutionNotActive"));
      await renderPage();
      fireEvent.click(
        screen.getByTestId(`supplier-card-${SUPPLIER_A.address}`),
      );

      await waitFor(() =>
        expect(screen.getByTestId("input-title")).toBeDefined(),
      );

      fireEvent.change(screen.getByTestId("input-title"), {
        target: { value: "Produto" },
      });
      fireEvent.change(screen.getByTestId("input-description"), {
        target: { value: "Produto qualquer" },
      });
      fireEvent.change(screen.getByTestId("input-amount"), {
        target: { value: "0.5" },
      });
      fireEvent.change(screen.getByTestId("input-deadline"), {
        target: { value: "7" },
      });
      fireEvent.click(screen.getByTestId("btn-criar-pedido"));

      await waitFor(() => {
        expect(screen.getByTestId("order-error")).toBeDefined();
      });
    });
  });
});
