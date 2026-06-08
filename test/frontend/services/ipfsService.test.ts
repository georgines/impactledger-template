import { describe, it, expect, vi, afterEach } from "vitest";
import {
  uploadToIPFS,
  uploadToIPFSAsBytes32,
  listIpfsFiles,
  getIpfsGatewayUrl,
  fetchFromIPFSByBytes32,
} from "@/services/ipfsService";

describe("ipfsService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("uploadToIPFS", () => {
    it("envia POST para /api/ipfs/upload e retorna CID", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ cid: "QmCustomCID" }),
        }),
      );

      const cid = await uploadToIPFS("conteúdo");

      expect(fetch).toHaveBeenCalledWith(
        "/api/ipfs/upload",
        expect.objectContaining({ method: "POST" }),
      );
      expect(cid).toBe("QmCustomCID");
    });

    it("aceita Blob como conteúdo", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ cid: "QmBlobCID" }),
        }),
      );
      const blob = new Blob(["dados binários"], {
        type: "application/octet-stream",
      });

      await expect(uploadToIPFS(blob)).resolves.toBe("QmBlobCID");
    });

    it("lança erro em resposta não-ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        }),
      );

      await expect(uploadToIPFS("conteúdo")).rejects.toThrow(
        "Upload IPFS falhou",
      );
    });
  });

  describe("uploadToIPFSAsBytes32", () => {
    it("retorna string no formato bytes32 (0x + 64 hex)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              cid: "QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB",
            }),
        }),
      );

      const result = await uploadToIPFSAsBytes32("conteúdo");

      expect(result).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });

  describe("listIpfsFiles", () => {
    it("faz GET para /api/ipfs/files e retorna lista", async () => {
      const fakeFiles = [
        {
          id: "1",
          cid: "QmFile1",
          name: "f.json",
          size: 10,
          createdAt: "2024-01-01",
          gatewayUrl: "https://gateway.pinata.cloud/ipfs/QmFile1",
        },
      ];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(fakeFiles),
        }),
      );

      const result = await listIpfsFiles();

      expect(fetch).toHaveBeenCalledWith("/api/ipfs/files");
      expect(result).toEqual(fakeFiles);
    });

    it("repassa parâmetro limit na URL", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        }),
      );

      await listIpfsFiles({ limit: 5 });

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("limit=5"));
    });

    it("repassa parâmetro name na URL", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        }),
      );

      await listIpfsFiles({ name: "prova" });

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("name=prova"));
    });

    it("lança erro em resposta não-ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          statusText: "Forbidden",
        }),
      );

      await expect(listIpfsFiles()).rejects.toThrow("Listagem IPFS falhou");
    });
  });

  describe("getIpfsGatewayUrl", () => {
    it("retorna URL do gateway padrão para CID", () => {
      const url = getIpfsGatewayUrl("QmAlgumCID");

      expect(url).toBe("https://gateway.pinata.cloud/ipfs/QmAlgumCID");
    });
  });

  describe("fetchFromIPFSByBytes32", () => {
    const VALID_BYTES32 =
      "0x" + "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

    it("faz GET em /api/ipfs/fetch/{cid} convertido do bytes32", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              title: "Compra",
              description: "Desc",
              createdAt: "2026-05-28",
            }),
        }),
      );

      await fetchFromIPFSByBytes32(VALID_BYTES32);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/ipfs\/fetch\/b[a-z2-7]+/),
      );
    });

    it("retorna objeto IpfsMetadata com title, description e createdAt", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              title: "Cestas básicas",
              description: "100 cestas para famílias",
              createdAt: "2026-05-28",
            }),
        }),
      );

      const metadata = await fetchFromIPFSByBytes32(VALID_BYTES32);

      expect(metadata).toEqual({
        title: "Cestas básicas",
        description: "100 cestas para famílias",
        createdAt: "2026-05-28",
      });
    });

    it("lança erro em resposta não-ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: "Not Found",
        }),
      );

      await expect(fetchFromIPFSByBytes32(VALID_BYTES32)).rejects.toThrow(
        "Fetch IPFS falhou",
      );
    });
  });
});
