import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDisputeOrders } from "@/hooks/useDisputeOrders";
import { PurchaseStatus } from "@/services/purchaseService";

const { mockFetchDisputedPurchases } = vi.hoisted(() => ({
  mockFetchDisputedPurchases: vi.fn(),
}));

vi.mock("@/services/purchaseService", () => ({
  fetchDisputedPurchases: mockFetchDisputedPurchases,
  PurchaseStatus: {
    Open: 0,
    Delivered: 1,
    Confirmed: 2,
    Disputed: 3,
    Paid: 4,
    Refunded: 5,
  },
}));

const mockProvider = { _isProvider: true } as never;

const ORDER_DISPUTED = {
  purchaseId: 1n,
  institution: "0xINST000000000000000000000000000000000000",
  supplier: "0xAAAA000000000000000000000000000000000001",
  amount: 500n,
  deliveryDeadline: 1n,
  descriptionHash: "0xhash",
  status: PurchaseStatus.Disputed,
  impactProofHash:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  confirmDeadline: 0n,
  disputeDeadline: 9999999999n,
  supplierVoteWeight: 0n,
  institutionVoteWeight: 0n,
};

describe("useDisputeOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("estado inicial tem loading true quando provider presente", async () => {
    mockFetchDisputedPurchases.mockResolvedValue([]);
    const { result } = renderHook(() => useDisputeOrders(mockProvider));
    expect(result.current.loading).toBe(true);
    expect(result.current.orders).toEqual([]);
    await act(async () => {});
  });

  it("retorna disputas ativas apos carregar com sucesso", async () => {
    mockFetchDisputedPurchases.mockResolvedValue([ORDER_DISPUTED]);
    const { result } = renderHook(() => useDisputeOrders(mockProvider));
    await act(async () => {});
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.orders[0].purchaseId).toBe(1n);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("define error quando fetchDisputedPurchases lanca excecao", async () => {
    mockFetchDisputedPurchases.mockRejectedValue(new Error("Erro de rede"));
    const { result } = renderHook(() => useDisputeOrders(mockProvider));
    await act(async () => {});
    expect(result.current.error).toBe("Erro de rede");
    expect(result.current.loading).toBe(false);
    expect(result.current.orders).toEqual([]);
  });

  it("nao busca quando provider e null", () => {
    const { result } = renderHook(() => useDisputeOrders(null));
    expect(mockFetchDisputedPurchases).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("chama fetchDisputedPurchases apenas com provider", async () => {
    mockFetchDisputedPurchases.mockResolvedValue([]);
    renderHook(() => useDisputeOrders(mockProvider));
    await act(async () => {});
    expect(mockFetchDisputedPurchases).toHaveBeenCalledWith(mockProvider);
  });

  it("refetch dispara nova busca e atualiza orders", async () => {
    mockFetchDisputedPurchases.mockResolvedValue([ORDER_DISPUTED]);
    const { result } = renderHook(() => useDisputeOrders(mockProvider));
    await act(async () => {});

    mockFetchDisputedPurchases.mockResolvedValue([
      ORDER_DISPUTED,
      { ...ORDER_DISPUTED, purchaseId: 2n },
    ]);
    await act(async () => {
      result.current.refetch();
    });
    await act(async () => {});

    expect(mockFetchDisputedPurchases).toHaveBeenCalledTimes(2);
    expect(result.current.orders).toHaveLength(2);
  });
});
