import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMapaDoBem } from "@/hooks/useMapaDoBem";

const { mockFetchAllActivity, mockGetPublicProvider } = vi.hoisted(() => ({
  mockFetchAllActivity: vi.fn(),
  mockGetPublicProvider: vi.fn(),
}));

vi.mock("@/services/mapaDoBemService", () => ({
  fetchAllActivity: mockFetchAllActivity,
}));

vi.mock("@/services/walletService", () => ({
  connectWallet: vi.fn(),
  getPublicProvider: mockGetPublicProvider,
}));

const mockProvider = { _isProvider: true } as never;
const mockPublicProvider = { _isPublicProvider: true } as never;

const DONATION = {
  kind: "donation" as const,
  blockNumber: 200,
  txHash: "0x1234",
  donor: "0xCCCC000000000000000000000000000000000003",
  institution: "0xAAAA000000000000000000000000000000000001",
  amount: 200000000000000000n,
};

const PAYMENT = {
  kind: "payment" as const,
  blockNumber: 100,
  txHash: "0x5678",
  purchaseId: 1n,
  institution: "0xAAAA000000000000000000000000000000000001",
  supplier: "0xBBBB000000000000000000000000000000000002",
  amount: 500000000000000000n,
  impactProofHash: "0xabcd",
  descriptionHash: "0xdead",
};

describe("useMapaDoBem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublicProvider.mockReturnValue(mockPublicProvider);
    mockFetchAllActivity.mockResolvedValue([]);
  });

  it("inicia com loading true e activities vazio", async () => {
    const { result } = renderHook(() => useMapaDoBem(mockProvider));
    expect(result.current.loading).toBe(true);
    expect(result.current.activities).toEqual([]);
    expect(result.current.error).toBeNull();
    await act(async () => {});
  });

  it("retorna activities apos carregar com sucesso", async () => {
    mockFetchAllActivity.mockResolvedValue([DONATION, PAYMENT]);
    const { result } = renderHook(() => useMapaDoBem(mockProvider));
    await act(async () => {});
    expect(result.current.activities).toHaveLength(2);
    expect(result.current.activities[0].kind).toBe("donation");
    expect(result.current.activities[1].kind).toBe("payment");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("define error quando fetchAllActivity lanca excecao", async () => {
    mockFetchAllActivity.mockRejectedValue(new Error("Erro de rede"));
    const { result } = renderHook(() => useMapaDoBem(mockProvider));
    await act(async () => {});
    expect(result.current.error).toBe("Erro de rede");
    expect(result.current.loading).toBe(false);
    expect(result.current.activities).toEqual([]);
  });

  it("usa getPublicProvider quando provider e null", async () => {
    renderHook(() => useMapaDoBem(null));
    await act(async () => {});
    expect(mockGetPublicProvider).toHaveBeenCalled();
    expect(mockFetchAllActivity).toHaveBeenCalledWith(mockPublicProvider);
  });

  it("usa provider fornecido quando nao e null", async () => {
    renderHook(() => useMapaDoBem(mockProvider));
    await act(async () => {});
    expect(mockGetPublicProvider).not.toHaveBeenCalled();
    expect(mockFetchAllActivity).toHaveBeenCalledWith(mockProvider);
  });

  it("erro generico recebe mensagem padrao", async () => {
    mockFetchAllActivity.mockRejectedValue("falha desconhecida");
    const { result } = renderHook(() => useMapaDoBem(mockProvider));
    await act(async () => {});
    expect(result.current.error).toBe("Erro ao carregar dados da plataforma");
  });
});
