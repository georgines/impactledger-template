import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PinataProvider } from "@/services/ipfs/pinataProvider";

const UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";
const FILES_URL = "https://api.pinata.cloud/v3/files";
const GATEWAY_BASE = "https://gateway.pinata.cloud/ipfs";

describe("PinataProvider", () => {
  let provider: PinataProvider;

  beforeEach(() => {
    provider = new PinataProvider("meu-jwt-secreto");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("upload", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { cid: "QmTestHash123456789012345678901234567890123" },
            }),
        }),
      );
    });

    it("envia POST para a API de upload Pinata v3", async () => {
      await provider.upload("conteúdo de teste");
      expect(fetch).toHaveBeenCalledWith(
        UPLOAD_URL,
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("envia Authorization Bearer com o JWT", async () => {
      await provider.upload("conteúdo de teste");
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer meu-jwt-secreto",
          }),
        }),
      );
    });

    it("retorna o CID do campo data.cid", async () => {
      const cid = await provider.upload("conteúdo de teste");
      expect(cid).toBe("QmTestHash123456789012345678901234567890123");
    });

    it("aceita Blob como conteúdo", async () => {
      const blob = new Blob(["dados binários"], {
        type: "application/octet-stream",
      });
      await expect(provider.upload(blob)).resolves.toBeDefined();
    });

    it("envia network=public no form por padrão", async () => {
      await provider.upload("conteúdo de teste");
      const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = call[1].body as FormData;
      expect(body.get("network")).toBe("public");
    });

    it("envia network=private no form quando especificado", async () => {
      await provider.upload("conteúdo de teste", "file.json", "private");
      const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = call[1].body as FormData;
      expect(body.get("network")).toBe("private");
    });

    it("lança erro em resposta HTTP não-ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
        }),
      );
      await expect(provider.upload("teste")).rejects.toThrow(
        "Upload IPFS falhou",
      );
    });
  });

  describe("listFiles", () => {
    const fakePinataResponse = {
      data: {
        files: [
          {
            id: "abc123",
            cid: "QmFile1",
            name: "file1.json",
            size: 100,
            created_at: "2024-01-01",
          },
          {
            id: "def456",
            cid: "QmFile2",
            name: "file2.json",
            size: 200,
            created_at: "2024-01-02",
          },
        ],
      },
    };

    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(fakePinataResponse),
        }),
      );
    });

    it("faz GET para a API de arquivos Pinata v3", async () => {
      await provider.listFiles();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(FILES_URL),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer meu-jwt-secreto",
          }),
        }),
      );
    });

    it("retorna lista de arquivos mapeados", async () => {
      const files = await provider.listFiles();
      expect(files).toHaveLength(2);
      expect(files[0]).toEqual({
        id: "abc123",
        cid: "QmFile1",
        name: "file1.json",
        size: 100,
        createdAt: "2024-01-01",
        gatewayUrl: `${GATEWAY_BASE}/QmFile1`,
      });
    });

    it("envia parâmetro limit quando fornecido", async () => {
      await provider.listFiles({ limit: 10 });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=10"),
        expect.any(Object),
      );
    });

    it("envia parâmetro name quando fornecido", async () => {
      await provider.listFiles({ name: "impact" });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("name=impact"),
        expect.any(Object),
      );
    });

    it("envia network=public por padrão", async () => {
      await provider.listFiles();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("network=public"),
        expect.any(Object),
      );
    });

    it("envia network=private quando especificado", async () => {
      await provider.listFiles({ network: "private" });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("network=private"),
        expect.any(Object),
      );
    });

    it("envia parâmetro cid quando fornecido", async () => {
      await provider.listFiles({ cid: "QmSomeCID" });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("cid=QmSomeCID"),
        expect.any(Object),
      );
    });

    it("lança erro em resposta HTTP não-ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          statusText: "Forbidden",
        }),
      );
      await expect(provider.listFiles()).rejects.toThrow(
        "Listagem IPFS falhou",
      );
    });
  });

  describe("getGatewayUrl", () => {
    it("retorna URL pública do gateway para um CID", () => {
      const url = provider.getGatewayUrl("QmSomeCID");
      expect(url).toBe(`${GATEWAY_BASE}/QmSomeCID`);
    });

    it("retorna URL pública quando network='public'", () => {
      const url = provider.getGatewayUrl("QmSomeCID", "public");
      expect(url).toBe(`${GATEWAY_BASE}/QmSomeCID`);
    });

    it("retorna URL privada com /files/<cid> quando network='private'", () => {
      const custom = new PinataProvider(
        "meu-jwt-secreto",
        "https://meu-gateway.mypinata.cloud/ipfs",
      );
      const url = custom.getGatewayUrl("QmSomeCID", "private");
      expect(url).toBe("https://meu-gateway.mypinata.cloud/files/QmSomeCID");
    });
  });

  describe("fetch", () => {
    it("faz GET para URL do gateway com o CID e Authorization Bearer", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ title: "Teste" }),
        }),
      );
      await provider.fetch("QmSomeCID");
      expect(fetch).toHaveBeenCalledWith(
        `${GATEWAY_BASE}/QmSomeCID`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer meu-jwt-secreto",
          }),
        }),
      );
    });

    it("retorna dados JSON da resposta", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              title: "Compra de cestas",
              description: "100 cestas para famílias",
              createdAt: "2026-05-28",
            }),
        }),
      );
      const data = await provider.fetch("QmSomeCID");
      expect(data).toEqual({
        title: "Compra de cestas",
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
      await expect(provider.fetch("QmSomeCID")).rejects.toThrow(
        "Fetch IPFS falhou",
      );
    });

    it("usa URL /files/<cid> no gateway quando network='private'", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ title: "Privado" }),
        }),
      );
      const custom = new PinataProvider(
        "meu-jwt-secreto",
        "https://meu-gateway.mypinata.cloud/ipfs",
      );
      await custom.fetch("QmSomeCID", "private");
      expect(fetch).toHaveBeenCalledWith(
        "https://meu-gateway.mypinata.cloud/files/QmSomeCID",
        expect.any(Object),
      );
    });
  });
});
