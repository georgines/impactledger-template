import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useBootstrapStatus } from "@/hooks/useBootstrapStatus";

const { mockBootstrapped } = vi.hoisted(() => ({
  mockBootstrapped: vi.fn(),
}));

vi.mock("@/services/contractService", () => ({
  getGovernanceDAOContract: vi.fn(() => ({
    bootstrapped: mockBootstrapped,
  })),
}));

const mockProvider = { _isProvider: true } as never;

describe("useBootstrapStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna isBootstrapped=false e loading=false sem provider", () => {
    const { result } = renderHook(() => useBootstrapStatus(null));
    expect(result.current.isBootstrapped).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("inicia loading=true quando provider fornecido", async () => {
    mockBootstrapped.mockResolvedValue(false);
    const { result } = renderHook(() => useBootstrapStatus(mockProvider));
    expect(result.current.loading).toBe(true);
    await act(async () => {});
  });

  it("retorna isBootstrapped=true quando contrato retorna true", async () => {
    mockBootstrapped.mockResolvedValue(true);
    const { result } = renderHook(() => useBootstrapStatus(mockProvider));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.isBootstrapped).toBe(true);
  });

  it("retorna isBootstrapped=false quando contrato retorna false", async () => {
    mockBootstrapped.mockResolvedValue(false);
    const { result } = renderHook(() => useBootstrapStatus(mockProvider));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.isBootstrapped).toBe(false);
  });

  it("mantém isBootstrapped=false quando leitura falha", async () => {
    mockBootstrapped.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useBootstrapStatus(mockProvider));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.isBootstrapped).toBe(false);
  });
});
