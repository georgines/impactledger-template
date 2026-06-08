import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchMyDonations,
  fetchAllDonations,
  sumDonationAmounts,
  type DonationRecord,
} from "@/services/donationService";

const { mockQueryFilter, mockFilters } = vi.hoisted(() => ({
  mockQueryFilter: vi.fn(),
  mockFilters: {
    DonationReceived: vi.fn().mockReturnValue("filter-donation"),
  },
}));

vi.mock("@/services/contractService", () => ({
  getTreasuryContract: vi.fn(() => ({
    filters: mockFilters,
    queryFilter: mockQueryFilter,
  })),
}));

const DONOR_A = "0xAAAA000000000000000000000000000000000001";
const INST_A = "0xBBBB000000000000000000000000000000000002";
const INST_B = "0xCCCC000000000000000000000000000000000003";

const mockProvider = { _isProvider: true } as never;

function makeDonationEvent(
  institution: string,
  amount: bigint,
  txHash = "0xtx",
  blockNumber = 10,
) {
  return {
    args: { institution, amount },
    transactionHash: txHash,
    blockNumber,
  };
}

describe("donationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFilters.DonationReceived.mockReturnValue("filter-donation");
  });

  describe("fetchMyDonations", () => {
    it("filtra eventos pelo endereço do doador", async () => {
      mockQueryFilter.mockResolvedValue([]);

      await fetchMyDonations(DONOR_A, mockProvider);

      expect(mockFilters.DonationReceived).toHaveBeenCalledWith(DONOR_A);
      expect(mockQueryFilter).toHaveBeenCalledWith("filter-donation");
    });

    it("retorna lista vazia quando não há eventos", async () => {
      mockQueryFilter.mockResolvedValue([]);

      const result = await fetchMyDonations(DONOR_A, mockProvider);

      expect(result).toEqual([]);
    });

    it("mapeia eventos para DonationRecord", async () => {
      mockQueryFilter.mockResolvedValue([
        makeDonationEvent(INST_A, 500n, "0xhash1", 42),
      ]);

      const result = await fetchMyDonations(DONOR_A, mockProvider);

      expect(result).toEqual([
        {
          institution: INST_A,
          amount: 500n,
          txHash: "0xhash1",
          blockNumber: 42,
        },
      ]);
    });
  });

  describe("fetchAllDonations", () => {
    it("busca todos os eventos DonationReceived sem filtro de doador", async () => {
      mockQueryFilter.mockResolvedValue([]);

      await fetchAllDonations(mockProvider);

      expect(mockFilters.DonationReceived).toHaveBeenCalledWith();
      expect(mockQueryFilter).toHaveBeenCalledWith("filter-donation");
    });

    it("retorna lista vazia quando não há eventos", async () => {
      mockQueryFilter.mockResolvedValue([]);

      const result = await fetchAllDonations(mockProvider);

      expect(result).toEqual([]);
    });

    it("mapeia múltiplos eventos de doadores diferentes", async () => {
      mockQueryFilter.mockResolvedValue([
        makeDonationEvent(INST_A, 1000n, "0xtx1", 10),
        makeDonationEvent(INST_B, 2000n, "0xtx2", 11),
      ]);

      const result = await fetchAllDonations(mockProvider);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        institution: INST_A,
        amount: 1000n,
        txHash: "0xtx1",
        blockNumber: 10,
      });
      expect(result[1]).toEqual({
        institution: INST_B,
        amount: 2000n,
        txHash: "0xtx2",
        blockNumber: 11,
      });
    });
  });

  describe("sumDonationAmounts", () => {
    it("retorna zero para lista vazia", () => {
      expect(sumDonationAmounts([])).toBe(BigInt(0));
    });

    it("soma os amounts de uma única doação", () => {
      const donations: DonationRecord[] = [
        { institution: INST_A, amount: 500n, txHash: "0x1", blockNumber: 1 },
      ];
      expect(sumDonationAmounts(donations)).toBe(500n);
    });

    it("soma os amounts de múltiplas doações", () => {
      const donations: DonationRecord[] = [
        { institution: INST_A, amount: 1000n, txHash: "0x1", blockNumber: 1 },
        { institution: INST_B, amount: 2500n, txHash: "0x2", blockNumber: 2 },
        { institution: INST_A, amount: 500n, txHash: "0x3", blockNumber: 3 },
      ];
      expect(sumDonationAmounts(donations)).toBe(4000n);
    });
  });
});
