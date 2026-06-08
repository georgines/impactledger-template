import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTreasury } from "@/hooks/useTreasury";

const {
  mockAvailableBalance,
  mockReservedBalance,
  mockCentralVault,
  mockQueryFilter,
  mockFilters,
  mockGetPurchase,
  mockGetBlock,
} = vi.hoisted(() => ({
  mockAvailableBalance: vi.fn(),
  mockReservedBalance: vi.fn(),
  mockCentralVault: vi.fn(),
  mockQueryFilter: vi.fn(),
  mockFilters: { PaymentReleased: vi.fn().mockReturnValue("filter-payment") },
  mockGetPurchase: vi.fn(),
  mockGetBlock: vi.fn(),
}));

vi.mock("@/services/contractService", () => ({
  getTreasuryContract: vi.fn(() => ({
    availableBalance: mockAvailableBalance,
    reservedBalance: mockReservedBalance,
    centralVault: mockCentralVault,
    queryFilter: mockQueryFilter,
    filters: mockFilters,
  })),
  getPurchaseManagerContract: vi.fn(() => ({
    getPurchase: mockGetPurchase,
  })),
}));

const mockProvider = {
  _isProvider: true,
  getBlock: mockGetBlock,
} as never;

describe("useTreasury", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFilters.PaymentReleased.mockReturnValue("filter-payment");
    mockGetBlock.mockResolvedValue({ timestamp: 1717200000 });
    mockGetPurchase.mockResolvedValue({ institution: "0xinstitution" });
  });

  it("estado inicial tem loading false e error null", () => {
    const { result } = renderHook(() => useTreasury(mockProvider));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  describe("getAvailableBalance", () => {
    it("chama availableBalance com endereço correto", async () => {
      mockAvailableBalance.mockResolvedValue(1000n);

      const { result } = renderHook(() => useTreasury(mockProvider));

      await act(async () => {
        await result.current.getAvailableBalance("0xinstituicao");
      });

      expect(mockAvailableBalance).toHaveBeenCalledWith("0xinstituicao");
    });

    it("retorna valor do contrato", async () => {
      mockAvailableBalance.mockResolvedValue(5000n);

      const { result } = renderHook(() => useTreasury(mockProvider));

      let balance: bigint | undefined;
      await act(async () => {
        balance = await result.current.getAvailableBalance("0xinstituicao");
      });

      expect(balance).toBe(5000n);
    });

    it("define error quando contrato lança exceção", async () => {
      mockAvailableBalance.mockRejectedValueOnce(
        new Error("Contrato não encontrado"),
      );

      const { result } = renderHook(() => useTreasury(mockProvider));

      await act(async () => {
        await result.current.getAvailableBalance("0xinvalido").catch(() => {});
      });

      expect(result.current.error).toBe("Contrato não encontrado");
    });
  });

  describe("getReservedBalance", () => {
    it("chama reservedBalance com endereço correto", async () => {
      mockReservedBalance.mockResolvedValue(200n);

      const { result } = renderHook(() => useTreasury(mockProvider));

      await act(async () => {
        await result.current.getReservedBalance("0xinstituicao");
      });

      expect(mockReservedBalance).toHaveBeenCalledWith("0xinstituicao");
    });

    it("retorna valor do contrato", async () => {
      mockReservedBalance.mockResolvedValue(300n);

      const { result } = renderHook(() => useTreasury(mockProvider));

      let balance: bigint | undefined;
      await act(async () => {
        balance = await result.current.getReservedBalance("0xinstituicao");
      });

      expect(balance).toBe(300n);
    });
  });

  describe("getCentralVault", () => {
    it("chama centralVault sem argumentos", async () => {
      mockCentralVault.mockResolvedValue(9999n);

      const { result } = renderHook(() => useTreasury(mockProvider));

      await act(async () => {
        await result.current.getCentralVault();
      });

      expect(mockCentralVault).toHaveBeenCalled();
    });

    it("retorna valor do cofre central", async () => {
      mockCentralVault.mockResolvedValue(9999n);

      const { result } = renderHook(() => useTreasury(mockProvider));

      let vault: bigint | undefined;
      await act(async () => {
        vault = await result.current.getCentralVault();
      });

      expect(vault).toBe(9999n);
    });
  });

  describe("getPaymentHistory", () => {
    it("filtra eventos PaymentReleased pelo endereço do fornecedor", async () => {
      mockQueryFilter.mockResolvedValue([]);

      const { result } = renderHook(() => useTreasury(mockProvider));

      await act(async () => {
        await result.current.getPaymentHistory("0xfornecedor");
      });

      expect(mockFilters.PaymentReleased).toHaveBeenCalledWith("0xfornecedor");
      expect(mockQueryFilter).toHaveBeenCalledWith("filter-payment");
    });

    it("retorna lista vazia quando não há eventos", async () => {
      mockQueryFilter.mockResolvedValue([]);

      const { result } = renderHook(() => useTreasury(mockProvider));

      let history: unknown;
      await act(async () => {
        history = await result.current.getPaymentHistory("0xfornecedor");
      });

      expect(history).toEqual([]);
    });

    it("mapeia eventos para PaymentEvent com purchaseId, amount, blockNumber, transactionHash, institutionAddress e timestamp", async () => {
      mockQueryFilter.mockResolvedValue([
        {
          args: { purchaseId: 42n, amount: 1000n },
          blockNumber: 99,
          transactionHash: "0xhash",
        },
      ]);

      const { result } = renderHook(() => useTreasury(mockProvider));

      let history: unknown;
      await act(async () => {
        history = await result.current.getPaymentHistory("0xfornecedor");
      });

      expect(history).toEqual([
        {
          purchaseId: 42n,
          amount: 1000n,
          blockNumber: 99,
          transactionHash: "0xhash",
          institutionAddress: "0xinstitution",
          timestamp: 1717200000,
        },
      ]);
    });
  });

  describe("getInstitutionBalances", () => {
    it("retorna available e reserved para cada endereço", async () => {
      mockAvailableBalance
        .mockResolvedValueOnce(100n)
        .mockResolvedValueOnce(200n);
      mockReservedBalance.mockResolvedValueOnce(10n).mockResolvedValueOnce(20n);

      const { result } = renderHook(() => useTreasury(mockProvider));

      let balances: unknown;
      await act(async () => {
        balances = await result.current.getInstitutionBalances(["0xA", "0xB"]);
      });

      expect(balances).toEqual([
        { address: "0xA", available: 100n, reserved: 10n },
        { address: "0xB", available: 200n, reserved: 20n },
      ]);
    });

    it("retorna lista vazia para array vazio", async () => {
      const { result } = renderHook(() => useTreasury(mockProvider));

      let balances: unknown;
      await act(async () => {
        balances = await result.current.getInstitutionBalances([]);
      });

      expect(balances).toEqual([]);
    });
  });

  describe("sem provider", () => {
    it("getAvailableBalance lança erro quando provider é null", async () => {
      const { result } = renderHook(() => useTreasury(null));

      await act(async () => {
        await expect(result.current.getAvailableBalance("0x1")).rejects.toThrow(
          "Provider não disponível",
        );
      });
    });
  });
});
