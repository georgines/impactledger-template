import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useVoteStatus } from "@/hooks/useVoteStatus";

const { mockFetchHasVoted } = vi.hoisted(() => ({
  mockFetchHasVoted: vi.fn(),
}));

vi.mock("@/services/governanceService", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/services/governanceService")>();
  return { ...original, fetchHasVoted: mockFetchHasVoted };
});

const mockProvider = {} as never;
const VOTER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

describe("useVoteStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchHasVoted.mockResolvedValue(false);
  });

  it("retorna hasVoted=false no estado inicial", async () => {
    const { result } = renderHook(() => useVoteStatus(1n, VOTER, mockProvider));
    expect(result.current.hasVoted).toBe(false);
    await act(async () => {});
  });

  it("retorna hasVoted=true quando fetchHasVoted resolve true", async () => {
    mockFetchHasVoted.mockResolvedValue(true);

    const { result } = renderHook(() => useVoteStatus(1n, VOTER, mockProvider));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasVoted).toBe(true);
    expect(mockFetchHasVoted).toHaveBeenCalledWith(1n, VOTER, mockProvider);
  });

  it("retorna hasVoted=false quando fetchHasVoted resolve false", async () => {
    mockFetchHasVoted.mockResolvedValue(false);

    const { result } = renderHook(() => useVoteStatus(1n, VOTER, mockProvider));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasVoted).toBe(false);
  });

  it("não chama fetchHasVoted quando address é null", () => {
    renderHook(() => useVoteStatus(1n, null, mockProvider));
    expect(mockFetchHasVoted).not.toHaveBeenCalled();
  });

  it("não chama fetchHasVoted quando provider é null", () => {
    renderHook(() => useVoteStatus(1n, VOTER, null));
    expect(mockFetchHasVoted).not.toHaveBeenCalled();
  });

  it("mantém hasVoted=false quando fetchHasVoted lança erro (fail-safe)", async () => {
    mockFetchHasVoted.mockRejectedValue(new Error("Rede offline"));

    const { result } = renderHook(() => useVoteStatus(1n, VOTER, mockProvider));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasVoted).toBe(false);
  });
});
