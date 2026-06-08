import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@test/utils/render";
import SaldoPage from "@/app/(pages)/saldo/page";

const {
  mockUseWallet,
  mockGetAvailableBalance,
  mockGetReservedBalance,
  mockGetCentralVault,
  mockGetPaymentHistory,
  mockGetInstitutionBalances,
  mockUseInstitutions,
  mockUsePlatformStats,
} = vi.hoisted(() => ({
  mockUseWallet: vi.fn(),
  mockGetAvailableBalance: vi.fn(),
  mockGetReservedBalance: vi.fn(),
  mockGetCentralVault: vi.fn(),
  mockGetPaymentHistory: vi.fn(),
  mockGetInstitutionBalances: vi.fn(),
  mockUseInstitutions: vi.fn(),
  mockUsePlatformStats: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({ useWallet: mockUseWallet }));
vi.mock("@/hooks/useTreasury", () => ({
  useTreasury: vi.fn(() => ({
    getAvailableBalance: mockGetAvailableBalance,
    getReservedBalance: mockGetReservedBalance,
    getCentralVault: mockGetCentralVault,
    getPaymentHistory: mockGetPaymentHistory,
    getInstitutionBalances: mockGetInstitutionBalances,
    loading: false,
    error: null,
  })),
}));
vi.mock("@/hooks/useInstitutions", () => ({
  useInstitutions: mockUseInstitutions,
}));
vi.mock("@/hooks/usePlatformStats", () => ({
  usePlatformStats: mockUsePlatformStats,
}));

const INST_ADDRESS = "0xINST000000000000000000000000000000000001";
const SUPPLIER_ADDRESS = "0xSUPP000000000000000000000000000000000002";
const OPERATOR_ADDRESS = "0xOPER000000000000000000000000000000000003";
const ONE_ETH = 1_000_000_000_000_000_000n;

const INSTITUTION_A = {
  address: INST_ADDRESS,
  name: "ONG Esperança",
  areaOfWork: "Saúde",
  status: 1,
};

const INSTITUTION_B = {
  address: "0xOTHER000000000000000000000000000000000004",
  name: "Fundação Solar",
  areaOfWork: "Educação",
  status: 1,
};

function setupWallet(
  role: "instituicao" | "fornecedor" | "operador",
  address: string,
) {
  mockUseWallet.mockReturnValue({
    provider: { _isProvider: true },
    signer: { _isSigner: true },
    address,
    role,
  });
}

describe("SaldoPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInstitutions.mockReturnValue({
      institutions: [],
      loading: false,
      error: null,
    });
    mockUsePlatformStats.mockReturnValue({
      totalHistoricalDonations: ONE_ETH * 10n,
      loading: false,
      error: null,
    });
    mockGetAvailableBalance.mockResolvedValue(ONE_ETH);
    mockGetReservedBalance.mockResolvedValue(ONE_ETH / 2n);
    mockGetCentralVault.mockResolvedValue(ONE_ETH * 5n);
    mockGetPaymentHistory.mockResolvedValue([]);
    mockGetInstitutionBalances.mockResolvedValue([]);
  });

  describe("sem carteira conectada", () => {
    it("exibe alerta de conexão", () => {
      mockUseWallet.mockReturnValue({
        provider: null,
        signer: null,
        address: null,
        role: null,
      });
      render(<SaldoPage />);
      expect(screen.getByText(/conecte sua carteira/i)).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("papel: instituicao", () => {
    beforeEach(() => setupWallet("instituicao", INST_ADDRESS));

    it("exibe card de saldo disponivel", async () => {
      render(<SaldoPage />);
      await waitFor(() =>
        expect(screen.getByTestId("saldo-disponivel")).toBeDefined(),
      );
    });

    it("exibe card de saldo bloqueado", async () => {
      render(<SaldoPage />);
      await waitFor(() =>
        expect(screen.getByTestId("saldo-bloqueado")).toBeDefined(),
      );
    });

    it("busca saldo disponivel com endereço da carteira", async () => {
      render(<SaldoPage />);
      await waitFor(() =>
        expect(mockGetAvailableBalance).toHaveBeenCalledWith(INST_ADDRESS),
      );
    });

    it("busca saldo bloqueado com endereço da carteira", async () => {
      render(<SaldoPage />);
      await waitFor(() =>
        expect(mockGetReservedBalance).toHaveBeenCalledWith(INST_ADDRESS),
      );
    });

    it("não exibe histórico de recebimentos nem cofre central", async () => {
      render(<SaldoPage />);
      expect(screen.queryByTestId("historico-recebimentos")).toBeNull();
      expect(screen.queryByTestId("cofre-central")).toBeNull();
      await act(async () => {});
    });
  });

  // ----------------------------------------------------------------
  describe("papel: fornecedor", () => {
    beforeEach(() => setupWallet("fornecedor", SUPPLIER_ADDRESS));

    it("exibe seção de histórico de recebimentos", async () => {
      render(<SaldoPage />);
      expect(screen.getByTestId("historico-recebimentos")).toBeDefined();
      await act(async () => {});
    });

    it("busca histórico com endereço do fornecedor", async () => {
      render(<SaldoPage />);
      await waitFor(() =>
        expect(mockGetPaymentHistory).toHaveBeenCalledWith(SUPPLIER_ADDRESS),
      );
    });

    it("exibe mensagem quando histórico está vazio", async () => {
      mockGetPaymentHistory.mockResolvedValue([]);
      render(<SaldoPage />);
      await waitFor(() =>
        expect(screen.getByTestId("historico-vazio")).toBeDefined(),
      );
    });

    it("exibe linha de pagamento quando histórico tem entradas", async () => {
      mockGetPaymentHistory.mockResolvedValue([
        {
          purchaseId: 1n,
          amount: ONE_ETH,
          blockNumber: 100,
          transactionHash: "0xabc",
          institutionAddress: INST_ADDRESS,
          timestamp: 1717200000,
        },
      ]);
      render(<SaldoPage />);
      await waitFor(() =>
        expect(screen.getByTestId("payment-row-1")).toBeDefined(),
      );
    });

    it("não exibe saldo disponivel nem cofre central", async () => {
      render(<SaldoPage />);
      expect(screen.queryByTestId("saldo-disponivel")).toBeNull();
      expect(screen.queryByTestId("cofre-central")).toBeNull();
      await act(async () => {});
    });
  });

  // ----------------------------------------------------------------
  describe("papel: operador", () => {
    beforeEach(() => {
      setupWallet("operador", OPERATOR_ADDRESS);
      mockUseInstitutions.mockReturnValue({
        institutions: [INSTITUTION_A],
        loading: false,
        error: null,
      });
      mockGetCentralVault.mockResolvedValue(ONE_ETH * 5n);
      mockGetInstitutionBalances.mockResolvedValue([
        { address: INST_ADDRESS, available: ONE_ETH, reserved: ONE_ETH / 2n },
      ]);
    });

    it("exibe card do cofre central", async () => {
      render(<SaldoPage />);
      await waitFor(() =>
        expect(screen.getByTestId("cofre-central")).toBeDefined(),
      );
    });

    it("busca valor do cofre central", async () => {
      render(<SaldoPage />);
      await waitFor(() => expect(mockGetCentralVault).toHaveBeenCalled());
    });

    it("exibe input de busca de instituição", async () => {
      render(<SaldoPage />);
      expect(screen.getByTestId("search-input")).toBeDefined();
      await act(async () => {});
    });

    it("exibe linha da instituição na lista", async () => {
      render(<SaldoPage />);
      await waitFor(() =>
        expect(
          screen.getByTestId(`institution-row-${INST_ADDRESS}`),
        ).toBeDefined(),
      );
    });

    it("filtra instituições por nome", async () => {
      mockUseInstitutions.mockReturnValue({
        institutions: [INSTITUTION_A, INSTITUTION_B],
        loading: false,
        error: null,
      });
      mockGetInstitutionBalances.mockResolvedValue([
        { address: INST_ADDRESS, available: ONE_ETH, reserved: 0n },
        {
          address: INSTITUTION_B.address,
          available: ONE_ETH * 2n,
          reserved: 0n,
        },
      ]);

      render(<SaldoPage />);

      await waitFor(() =>
        expect(
          screen.getByTestId(`institution-row-${INST_ADDRESS}`),
        ).toBeDefined(),
      );

      fireEvent.change(screen.getByTestId("search-input"), {
        target: { value: "Solar" },
      });

      expect(
        screen.queryByTestId(`institution-row-${INST_ADDRESS}`),
      ).toBeNull();
      expect(
        screen.getByTestId(`institution-row-${INSTITUTION_B.address}`),
      ).toBeDefined();
    });

    it("exibe card de total histórico de doações", async () => {
      render(<SaldoPage />);
      await waitFor(() =>
        expect(screen.getByTestId("total-historico")).toBeDefined(),
      );
    });

    it("exibe card de total atualmente em caixa", async () => {
      render(<SaldoPage />);
      await waitFor(() =>
        expect(screen.getByTestId("total-em-caixa")).toBeDefined(),
      );
    });

    it("não exibe saldo disponivel nem histórico de recebimentos", async () => {
      render(<SaldoPage />);
      expect(screen.queryByTestId("saldo-disponivel")).toBeNull();
      expect(screen.queryByTestId("historico-recebimentos")).toBeNull();
      await act(async () => {});
    });
  });
});
