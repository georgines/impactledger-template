import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { PurchaseStatus } from "@/services/purchaseService";

const { mockFetchPurchasesByInstitution } = vi.hoisted(() => ({
  mockFetchPurchasesByInstitution: vi.fn(),
}));

vi.mock("@/services/purchaseService", () => ({
  fetchPurchasesByInstitution: mockFetchPurchasesByInstitution,
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
const INSTITUTION = "0xAAAA000000000000000000000000000000000001";

const ORDER_OPEN = {
  purchaseId: 1n,
  institution: INSTITUTION,
  supplier: "0xBBBB000000000000000000000000000000000002",
  amount: 500n,
  deliveryDeadline: 9999999999n,
  descriptionHash: "0xhash",
  status: PurchaseStatus.Open,
  impactProofHash:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  confirmDeadline: 0n,
  disputeDeadline: 0n,
  supplierVoteWeight: 0n,
  institutionVoteWeight: 0n,
};

describe("usePurchaseOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("estado inicial tem loading true e orders vazio quando provider e address presentes", async () => {
    mockFetchPurchasesByInstitution.mockResolvedValue([]);
    const { result } = renderHook(() =>
      usePurchaseOrders(mockProvider, INSTITUTION),
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.orders).toEqual([]);
    await act(async () => {});
  });

  it("retorna orders apos carregar com sucesso", async () => {
    mockFetchPurchasesByInstitution.mockResolvedValue([ORDER_OPEN]);
    const { result } = renderHook(() =>
      usePurchaseOrders(mockProvider, INSTITUTION),
    );
    await act(async () => {});
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.orders[0].purchaseId).toBe(1n);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("define error quando fetchPurchasesByInstitution lanca excecao", async () => {
    mockFetchPurchasesByInstitution.mockRejectedValue(
      new Error("Erro de rede"),
    );
    const { result } = renderHook(() =>
      usePurchaseOrders(mockProvider, INSTITUTION),
    );
    await act(async () => {});
    expect(result.current.error).toBe("Erro de rede");
    expect(result.current.loading).toBe(false);
    expect(result.current.orders).toEqual([]);
  });

  it("nao busca e loading fica false quando provider e null", () => {
    const { result } = renderHook(() => usePurchaseOrders(null, INSTITUTION));
    expect(mockFetchPurchasesByInstitution).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("nao busca e loading fica false quando institutionAddress e null", () => {
    const { result } = renderHook(() => usePurchaseOrders(mockProvider, null));
    expect(mockFetchPurchasesByInstitution).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("chama fetchPurchasesByInstitution com provider e endereco corretos", async () => {
    mockFetchPurchasesByInstitution.mockResolvedValue([]);
    renderHook(() => usePurchaseOrders(mockProvider, INSTITUTION));
    await act(async () => {});
    expect(mockFetchPurchasesByInstitution).toHaveBeenCalledWith(
      mockProvider,
      INSTITUTION,
    );
  });

  it("refetch dispara nova busca e atualiza orders", async () => {
    mockFetchPurchasesByInstitution.mockResolvedValue([ORDER_OPEN]);
    const { result } = renderHook(() =>
      usePurchaseOrders(mockProvider, INSTITUTION),
    );
    await act(async () => {});

    mockFetchPurchasesByInstitution.mockResolvedValue([
      ORDER_OPEN,
      { ...ORDER_OPEN, purchaseId: 2n },
    ]);
    await act(async () => {
      result.current.refetch();
    });
    await act(async () => {});

    expect(mockFetchPurchasesByInstitution).toHaveBeenCalledTimes(2);
    expect(result.current.orders).toHaveLength(2);
  });
});
