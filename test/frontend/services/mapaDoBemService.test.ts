import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchAllPayments,
  fetchAllDonations,
  fetchAllActivity,
} from "@/services/mapaDoBemService";

const {
  mockPurchaseQueryFilter,
  mockTreasuryQueryFilter,
  mockGetPurchase,
  mockPurchaseFilters,
  mockTreasuryFilters,
} = vi.hoisted(() => ({
  mockPurchaseQueryFilter: vi.fn(),
  mockTreasuryQueryFilter: vi.fn(),
  mockGetPurchase: vi.fn(),
  mockPurchaseFilters: { ImmutableReceipt: vi.fn().mockReturnValue({}) },
  mockTreasuryFilters: { DonationReceived: vi.fn().mockReturnValue({}) },
}));

vi.mock("@/services/contractService", () => ({
  getPurchaseManagerContract: vi.fn(() => ({
    filters: mockPurchaseFilters,
    queryFilter: mockPurchaseQueryFilter,
    getPurchase: mockGetPurchase,
  })),
  getTreasuryContract: vi.fn(() => ({
    filters: mockTreasuryFilters,
    queryFilter: mockTreasuryQueryFilter,
  })),
}));

const INSTITUTION = "0xAAAA000000000000000000000000000000000001";
const SUPPLIER = "0xBBBB000000000000000000000000000000000002";
const DONOR = "0xCCCC000000000000000000000000000000000003";
const PROOF_HASH =
  "0xabcd000000000000000000000000000000000000000000000000000000000001";
const DESC_HASH =
  "0xdead000000000000000000000000000000000000000000000000000000000001";
const TX_HASH =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const EMPTY_HASH = "0x" + "0".repeat(64);

function makeReceiptEvent(
  purchaseId: bigint,
  blockNumber: number,
  txHash = TX_HASH,
) {
  return {
    args: {
      purchaseId,
      institution: INSTITUTION,
      supplier: SUPPLIER,
      amount: 500000000000000000n,
      impactProofHash: PROOF_HASH,
    },
    blockNumber,
    transactionHash: txHash,
  };
}

function makeDonationEvent(blockNumber: number, amount = 200000000000000000n) {
  return {
    args: { donor: DONOR, institution: INSTITUTION, amount },
    blockNumber,
    transactionHash: TX_HASH,
  };
}

const mockGetBlock = vi.fn().mockResolvedValue({ timestamp: 1_700_000_000 });
const mockProvider = { _isProvider: true, getBlock: mockGetBlock } as never;

describe("fetchAllPayments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBlock.mockResolvedValue({ timestamp: 1_700_000_000 });
    mockGetPurchase.mockResolvedValue({ descriptionHash: DESC_HASH });
  });

  it("retorna lista vazia quando nao ha eventos", async () => {
    mockPurchaseQueryFilter.mockResolvedValue([]);
    const result = await fetchAllPayments(mockProvider);
    expect(result).toEqual([]);
  });

  it("monta PaymentRecord corretamente a partir do evento e getPurchase", async () => {
    mockPurchaseQueryFilter.mockResolvedValue([makeReceiptEvent(1n, 100)]);
    const result = await fetchAllPayments(mockProvider);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        purchaseId: 1n,
        institution: INSTITUTION,
        supplier: SUPPLIER,
        amount: 500000000000000000n,
        impactProofHash: PROOF_HASH,
        descriptionHash: DESC_HASH,
        blockNumber: 100,
        txHash: TX_HASH,
        timestamp: 1_700_000_000,
      }),
    );
  });

  it("inclui timestamp do bloco no PaymentRecord", async () => {
    mockGetBlock.mockResolvedValue({ timestamp: 1_710_000_000 });
    mockPurchaseQueryFilter.mockResolvedValue([makeReceiptEvent(1n, 100)]);
    const result = await fetchAllPayments(mockProvider);
    expect(result[0].timestamp).toBe(1_710_000_000);
  });

  it("chama getPurchase para cada evento para buscar descriptionHash", async () => {
    mockPurchaseQueryFilter.mockResolvedValue([
      makeReceiptEvent(1n, 100),
      makeReceiptEvent(2n, 200),
    ]);
    await fetchAllPayments(mockProvider);
    expect(mockGetPurchase).toHaveBeenCalledTimes(2);
    expect(mockGetPurchase).toHaveBeenCalledWith(1n);
    expect(mockGetPurchase).toHaveBeenCalledWith(2n);
  });

  it("ordena resultados por blockNumber decrescente", async () => {
    mockPurchaseQueryFilter.mockResolvedValue([
      makeReceiptEvent(1n, 50),
      makeReceiptEvent(2n, 200),
      makeReceiptEvent(3n, 100),
    ]);
    const result = await fetchAllPayments(mockProvider);
    expect(result[0].blockNumber).toBe(200);
    expect(result[1].blockNumber).toBe(100);
    expect(result[2].blockNumber).toBe(50);
  });

  it("usa filtro ImmutableReceipt ao consultar eventos", async () => {
    mockPurchaseQueryFilter.mockResolvedValue([]);
    await fetchAllPayments(mockProvider);
    expect(mockPurchaseFilters.ImmutableReceipt).toHaveBeenCalled();
    expect(mockPurchaseQueryFilter).toHaveBeenCalledWith({}, 0);
  });

  it("inclui descriptionHash vazio quando getPurchase retorna hash zero", async () => {
    mockGetPurchase.mockResolvedValue({ descriptionHash: EMPTY_HASH });
    mockPurchaseQueryFilter.mockResolvedValue([makeReceiptEvent(1n, 100)]);
    const result = await fetchAllPayments(mockProvider);
    expect(result[0].descriptionHash).toBe(EMPTY_HASH);
  });
});

describe("fetchAllDonations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBlock.mockResolvedValue({ timestamp: 1_700_000_000 });
  });

  it("retorna lista vazia quando nao ha eventos", async () => {
    mockTreasuryQueryFilter.mockResolvedValue([]);
    const result = await fetchAllDonations(mockProvider);
    expect(result).toEqual([]);
  });

  it("monta DonationActivity corretamente a partir do evento", async () => {
    mockTreasuryQueryFilter.mockResolvedValue([makeDonationEvent(100)]);
    const result = await fetchAllDonations(mockProvider);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        kind: "donation",
        blockNumber: 100,
        txHash: TX_HASH,
        donor: DONOR,
        institution: INSTITUTION,
        amount: 200000000000000000n,
        timestamp: 1_700_000_000,
      }),
    );
  });

  it("inclui timestamp do bloco na DonationActivity", async () => {
    mockGetBlock.mockResolvedValue({ timestamp: 1_720_000_000 });
    mockTreasuryQueryFilter.mockResolvedValue([makeDonationEvent(100)]);
    const result = await fetchAllDonations(mockProvider);
    expect(result[0].timestamp).toBe(1_720_000_000);
  });

  it("usa filtro DonationReceived ao consultar eventos", async () => {
    mockTreasuryQueryFilter.mockResolvedValue([]);
    await fetchAllDonations(mockProvider);
    expect(mockTreasuryFilters.DonationReceived).toHaveBeenCalled();
  });

  it("retorna multiplas doacoes", async () => {
    mockTreasuryQueryFilter.mockResolvedValue([
      makeDonationEvent(100, 100000000000000000n),
      makeDonationEvent(200, 300000000000000000n),
    ]);
    const result = await fetchAllDonations(mockProvider);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe("donation");
    expect(result[1].kind).toBe("donation");
  });
});

describe("fetchAllActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBlock.mockResolvedValue({ timestamp: 1_700_000_000 });
    mockGetPurchase.mockResolvedValue({ descriptionHash: DESC_HASH });
  });

  it("retorna lista vazia quando nao ha eventos em nenhum contrato", async () => {
    mockPurchaseQueryFilter.mockResolvedValue([]);
    mockTreasuryQueryFilter.mockResolvedValue([]);
    const result = await fetchAllActivity(mockProvider);
    expect(result).toEqual([]);
  });

  it("combina doacoes e pagamentos numa lista unica", async () => {
    mockPurchaseQueryFilter.mockResolvedValue([makeReceiptEvent(1n, 100)]);
    mockTreasuryQueryFilter.mockResolvedValue([makeDonationEvent(200)]);
    const result = await fetchAllActivity(mockProvider);
    expect(result).toHaveLength(2);
  });

  it("ordena todos os eventos por blockNumber decrescente", async () => {
    mockPurchaseQueryFilter.mockResolvedValue([makeReceiptEvent(1n, 50)]);
    mockTreasuryQueryFilter.mockResolvedValue([
      makeDonationEvent(200),
      makeDonationEvent(100),
    ]);
    const result = await fetchAllActivity(mockProvider);
    expect(result[0].blockNumber).toBe(200);
    expect(result[1].blockNumber).toBe(100);
    expect(result[2].blockNumber).toBe(50);
  });

  it("marca pagamentos com kind payment", async () => {
    mockPurchaseQueryFilter.mockResolvedValue([makeReceiptEvent(1n, 100)]);
    mockTreasuryQueryFilter.mockResolvedValue([]);
    const result = await fetchAllActivity(mockProvider);
    expect(result[0].kind).toBe("payment");
  });

  it("marca doacoes com kind donation", async () => {
    mockPurchaseQueryFilter.mockResolvedValue([]);
    mockTreasuryQueryFilter.mockResolvedValue([makeDonationEvent(100)]);
    const result = await fetchAllActivity(mockProvider);
    expect(result[0].kind).toBe("donation");
  });
});
