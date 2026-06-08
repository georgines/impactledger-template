import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useActorRole } from "@/hooks/useActorRole";

const { mockOperator, mockIsInstitution, mockApprovedSuppliers } = vi.hoisted(
  () => ({
    mockOperator: vi.fn(),
    mockIsInstitution: vi.fn(),
    mockApprovedSuppliers: vi.fn(),
  }),
);

vi.mock("@/services/contractService", () => ({
  getGovernanceDAOContract: vi.fn(() => ({ operator: mockOperator })),
  getInstitutionRegistryContract: vi.fn(() => ({
    isInstitution: mockIsInstitution,
  })),
  getPurchaseManagerContract: vi.fn(() => ({
    approvedSuppliers: mockApprovedSuppliers,
  })),
}));

const address = "0xabc123def456abc123def456abc123def456abc1";
const mockProvider = {} as never;

describe("useActorRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna null quando address é null", () => {
    const { result } = renderHook(() => useActorRole(null, mockProvider));
    expect(result.current).toBeNull();
  });

  it("retorna null quando provider é null", () => {
    const { result } = renderHook(() => useActorRole(address, null));
    expect(result.current).toBeNull();
  });

  it('retorna "operador" quando operator() corresponde ao address', async () => {
    mockOperator.mockResolvedValue(address);
    mockIsInstitution.mockResolvedValue(false);
    mockApprovedSuppliers.mockResolvedValue(false);

    const { result } = renderHook(() => useActorRole(address, mockProvider));

    await waitFor(() => expect(result.current).toBe("operador"));
  });

  it("comparação de operador é case-insensitive", async () => {
    mockOperator.mockResolvedValue(address.toUpperCase());
    mockIsInstitution.mockResolvedValue(false);
    mockApprovedSuppliers.mockResolvedValue(false);

    const { result } = renderHook(() => useActorRole(address, mockProvider));

    await waitFor(() => expect(result.current).toBe("operador"));
  });

  it('retorna "instituicao" quando isInstitution retorna true (status Active)', async () => {
    mockOperator.mockResolvedValue(
      "0x0000000000000000000000000000000000000001",
    );
    mockIsInstitution.mockResolvedValue(true);
    mockApprovedSuppliers.mockResolvedValue(false);

    const { result } = renderHook(() => useActorRole(address, mockProvider));

    await waitFor(() => expect(result.current).toBe("instituicao"));
  });

  it('retorna "instituicao" quando isInstitution retorna true (status Paused)', async () => {
    mockOperator.mockResolvedValue(
      "0x0000000000000000000000000000000000000001",
    );
    mockIsInstitution.mockResolvedValue(true);
    mockApprovedSuppliers.mockResolvedValue(false);

    const { result } = renderHook(() => useActorRole(address, mockProvider));

    await waitFor(() => expect(result.current).toBe("instituicao"));
  });

  it('retorna "doador" quando isInstitution retorna false (status Removed)', async () => {
    mockOperator.mockResolvedValue(
      "0x0000000000000000000000000000000000000001",
    );
    mockIsInstitution.mockResolvedValue(false);
    mockApprovedSuppliers.mockResolvedValue(false);

    const { result } = renderHook(() => useActorRole(address, mockProvider));

    await waitFor(() => expect(result.current).toBe("doador"));
  });

  it('retorna "fornecedor" quando approvedSuppliers retorna true', async () => {
    mockOperator.mockResolvedValue(
      "0x0000000000000000000000000000000000000001",
    );
    mockIsInstitution.mockResolvedValue(false);
    mockApprovedSuppliers.mockResolvedValue(true);

    const { result } = renderHook(() => useActorRole(address, mockProvider));

    await waitFor(() => expect(result.current).toBe("fornecedor"));
  });

  it('retorna "doador" como fallback quando nenhuma condição especial é atendida', async () => {
    mockOperator.mockResolvedValue(
      "0x0000000000000000000000000000000000000001",
    );
    mockIsInstitution.mockResolvedValue(false);
    mockApprovedSuppliers.mockResolvedValue(false);

    const { result } = renderHook(() => useActorRole(address, mockProvider));

    await waitFor(() => expect(result.current).toBe("doador"));
  });
});
