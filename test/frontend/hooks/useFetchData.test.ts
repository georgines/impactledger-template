import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useFetchData } from "@/hooks/useFetchData";

const mockFetch = vi.fn<() => Promise<string[]>>();

describe("useFetchData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não busca quando enabled=false", () => {
    renderHook(() => useFetchData(mockFetch, false, "Erro"));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("estado inicial tem data=[], loading=false, error=null quando disabled", () => {
    const { result } = renderHook(() => useFetchData(mockFetch, false, "Erro"));
    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("busca ao receber enabled=true", async () => {
    mockFetch.mockResolvedValue([]);
    renderHook(() => useFetchData(mockFetch, true, "Erro"));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
  });

  it("retorna dados ao buscar com sucesso", async () => {
    mockFetch.mockResolvedValue(["x", "y"]);
    const { result } = renderHook(() => useFetchData(mockFetch, true, "Erro"));
    await waitFor(() => expect(result.current.data).toEqual(["x", "y"]));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("define error quando fetch lança exceção", async () => {
    mockFetch.mockRejectedValue(new Error("Falha ao buscar"));
    const { result } = renderHook(() =>
      useFetchData(mockFetch, true, "Erro fallback"),
    );
    await waitFor(() => expect(result.current.error).toBe("Falha ao buscar"));
    expect(result.current.loading).toBe(false);
  });

  it("usa mensagem fallback quando erro não é Error", async () => {
    mockFetch.mockRejectedValue("erro primitivo");
    const { result } = renderHook(() =>
      useFetchData(mockFetch, true, "Erro fallback"),
    );
    await waitFor(() => expect(result.current.error).toBe("Erro fallback"));
  });

  it("refetch dispara nova busca e atualiza dados", async () => {
    mockFetch.mockResolvedValue(["primeiro"]);
    const { result } = renderHook(() => useFetchData(mockFetch, true, "Erro"));
    await waitFor(() => expect(result.current.data).toEqual(["primeiro"]));

    mockFetch.mockResolvedValue(["segundo"]);
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.data).toEqual(["segundo"]));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("limpa error em refetch bem-sucedido", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Erro inicial"));
    const { result } = renderHook(() => useFetchData(mockFetch, true, "Erro"));
    await waitFor(() => expect(result.current.error).toBe("Erro inicial"));

    mockFetch.mockResolvedValue(["ok"]);
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
