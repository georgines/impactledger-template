import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchSuppliers,
  resolveSupplierName,
  type Supplier,
} from "@/services/supplierService";

const { mockQueryFilter, mockApprovedSuppliers, mockFilters } = vi.hoisted(
  () => ({
    mockQueryFilter: vi.fn(),
    mockApprovedSuppliers: vi.fn(),
    mockFilters: { SupplierApproved: vi.fn().mockReturnValue({}) },
  }),
);

vi.mock("@/services/contractService", () => ({
  getPurchaseManagerContract: vi.fn(() => ({
    filters: mockFilters,
    queryFilter: mockQueryFilter,
    approvedSuppliers: mockApprovedSuppliers,
  })),
}));

const SUPPLIER_A_ADDRESS = "0xAAAA000000000000000000000000000000000001";
const SUPPLIER_B_ADDRESS = "0xBBBB000000000000000000000000000000000002";

function makeApprovedEvent(address: string, name: string, serviceType: string) {
  return {
    args: { supplier: address, name, serviceType },
  };
}

const mockProvider = { _isProvider: true } as never;

describe("supplierService — fetchSuppliers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna lista vazia quando nao ha eventos SupplierApproved", async () => {
    mockQueryFilter.mockResolvedValue([]);

    const result = await fetchSuppliers(mockProvider);

    expect(result).toEqual([]);
  });

  it("retorna fornecedor aprovado com dados do evento", async () => {
    mockQueryFilter.mockResolvedValue([
      makeApprovedEvent(SUPPLIER_A_ADDRESS, "Distribuidora Alpha", "Alimentos"),
    ]);
    mockApprovedSuppliers.mockResolvedValue(true);

    const result = await fetchSuppliers(mockProvider);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject<Supplier>({
      address: SUPPLIER_A_ADDRESS,
      name: "Distribuidora Alpha",
      serviceType: "Alimentos",
      approved: true,
    });
  });

  it("marca fornecedor como nao aprovado quando approvedSuppliers retorna false", async () => {
    mockQueryFilter.mockResolvedValue([
      makeApprovedEvent(SUPPLIER_A_ADDRESS, "Distribuidora Alpha", "Alimentos"),
    ]);
    mockApprovedSuppliers.mockResolvedValue(false);

    const result = await fetchSuppliers(mockProvider);

    expect(result[0].approved).toBe(false);
  });

  it("retorna multiplos fornecedores em ordem dos eventos", async () => {
    mockQueryFilter.mockResolvedValue([
      makeApprovedEvent(SUPPLIER_A_ADDRESS, "Alpha", "Alimentos"),
      makeApprovedEvent(SUPPLIER_B_ADDRESS, "Beta", "Transporte"),
    ]);
    mockApprovedSuppliers
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const result = await fetchSuppliers(mockProvider);

    expect(result).toHaveLength(2);
    expect(result[0].address).toBe(SUPPLIER_A_ADDRESS);
    expect(result[1].address).toBe(SUPPLIER_B_ADDRESS);
  });

  it("usa o filtro SupplierApproved do contrato", async () => {
    mockQueryFilter.mockResolvedValue([]);

    await fetchSuppliers(mockProvider);

    expect(mockFilters.SupplierApproved).toHaveBeenCalled();
    expect(mockQueryFilter).toHaveBeenCalledWith(
      mockFilters.SupplierApproved(),
    );
  });

  it("chama approvedSuppliers com o endereco de cada fornecedor", async () => {
    mockQueryFilter.mockResolvedValue([
      makeApprovedEvent(SUPPLIER_A_ADDRESS, "Alpha", "Alimentos"),
    ]);
    mockApprovedSuppliers.mockResolvedValue(true);

    await fetchSuppliers(mockProvider);

    expect(mockApprovedSuppliers).toHaveBeenCalledWith(SUPPLIER_A_ADDRESS);
  });
});

// ----------------------------------------------------------------
describe("supplierService — resolveSupplierName", () => {
  const suppliers: Supplier[] = [
    {
      address: SUPPLIER_A_ADDRESS,
      name: "Distribuidora Alpha",
      serviceType: "Alimentos",
      approved: true,
    },
    {
      address: SUPPLIER_B_ADDRESS,
      name: "Transportes Beta",
      serviceType: "Transporte",
      approved: true,
    },
  ];

  it("retorna nome do fornecedor quando endereco existe na lista", () => {
    expect(resolveSupplierName(suppliers, SUPPLIER_A_ADDRESS)).toBe(
      "Distribuidora Alpha",
    );
  });

  it("retorna undefined quando endereco nao existe na lista", () => {
    expect(
      resolveSupplierName(
        suppliers,
        "0x0000000000000000000000000000000000000000",
      ),
    ).toBeUndefined();
  });

  it("comparacao de endereco e case-insensitive", () => {
    const lowerAddress = SUPPLIER_A_ADDRESS.toLowerCase();
    expect(resolveSupplierName(suppliers, lowerAddress)).toBe(
      "Distribuidora Alpha",
    );
  });

  it("retorna undefined para lista vazia", () => {
    expect(resolveSupplierName([], SUPPLIER_A_ADDRESS)).toBeUndefined();
  });
});
