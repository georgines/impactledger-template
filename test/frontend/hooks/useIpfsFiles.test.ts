import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIpfsFiles } from "@/hooks/useIpfsFiles";

const { mockListFiles } = vi.hoisted(() => ({
  mockListFiles: vi.fn(),
}));

vi.mock("@/services/ipfsService", () => ({
  listIpfsFiles: mockListFiles,
}));

const fakeFiles = [
  {
    id: "1",
    cid: "QmFile1",
    name: "file1.json",
    size: 100,
    createdAt: "2024-01-01",
    gatewayUrl: "https://gateway.pinata.cloud/ipfs/QmFile1",
  },
];

describe("useIpfsFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListFiles.mockResolvedValue(fakeFiles);
  });

  it("estado inicial tem loading false, files vazio e error null", () => {
    const { result } = renderHook(() => useIpfsFiles());

    expect(result.current.loading).toBe(false);
    expect(result.current.files).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("fetchFiles atualiza a lista de arquivos", async () => {
    const { result } = renderHook(() => useIpfsFiles());

    await act(async () => {
      await result.current.fetchFiles();
    });

    expect(result.current.files).toEqual(fakeFiles);
    expect(result.current.loading).toBe(false);
  });

  it("fetchFiles repassa opções para o serviço", async () => {
    const { result } = renderHook(() => useIpfsFiles());

    await act(async () => {
      await result.current.fetchFiles({ limit: 5 });
    });

    expect(mockListFiles).toHaveBeenCalledWith({ limit: 5 });
  });

  it("define error quando fetchFiles falha", async () => {
    mockListFiles.mockRejectedValueOnce(new Error("Erro de rede"));
    const { result } = renderHook(() => useIpfsFiles());

    await act(async () => {
      await result.current.fetchFiles().catch(() => {});
    });

    expect(result.current.error).toBe("Erro de rede");
    expect(result.current.loading).toBe(false);
  });

  it("loading é false após fetchFiles concluído", async () => {
    const { result } = renderHook(() => useIpfsFiles());

    await act(async () => {
      await result.current.fetchFiles();
    });

    expect(result.current.loading).toBe(false);
  });
});
