import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useDisputeEvidences } from "@/hooks/useDisputeEvidences";

const { mockQueryFilter, mockFilters } = vi.hoisted(() => {
  const mockFilters = { DisputeEvidenceAdded: vi.fn().mockReturnValue({}) };
  const mockQueryFilter = vi.fn();
  return { mockQueryFilter, mockFilters };
});

vi.mock("@/services/contractService", () => ({
  getPurchaseManagerContract: vi.fn(() => ({
    filters: mockFilters,
    queryFilter: mockQueryFilter,
  })),
}));

const mockGetBlock = vi.fn().mockResolvedValue({ timestamp: 1_700_000_000 });
const mockProvider = { _isProvider: true, getBlock: mockGetBlock } as never;

const INSTITUTION = "0xINST000000000000000000000000000000000000";
const SUPPLIER = "0xAAAA000000000000000000000000000000000001";
const HASH_1 =
  "0xdeadbeef00000000000000000000000000000000000000000000000000000001";
const HASH_2 =
  "0xdeadbeef00000000000000000000000000000000000000000000000000000002";

function makeEvent(ipfsHash: string, submittedBy: string, blockNumber = 100) {
  return { args: { ipfsHash, submittedBy }, blockNumber };
}

describe("useDisputeEvidences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryFilter.mockResolvedValue([]);
    mockGetBlock.mockResolvedValue({ timestamp: 1_700_000_000 });
  });

  it("estado inicial tem evidencias vazio e loading false", () => {
    const { result } = renderHook(() => useDisputeEvidences(null, BigInt(1)));
    expect(result.current.evidences).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("nao busca evidencias quando provider e null", () => {
    renderHook(() => useDisputeEvidences(null, BigInt(1)));
    expect(mockQueryFilter).not.toHaveBeenCalled();
  });

  it("busca evidencias ao receber provider", async () => {
    mockQueryFilter.mockResolvedValue([makeEvent(HASH_1, INSTITUTION)]);

    const { result } = renderHook(() =>
      useDisputeEvidences(mockProvider, BigInt(1)),
    );

    await waitFor(() => {
      expect(result.current.evidences).toHaveLength(1);
    });
  });

  it("mapeia ipfsHash, submittedBy e timestamp dos eventos", async () => {
    mockQueryFilter.mockResolvedValue([
      makeEvent(HASH_1, INSTITUTION, 100),
      makeEvent(HASH_2, SUPPLIER, 200),
    ]);

    const { result } = renderHook(() =>
      useDisputeEvidences(mockProvider, BigInt(5)),
    );

    await waitFor(() => {
      expect(result.current.evidences).toHaveLength(2);
    });

    expect(result.current.evidences[0]).toEqual(
      expect.objectContaining({
        ipfsHash: HASH_1,
        submittedBy: INSTITUTION,
        timestamp: 1_700_000_000,
      }),
    );
    expect(result.current.evidences[1]).toEqual(
      expect.objectContaining({
        ipfsHash: HASH_2,
        submittedBy: SUPPLIER,
        timestamp: 1_700_000_000,
      }),
    );
  });

  it("filtra eventos pelo purchaseId correto", async () => {
    mockQueryFilter.mockResolvedValue([]);

    renderHook(() => useDisputeEvidences(mockProvider, BigInt(7)));

    await waitFor(() => {
      expect(mockFilters.DisputeEvidenceAdded).toHaveBeenCalledWith(BigInt(7));
    });
  });

  it("retorna lista vazia quando nao ha evidencias", async () => {
    mockQueryFilter.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useDisputeEvidences(mockProvider, BigInt(1)),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.evidences).toEqual([]);
  });

  it("expoe error quando queryFilter lanca excecao", async () => {
    mockQueryFilter.mockRejectedValue(new Error("Falha na rede"));

    const { result } = renderHook(() =>
      useDisputeEvidences(mockProvider, BigInt(1)),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.evidences).toEqual([]);
  });

  it("limpa error em refetch bem-sucedido", async () => {
    mockQueryFilter.mockRejectedValueOnce(new Error("Falha na rede"));
    mockQueryFilter.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useDisputeEvidences(mockProvider, BigInt(1)),
    );

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
