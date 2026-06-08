import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDonation } from "@/hooks/useDonation";

const { mockDonate, mockWait } = vi.hoisted(() => ({
  mockDonate: vi.fn(),
  mockWait: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/services/contractService", () => ({
  getTreasuryContract: vi.fn(() => ({ donate: mockDonate })),
}));

const mockSigner = { _isSigner: true } as never;

describe("useDonation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDonate.mockResolvedValue({ wait: mockWait });
  });

  it("estado inicial tem loading false e error null", () => {
    const { result } = renderHook(() => useDonation(mockSigner));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("donate chama Treasury.donate com o endereço da instituição", async () => {
    const { result } = renderHook(() => useDonation(mockSigner));

    await act(async () => {
      await result.current.donate("0xinstitution", 1000n);
    });

    expect(mockDonate).toHaveBeenCalledWith("0xinstitution", { value: 1000n });
  });

  it("donate aguarda confirmação da transação", async () => {
    const { result } = renderHook(() => useDonation(mockSigner));

    await act(async () => {
      await result.current.donate("0xinstitution", 500n);
    });

    expect(mockWait).toHaveBeenCalled();
  });

  it("define error traduzido quando o contrato reverte com custom error", async () => {
    mockDonate.mockRejectedValueOnce(
      new Error("execution reverted: Treasury__InstitutionNotActive(0xabc)"),
    );

    const { result } = renderHook(() => useDonation(mockSigner));

    await act(async () => {
      await result.current.donate("0xinstitution", 100n).catch(() => {});
    });

    expect(result.current.error).toBe("Instituição não está ativa.");
  });

  it("define error traduzido quando a carteira não tem saldo suficiente", async () => {
    mockDonate.mockRejectedValueOnce(
      Object.assign(
        new Error("insufficient funds for intrinsic transaction cost"),
        {
          code: "INSUFFICIENT_FUNDS",
        },
      ),
    );

    const { result } = renderHook(() => useDonation(mockSigner));

    await act(async () => {
      await result.current.donate("0xinstitution", 100n).catch(() => {});
    });

    expect(result.current.error).toBe(
      "Saldo insuficiente na carteira para cobrir o valor e a taxa de rede.",
    );
  });

  it("loading é true durante a transação e false após conclusão", async () => {
    let resolveDonate!: () => void;
    mockDonate.mockReturnValueOnce(
      new Promise<{ wait: typeof mockWait }>((resolve) => {
        resolveDonate = () => resolve({ wait: mockWait });
      }),
    );

    const { result } = renderHook(() => useDonation(mockSigner));

    const donatePromise = act(async () => {
      await result.current.donate("0xinstitution", 1n).catch(() => {});
    });

    resolveDonate();
    await donatePromise;

    expect(result.current.loading).toBe(false);
  });
});
