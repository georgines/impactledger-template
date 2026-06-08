import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIpfsUpload } from "@/hooks/useIpfsUpload";

const { mockUpload, mockUploadAsBytes32 } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockUploadAsBytes32: vi.fn(),
}));

vi.mock("@/services/ipfsService", () => ({
  uploadToIPFS: mockUpload,
  uploadToIPFSAsBytes32: mockUploadAsBytes32,
}));

describe("useIpfsUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue("QmTestCID");
    mockUploadAsBytes32.mockResolvedValue("0x" + "ab".repeat(32));
  });

  it("estado inicial tem loading false e error null", () => {
    const { result } = renderHook(() => useIpfsUpload());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("upload retorna o CID", async () => {
    const { result } = renderHook(() => useIpfsUpload());

    let cid!: string;
    await act(async () => {
      cid = await result.current.upload("conteúdo");
    });

    expect(cid).toBe("QmTestCID");
    expect(mockUpload).toHaveBeenCalledWith("conteúdo");
  });

  it("uploadAsBytes32 retorna bytes32", async () => {
    const { result } = renderHook(() => useIpfsUpload());

    let hash!: string;
    await act(async () => {
      hash = await result.current.uploadAsBytes32("conteúdo");
    });

    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(mockUploadAsBytes32).toHaveBeenCalledWith("conteúdo");
  });

  it("define error quando upload falha", async () => {
    mockUpload.mockRejectedValueOnce(new Error("Falha na rede"));
    const { result } = renderHook(() => useIpfsUpload());

    await act(async () => {
      await result.current.upload("conteúdo").catch(() => {});
    });

    expect(result.current.error).toBe("Falha na rede");
  });

  it("loading é false após upload concluído", async () => {
    const { result } = renderHook(() => useIpfsUpload());

    await act(async () => {
      await result.current.upload("conteúdo");
    });

    expect(result.current.loading).toBe(false);
  });

  it("loading é false após upload com erro", async () => {
    mockUpload.mockRejectedValueOnce(new Error("erro"));
    const { result } = renderHook(() => useIpfsUpload());

    await act(async () => {
      await result.current.upload("conteúdo").catch(() => {});
    });

    expect(result.current.loading).toBe(false);
  });
});
