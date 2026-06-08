import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFetchWithRefresh } from "@/hooks/useFetchWithRefresh";

const mockFetch = vi.fn<() => Promise<string[]>>();

describe("useFetchWithRefresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não busca quando enabled=false", () => {
    renderHook(() => useFetchWithRefresh(mockFetch, false, "Erro"));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("loading fica false quando enabled=false", () => {
    const { result } = renderHook(() =>
      useFetchWithRefresh(mockFetch, false, "Erro"),
    );
    expect(result.current.loading).toBe(false);
  });

  it("busca imediatamente quando enabled=true", async () => {
    mockFetch.mockResolvedValue([]);
    renderHook(() => useFetchWithRefresh(mockFetch, true, "Erro"));
    await act(async () => {});
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("loading=true enquanto busca e false após", async () => {
    mockFetch.mockResolvedValue([]);
    const { result } = renderHook(() =>
      useFetchWithRefresh(mockFetch, true, "Erro"),
    );
    expect(result.current.loading).toBe(true);
    await act(async () => {});
    expect(result.current.loading).toBe(false);
  });

  it("retorna dados ao buscar com sucesso", async () => {
    mockFetch.mockResolvedValue(["a", "b"]);
    const { result } = renderHook(() =>
      useFetchWithRefresh(mockFetch, true, "Erro"),
    );
    await act(async () => {});
    expect(result.current.data).toEqual(["a", "b"]);
    expect(result.current.error).toBeNull();
  });

  it("define error quando fetch lança exceção", async () => {
    mockFetch.mockRejectedValue(new Error("Falha de rede"));
    const { result } = renderHook(() =>
      useFetchWithRefresh(mockFetch, true, "Erro fallback"),
    );
    await act(async () => {});
    expect(result.current.error).toBe("Falha de rede");
    expect(result.current.data).toEqual([]);
  });

  it("usa mensagem fallback quando erro não é Error", async () => {
    mockFetch.mockRejectedValue("string de erro");
    const { result } = renderHook(() =>
      useFetchWithRefresh(mockFetch, true, "Erro fallback"),
    );
    await act(async () => {});
    expect(result.current.error).toBe("Erro fallback");
  });

  it("refetch dispara nova busca", async () => {
    mockFetch.mockResolvedValue(["a"]);
    const { result } = renderHook(() =>
      useFetchWithRefresh(mockFetch, true, "Erro"),
    );
    await act(async () => {});
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockResolvedValue(["a", "b"]);
    await act(async () => {
      result.current.refetch();
    });
    await act(async () => {});

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(["a", "b"]);
  });

  it("limpa error em refetch bem-sucedido", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Erro inicial"));
    const { result } = renderHook(() =>
      useFetchWithRefresh(mockFetch, true, "Erro"),
    );
    await act(async () => {});
    expect(result.current.error).toBe("Erro inicial");

    mockFetch.mockResolvedValue(["ok"]);
    await act(async () => {
      result.current.refetch();
    });
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
