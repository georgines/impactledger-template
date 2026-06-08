import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePlatformStats } from "@/hooks/usePlatformStats";

const { mockFetchAllDonations, mockSumDonationAmounts } = vi.hoisted(() => ({
  mockFetchAllDonations: vi.fn(),
  mockSumDonationAmounts: vi.fn(),
}));

vi.mock("@/services/donationService", () => ({
  fetchAllDonations: mockFetchAllDonations,
  sumDonationAmounts: mockSumDonationAmounts,
}));

const ONE_ETH = 1_000_000_000_000_000_000n;
const mockProvider = { _isProvider: true } as never;

describe("usePlatformStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAllDonations.mockResolvedValue([]);
    mockSumDonationAmounts.mockReturnValue(BigInt(0));
  });

  it("estado inicial tem loading true e totalHistoricalDonations null", () => {
    mockFetchAllDonations.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePlatformStats(mockProvider));

    expect(result.current.loading).toBe(true);
    expect(result.current.totalHistoricalDonations).toBeNull();
  });

  it("não carrega quando provider é null", () => {
    const { result } = renderHook(() => usePlatformStats(null));

    expect(mockFetchAllDonations).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("chama fetchAllDonations com o provider", async () => {
    mockFetchAllDonations.mockResolvedValue([]);

    renderHook(() => usePlatformStats(mockProvider));

    await waitFor(() =>
      expect(mockFetchAllDonations).toHaveBeenCalledWith(mockProvider),
    );
  });

  it("define totalHistoricalDonations após carregar", async () => {
    const donations = [{ amount: ONE_ETH }, { amount: ONE_ETH * 2n }];
    mockFetchAllDonations.mockResolvedValue(donations);
    mockSumDonationAmounts.mockReturnValue(ONE_ETH * 3n);

    const { result } = renderHook(() => usePlatformStats(mockProvider));

    await waitFor(() =>
      expect(result.current.totalHistoricalDonations).toBe(ONE_ETH * 3n),
    );
    expect(mockSumDonationAmounts).toHaveBeenCalledWith(donations);
  });

  it("loading fica false após carregar", async () => {
    mockFetchAllDonations.mockResolvedValue([]);
    mockSumDonationAmounts.mockReturnValue(BigInt(0));

    const { result } = renderHook(() => usePlatformStats(mockProvider));

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("define error quando fetchAllDonations lança exceção", async () => {
    mockFetchAllDonations.mockRejectedValue(
      new Error("Falha ao buscar doações"),
    );

    const { result } = renderHook(() => usePlatformStats(mockProvider));

    await waitFor(() =>
      expect(result.current.error).toBe("Falha ao buscar doações"),
    );
  });
});
