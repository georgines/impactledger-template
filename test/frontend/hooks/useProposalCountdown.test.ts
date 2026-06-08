import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProposalCountdown } from "@/hooks/useProposalCountdown";

// ============================================================================
// useProposalCountdown
// Regra: atualiza a cada segundo; quando expirado retorna expired=true
// e display="Expirada"; cleanup no unmount.
// ============================================================================

describe("useProposalCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Caminho feliz: prazo no futuro ---

  it("retorna expired=false quando deadline está no futuro", () => {
    const future = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const { result } = renderHook(() => useProposalCountdown(future));

    expect(result.current.expired).toBe(false);
  });

  it("retorna secondsLeft positivo quando deadline está no futuro", () => {
    const future = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const { result } = renderHook(() => useProposalCountdown(future));

    expect(result.current.secondsLeft).toBeGreaterThan(0);
  });

  it("display não é 'Expirada' quando deadline está no futuro", () => {
    const future = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const { result } = renderHook(() => useProposalCountdown(future));

    expect(result.current.display).not.toBe("Expirada");
  });

  it("display contém segundos quando faltam menos de 1 minuto", () => {
    const future = BigInt(Math.floor(Date.now() / 1000) + 45);
    const { result } = renderHook(() => useProposalCountdown(future));

    expect(result.current.display).toMatch(/45s/);
  });

  it("display inclui horas, minutos e segundos quando faltam mais de 1 hora", () => {
    const future = BigInt(
      Math.floor(Date.now() / 1000) + 2 * 3600 + 30 * 60 + 15,
    );
    const { result } = renderHook(() => useProposalCountdown(future));

    expect(result.current.display).toMatch(/2h/);
    expect(result.current.display).toMatch(/30min/);
    expect(result.current.display).toMatch(/15s/);
  });

  it("display inclui minutos e segundos quando falta menos de 1 hora", () => {
    const future = BigInt(Math.floor(Date.now() / 1000) + 5 * 60 + 20);
    const { result } = renderHook(() => useProposalCountdown(future));

    expect(result.current.display).toMatch(/5min/);
    expect(result.current.display).toMatch(/20s/);
  });

  // --- Caminho feliz: deadline passado ---

  it("retorna expired=true quando deadline já passou", () => {
    const past = BigInt(Math.floor(Date.now() / 1000) - 1);
    const { result } = renderHook(() => useProposalCountdown(past));

    expect(result.current.expired).toBe(true);
  });

  it("retorna secondsLeft=0 quando deadline já passou", () => {
    const past = BigInt(Math.floor(Date.now() / 1000) - 10);
    const { result } = renderHook(() => useProposalCountdown(past));

    expect(result.current.secondsLeft).toBe(0);
  });

  it("display é 'Expirada' quando deadline já passou", () => {
    const past = BigInt(Math.floor(Date.now() / 1000) - 1);
    const { result } = renderHook(() => useProposalCountdown(past));

    expect(result.current.display).toBe("Expirada");
  });

  // --- Transição: contador chega a zero durante o ciclo de vida ---

  it("expired muda para true quando o tempo expira durante tick do interval", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    // deadline em 2 segundos
    const deadline = BigInt(nowSeconds + 2);
    const { result } = renderHook(() => useProposalCountdown(deadline));

    expect(result.current.expired).toBe(false);

    act(() => {
      vi.advanceTimersByTime(3000); // avança 3s
    });

    expect(result.current.expired).toBe(true);
    expect(result.current.display).toBe("Expirada");
  });

  it("secondsLeft decrementa a cada segundo", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const deadline = BigInt(nowSeconds + 10);
    const { result } = renderHook(() => useProposalCountdown(deadline));

    const initial = result.current.secondsLeft;

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.secondsLeft).toBeLessThan(initial);
  });

  // --- Cleanup: interval cancelado no unmount ---

  it("não lança erro após unmount quando timer dispara", () => {
    const future = BigInt(Math.floor(Date.now() / 1000) + 60);
    const { unmount } = renderHook(() => useProposalCountdown(future));

    unmount();

    // Não deve lançar exceção após unmount
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    }).not.toThrow();
  });

  // --- Reatividade a mudança de deadline ---

  it("recalcula quando deadline muda", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const future = BigInt(nowSeconds + 3600);
    const past = BigInt(nowSeconds - 1);

    const { result, rerender } = renderHook(
      ({ deadline }: { deadline: bigint }) => useProposalCountdown(deadline),
      { initialProps: { deadline: future } },
    );

    expect(result.current.expired).toBe(false);

    rerender({ deadline: past });

    expect(result.current.expired).toBe(true);
    expect(result.current.display).toBe("Expirada");
  });
});
