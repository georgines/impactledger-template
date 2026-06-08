import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSupplierOrders } from "@/hooks/useSupplierOrders";
import { PurchaseStatus } from "@/services/purchaseService";

const { mockFetchPurchasesBySupplier } = vi.hoisted(() => ({
  mockFetchPurchasesBySupplier: vi.fn(),
}));

vi.mock("@/services/purchaseService", () => ({
  fetchPurchasesBySupplier: mockFetchPurchasesBySupplier,
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
const SUPPLIER = "0xAAAA000000000000000000000000000000000001";

const ORDER_OPEN = {
  purchaseId: 1n,
  institution: "0xINST000000000000000000000000000000000000",
  supplier: SUPPLIER,
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

describe("useSupplierOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("estado inicial tem loading true e orders vazio quando provider e address presentes", async () => {
    mockFetchPurchasesBySupplier.mockResolvedValue([]);
    const { result } = renderHook(() =>
      useSupplierOrders(mockProvider, SUPPLIER),
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.orders).toEqual([]);
    await act(async () => {});
  });

  it("retorna orders apos carregar com sucesso", async () => {
    mockFetchPurchasesBySupplier.mockResolvedValue([ORDER_OPEN]);
    const { result } = renderHook(() =>
      useSupplierOrders(mockProvider, SUPPLIER),
    );
    await act(async () => {});
    expect(result.current.orders).toHaveLength(1);
    expect(result.current.orders[0].purchaseId).toBe(1n);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("define error quando fetchPurchasesBySupplier lanca excecao", async () => {
    mockFetchPurchasesBySupplier.mockRejectedValue(new Error("Erro de rede"));
    const { result } = renderHook(() =>
      useSupplierOrders(mockProvider, SUPPLIER),
    );
    await act(async () => {});
    expect(result.current.error).toBe("Erro de rede");
    expect(result.current.loading).toBe(false);
    expect(result.current.orders).toEqual([]);
  });

  it("nao busca quando provider e null", () => {
    const { result } = renderHook(() => useSupplierOrders(null, SUPPLIER));
    expect(mockFetchPurchasesBySupplier).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("nao busca quando supplierAddress e null", () => {
    const { result } = renderHook(() => useSupplierOrders(mockProvider, null));
    expect(mockFetchPurchasesBySupplier).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("chama fetchPurchasesBySupplier com provider e endereco corretos", async () => {
    mockFetchPurchasesBySupplier.mockResolvedValue([]);
    renderHook(() => useSupplierOrders(mockProvider, SUPPLIER));
    await act(async () => {});
    expect(mockFetchPurchasesBySupplier).toHaveBeenCalledWith(
      mockProvider,
      SUPPLIER,
    );
  });

  it("refetch dispara nova busca e atualiza orders", async () => {
    mockFetchPurchasesBySupplier.mockResolvedValue([ORDER_OPEN]);
    const { result } = renderHook(() =>
      useSupplierOrders(mockProvider, SUPPLIER),
    );
    await act(async () => {});

    mockFetchPurchasesBySupplier.mockResolvedValue([
      ORDER_OPEN,
      { ...ORDER_OPEN, purchaseId: 2n },
    ]);
    await act(async () => {
      result.current.refetch();
    });
    await act(async () => {});

    expect(mockFetchPurchasesBySupplier).toHaveBeenCalledTimes(2);
    expect(result.current.orders).toHaveLength(2);
  });
});
