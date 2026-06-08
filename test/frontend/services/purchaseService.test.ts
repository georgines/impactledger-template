import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchPurchasesByInstitution,
  fetchPurchasesBySupplier,
  fetchDisputedPurchases,
  PurchaseStatus,
  PURCHASE_STATUS_LABELS,
  PURCHASE_STATUS_COLORS,
} from "@/services/purchaseService";

const { mockQueryFilter, mockGetPurchase, mockFilters } = vi.hoisted(() => ({
  mockQueryFilter: vi.fn(),
  mockGetPurchase: vi.fn(),
  mockFilters: {
    PurchaseOpened: vi.fn().mockReturnValue({}),
    DisputeOpened: vi.fn().mockReturnValue({}),
  },
}));

vi.mock("@/services/contractService", () => ({
  getPurchaseManagerContract: vi.fn(() => ({
    filters: mockFilters,
    queryFilter: mockQueryFilter,
    getPurchase: mockGetPurchase,
  })),
}));

const INSTITUTION = "0xAAAA000000000000000000000000000000000001";
const SUPPLIER_A = "0xBBBB000000000000000000000000000000000002";
const SUPPLIER_B = "0xCCCC000000000000000000000000000000000003";

function makePurchaseOpenedEvent(
  purchaseId: bigint,
  supplier: string,
  amount: bigint,
  deliveryDeadline: bigint,
  descriptionHash: string,
  blockNumber = 1,
) {
  return {
    blockNumber,
    args: {
      purchaseId,
      institution: INSTITUTION,
      supplier,
      amount,
      deliveryDeadline,
      descriptionHash,
    },
  };
}

function makePurchaseData(purchaseId: bigint, status: number) {
  return {
    purchaseId,
    institution: INSTITUTION,
    supplier: SUPPLIER_A,
    amount: 100n,
    deliveryDeadline: 9999999999n,
    descriptionHash: "0xabc",
    status,
    impactProofHash:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    confirmDeadline: 0n,
    disputeDeadline: 0n,
    supplierVoteWeight: 0n,
    institutionVoteWeight: 0n,
  };
}

const mockProvider = {
  _isProvider: true,
  getBlock: vi.fn().mockResolvedValue({ timestamp: 1_700_000_000 }),
} as never;

describe("purchaseService — fetchPurchasesByInstitution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna lista vazia quando nao ha eventos PurchaseOpened para a instituicao", async () => {
    mockQueryFilter.mockResolvedValue([]);

    const result = await fetchPurchasesByInstitution(mockProvider, INSTITUTION);

    expect(result).toEqual([]);
  });

  it("retorna pedido com status atual obtido via getPurchase", async () => {
    mockQueryFilter.mockResolvedValue([
      makePurchaseOpenedEvent(1n, SUPPLIER_A, 500n, 9999999999n, "0xhash"),
    ]);
    mockGetPurchase.mockResolvedValue(
      makePurchaseData(1n, PurchaseStatus.Open),
    );

    const result = await fetchPurchasesByInstitution(mockProvider, INSTITUTION);

    expect(result).toHaveLength(1);
    expect(result[0].purchaseId).toBe(1n);
    expect(result[0].status).toBe(PurchaseStatus.Open);
    expect(result[0].supplier).toBe(SUPPLIER_A);
    expect(result[0].amount).toBe(500n);
  });

  it("chama getPurchase com o purchaseId correto para enriquecer status", async () => {
    mockQueryFilter.mockResolvedValue([
      makePurchaseOpenedEvent(42n, SUPPLIER_A, 100n, 9999999999n, "0xhash"),
    ]);
    mockGetPurchase.mockResolvedValue(
      makePurchaseData(42n, PurchaseStatus.Delivered),
    );

    await fetchPurchasesByInstitution(mockProvider, INSTITUTION);

    expect(mockGetPurchase).toHaveBeenCalledWith(42n);
  });

  it("usa filtro PurchaseOpened com endereco da instituicao como segundo argumento", async () => {
    mockQueryFilter.mockResolvedValue([]);

    await fetchPurchasesByInstitution(mockProvider, INSTITUTION);

    expect(mockFilters.PurchaseOpened).toHaveBeenCalledWith(null, INSTITUTION);
  });

  it("retorna multiplos pedidos mantendo ordem dos eventos", async () => {
    mockQueryFilter.mockResolvedValue([
      makePurchaseOpenedEvent(1n, SUPPLIER_A, 100n, 9999999999n, "0xhash1"),
      makePurchaseOpenedEvent(2n, SUPPLIER_B, 200n, 9999999999n, "0xhash2"),
    ]);
    mockGetPurchase
      .mockResolvedValueOnce(makePurchaseData(1n, PurchaseStatus.Open))
      .mockResolvedValueOnce(makePurchaseData(2n, PurchaseStatus.Delivered));

    const result = await fetchPurchasesByInstitution(mockProvider, INSTITUTION);

    expect(result).toHaveLength(2);
    expect(result[0].purchaseId).toBe(1n);
    expect(result[1].purchaseId).toBe(2n);
    expect(result[1].status).toBe(PurchaseStatus.Delivered);
  });

  it("reflete status Paid retornado por getPurchase", async () => {
    mockQueryFilter.mockResolvedValue([
      makePurchaseOpenedEvent(5n, SUPPLIER_A, 300n, 9999999999n, "0xhash"),
    ]);
    mockGetPurchase.mockResolvedValue(
      makePurchaseData(5n, PurchaseStatus.Paid),
    );

    const result = await fetchPurchasesByInstitution(mockProvider, INSTITUTION);

    expect(result[0].status).toBe(PurchaseStatus.Paid);
  });

  it("inclui impactProofHash do getPurchase no resultado", async () => {
    const proofHash =
      "0xdeadbeef00000000000000000000000000000000000000000000000000000000";
    mockQueryFilter.mockResolvedValue([
      makePurchaseOpenedEvent(3n, SUPPLIER_A, 100n, 9999999999n, "0xhash"),
    ]);
    mockGetPurchase.mockResolvedValue({
      ...makePurchaseData(3n, PurchaseStatus.Paid),
      impactProofHash: proofHash,
    });

    const result = await fetchPurchasesByInstitution(mockProvider, INSTITUTION);

    expect(result[0].impactProofHash).toBe(proofHash);
  });
});

// ================================================================
describe("purchaseService — fetchPurchasesBySupplier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna lista vazia quando nao ha eventos PurchaseOpened para o fornecedor", async () => {
    mockQueryFilter.mockResolvedValue([]);

    const result = await fetchPurchasesBySupplier(mockProvider, SUPPLIER_A);

    expect(result).toEqual([]);
  });

  it("usa filtro PurchaseOpened com null null e endereco do fornecedor", async () => {
    mockQueryFilter.mockResolvedValue([]);

    await fetchPurchasesBySupplier(mockProvider, SUPPLIER_A);

    expect(mockFilters.PurchaseOpened).toHaveBeenCalledWith(
      null,
      null,
      SUPPLIER_A,
    );
  });

  it("retorna pedido com status atual obtido via getPurchase", async () => {
    mockQueryFilter.mockResolvedValue([
      makePurchaseOpenedEvent(1n, SUPPLIER_A, 500n, 9999999999n, "0xhash"),
    ]);
    mockGetPurchase.mockResolvedValue(
      makePurchaseData(1n, PurchaseStatus.Open),
    );

    const result = await fetchPurchasesBySupplier(mockProvider, SUPPLIER_A);

    expect(result).toHaveLength(1);
    expect(result[0].purchaseId).toBe(1n);
    expect(result[0].supplier).toBe(SUPPLIER_A);
    expect(result[0].status).toBe(PurchaseStatus.Open);
  });

  it("retorna multiplos pedidos do mesmo fornecedor", async () => {
    mockQueryFilter.mockResolvedValue([
      makePurchaseOpenedEvent(1n, SUPPLIER_A, 100n, 9999999999n, "0xhash1"),
      makePurchaseOpenedEvent(2n, SUPPLIER_A, 200n, 9999999999n, "0xhash2"),
    ]);
    mockGetPurchase
      .mockResolvedValueOnce(makePurchaseData(1n, PurchaseStatus.Open))
      .mockResolvedValueOnce(makePurchaseData(2n, PurchaseStatus.Delivered));

    const result = await fetchPurchasesBySupplier(mockProvider, SUPPLIER_A);

    expect(result).toHaveLength(2);
    expect(result[1].status).toBe(PurchaseStatus.Delivered);
  });
});

// ================================================================
describe("purchaseService — fetchDisputedPurchases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeDisputeOpenedEvent(purchaseId: bigint, deadline: bigint) {
    return { args: { purchaseId, deadline } };
  }

  function makeFullPurchaseData(purchaseId: bigint, status: number) {
    return {
      institution: INSTITUTION,
      supplier: SUPPLIER_A,
      amount: 300n,
      deliveryDeadline: 9999999999n,
      descriptionHash: "0xhash",
      status,
      impactProofHash:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      confirmDeadline: 0n,
      disputeDeadline: 9999999999n,
      supplierVoteWeight: 0n,
      institutionVoteWeight: 0n,
    };
  }

  it("retorna lista vazia quando nao ha eventos DisputeOpened", async () => {
    mockQueryFilter.mockResolvedValue([]);

    const result = await fetchDisputedPurchases(mockProvider);

    expect(result).toEqual([]);
  });

  it("usa filtro DisputeOpened sem argumentos", async () => {
    mockQueryFilter.mockResolvedValue([]);

    await fetchDisputedPurchases(mockProvider);

    expect(mockFilters.DisputeOpened).toHaveBeenCalledWith();
  });

  it("retorna apenas disputas com status Disputed", async () => {
    mockQueryFilter.mockResolvedValue([
      makeDisputeOpenedEvent(1n, 9999999999n),
      makeDisputeOpenedEvent(2n, 9999999999n),
    ]);
    mockGetPurchase
      .mockResolvedValueOnce(makeFullPurchaseData(1n, PurchaseStatus.Disputed))
      .mockResolvedValueOnce(makeFullPurchaseData(2n, PurchaseStatus.Paid));

    const result = await fetchDisputedPurchases(mockProvider);

    expect(result).toHaveLength(1);
    expect(result[0].purchaseId).toBe(1n);
  });

  it("monta Purchase completo com dados do getPurchase", async () => {
    mockQueryFilter.mockResolvedValue([
      makeDisputeOpenedEvent(5n, 9999999999n),
    ]);
    mockGetPurchase.mockResolvedValue(
      makeFullPurchaseData(5n, PurchaseStatus.Disputed),
    );

    const result = await fetchDisputedPurchases(mockProvider);

    expect(result[0].purchaseId).toBe(5n);
    expect(result[0].institution).toBe(INSTITUTION);
    expect(result[0].supplier).toBe(SUPPLIER_A);
    expect(result[0].status).toBe(PurchaseStatus.Disputed);
  });

  it("retorna lista vazia quando todas as disputas ja foram resolvidas", async () => {
    mockQueryFilter.mockResolvedValue([
      makeDisputeOpenedEvent(1n, 0n),
      makeDisputeOpenedEvent(2n, 0n),
    ]);
    mockGetPurchase
      .mockResolvedValueOnce(makeFullPurchaseData(1n, PurchaseStatus.Paid))
      .mockResolvedValueOnce(makeFullPurchaseData(2n, PurchaseStatus.Refunded));

    const result = await fetchDisputedPurchases(mockProvider);

    expect(result).toEqual([]);
  });
});

describe("PURCHASE_STATUS_LABELS", () => {
  it("mapeia todos os status para labels em português", () => {
    expect(PURCHASE_STATUS_LABELS[PurchaseStatus.Open]).toBe("Aberto");
    expect(PURCHASE_STATUS_LABELS[PurchaseStatus.Delivered]).toBe("Entregue");
    expect(PURCHASE_STATUS_LABELS[PurchaseStatus.Confirmed]).toBe("Confirmado");
    expect(PURCHASE_STATUS_LABELS[PurchaseStatus.Disputed]).toBe("Em Disputa");
    expect(PURCHASE_STATUS_LABELS[PurchaseStatus.Paid]).toBe("Pago");
    expect(PURCHASE_STATUS_LABELS[PurchaseStatus.Refunded]).toBe("Devolvido");
  });
});

describe("PURCHASE_STATUS_COLORS", () => {
  it("mapeia todos os status para cores do Mantine", () => {
    expect(PURCHASE_STATUS_COLORS[PurchaseStatus.Open]).toBe("blue");
    expect(PURCHASE_STATUS_COLORS[PurchaseStatus.Delivered]).toBe("yellow");
    expect(PURCHASE_STATUS_COLORS[PurchaseStatus.Confirmed]).toBe("cyan");
    expect(PURCHASE_STATUS_COLORS[PurchaseStatus.Disputed]).toBe("orange");
    expect(PURCHASE_STATUS_COLORS[PurchaseStatus.Paid]).toBe("green");
    expect(PURCHASE_STATUS_COLORS[PurchaseStatus.Refunded]).toBe("gray");
  });
});
