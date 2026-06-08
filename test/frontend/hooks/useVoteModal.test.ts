import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVoteModal } from "@/hooks/useVoteModal";

const { mockVote, mockWait } = vi.hoisted(() => ({
  mockVote: vi.fn(),
  mockWait: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/services/contractService", () => ({
  getGovernanceDAOContract: vi.fn(() => ({
    vote: mockVote,
  })),
}));

const mockSigner = { _isSigner: true } as never;
const mockOnVoted = vi.fn();

function makeProposal() {
  return { proposalId: 1n };
}

describe("useVoteModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVote.mockResolvedValue({ wait: mockWait });
    mockWait.mockResolvedValue({});
    mockOnVoted.mockReset();
  });

  it("inicia com modal fechado", () => {
    const { result } = renderHook(() =>
      useVoteModal(mockSigner, makeProposal(), mockOnVoted),
    );
    expect(result.current.isOpen).toBe(false);
  });

  it("open() abre o modal", () => {
    const { result } = renderHook(() =>
      useVoteModal(mockSigner, makeProposal(), mockOnVoted),
    );
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
  });

  it("close() fecha o modal", () => {
    const { result } = renderHook(() =>
      useVoteModal(mockSigner, makeProposal(), mockOnVoted),
    );
    act(() => result.current.open());
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it("submitVote(true) chama contract.vote com support=true", async () => {
    const { result } = renderHook(() =>
      useVoteModal(mockSigner, makeProposal(), mockOnVoted),
    );

    await act(async () => {
      await result.current.submitVote(true);
    });

    expect(mockVote).toHaveBeenCalledWith(1n, true);
  });

  it("submitVote(false) chama contract.vote com support=false", async () => {
    const { result } = renderHook(() =>
      useVoteModal(mockSigner, makeProposal(), mockOnVoted),
    );

    await act(async () => {
      await result.current.submitVote(false);
    });

    expect(mockVote).toHaveBeenCalledWith(1n, false);
  });

  it("submitVote chama onVoted com proposalId após sucesso", async () => {
    const { result } = renderHook(() =>
      useVoteModal(mockSigner, makeProposal(), mockOnVoted),
    );

    await act(async () => {
      await result.current.submitVote(true);
    });

    expect(mockOnVoted).toHaveBeenCalledWith(1n);
  });

  it("submitVote fecha o modal após sucesso", async () => {
    const { result } = renderHook(() =>
      useVoteModal(mockSigner, makeProposal(), mockOnVoted),
    );
    act(() => result.current.open());

    await act(async () => {
      await result.current.submitVote(true);
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("submitVote define voteError quando contract.vote lança erro", async () => {
    mockVote.mockRejectedValueOnce(
      new Error("GovernanceDAO__AlreadyVoted(1, 0xabc)"),
    );

    const { result } = renderHook(() =>
      useVoteModal(mockSigner, makeProposal(), mockOnVoted),
    );

    act(() => result.current.open());

    await act(async () => {
      await result.current.submitVote(true);
    });

    expect(result.current.voteError).toBeTruthy();
    expect(result.current.isOpen).toBe(true);
  });

  it("close() limpa voteError", async () => {
    mockVote.mockRejectedValueOnce(new Error("GovernanceDAO__VotingEnded(1)"));

    const { result } = renderHook(() =>
      useVoteModal(mockSigner, makeProposal(), mockOnVoted),
    );

    await act(async () => {
      await result.current.submitVote(true);
    });

    expect(result.current.voteError).toBeTruthy();

    act(() => result.current.close());

    expect(result.current.voteError).toBeNull();
  });
});
