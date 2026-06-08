import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useSuppliers } from "@/hooks/useSuppliers";
import type { Supplier } from "@/services/supplierService";

const { mockFetchSuppliers } = vi.hoisted(() => ({
  mockFetchSuppliers: vi.fn(),
}));

vi.mock("@/services/supplierService", () => ({
  fetchSuppliers: mockFetchSuppliers,
}));

const mockProvider = { _isProvider: true } as never;

const SUPPLIER: Supplier = {
  address: "0xAAAA000000000000000000000000000000000001",
  name: "Distribuidora Alpha",
  serviceType: "Alimentos",
  approved: true,
};

describe("useSuppliers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("estado inicial tem suppliers vazio, loading false e error null", () => {
    mockFetchSuppliers.mockResolvedValue([]);
    const { result } = renderHook(() => useSuppliers(null));

    expect(result.current.suppliers).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("nao chama fetchSuppliers quando provider e null", () => {
    renderHook(() => useSuppliers(null));
    expect(mockFetchSuppliers).not.toHaveBeenCalled();
  });

  it("carrega fornecedores ao receber provider", async () => {
    mockFetchSuppliers.mockResolvedValue([SUPPLIER]);

    const { result } = renderHook(() => useSuppliers(mockProvider));

    await waitFor(() => {
      expect(result.current.suppliers).toHaveLength(1);
    });

    expect(result.current.suppliers[0]).toEqual(SUPPLIER);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("define error quando fetchSuppliers lanca excecao", async () => {
    mockFetchSuppliers.mockRejectedValue(
      new Error("Falha ao buscar fornecedores"),
    );

    const { result } = renderHook(() => useSuppliers(mockProvider));

    await waitFor(() => {
      expect(result.current.error).toBe("Falha ao buscar fornecedores");
    });

    expect(result.current.loading).toBe(false);
  });

  it("expoe refetch para recarregar a lista", async () => {
    mockFetchSuppliers.mockResolvedValue([SUPPLIER]);

    const { result } = renderHook(() => useSuppliers(mockProvider));

    await waitFor(() => {
      expect(result.current.suppliers).toHaveLength(1);
    });

    mockFetchSuppliers.mockResolvedValue([]);
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.suppliers).toHaveLength(0);
    });
  });
});
