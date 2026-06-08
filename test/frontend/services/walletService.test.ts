import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSend, MockBrowserProvider } = vi.hoisted(() => {
  const mockSend = vi.fn().mockResolvedValue([]);
  const MockBrowserProvider = vi.fn().mockImplementation(
    class {
      send = mockSend;
    },
  );
  return { mockSend, MockBrowserProvider };
});

vi.mock("ethers", () => ({
  BrowserProvider: MockBrowserProvider,
}));

import { connectWallet } from "@/services/walletService";

describe("walletService", () => {
  beforeEach(() => {
    mockSend.mockClear();
    MockBrowserProvider.mockClear();
    (window as Window & { ethereum?: unknown }).ethereum = undefined;
  });

  afterEach(() => {
    (window as Window & { ethereum?: unknown }).ethereum = undefined;
  });

  describe("connectWallet", () => {
    it("lança erro quando window.ethereum não está disponível", async () => {
      await expect(connectWallet()).rejects.toThrow(
        "Nenhum aplicativo de carteira digital encontrado",
      );
    });

    it("cria BrowserProvider com window.ethereum", async () => {
      const mockEthereum = { isMetaMask: true };
      (window as Window & { ethereum?: unknown }).ethereum = mockEthereum;

      await connectWallet();

      expect(MockBrowserProvider).toHaveBeenCalledWith(mockEthereum);
    });

    it("chama eth_requestAccounts no provider", async () => {
      (window as Window & { ethereum?: unknown }).ethereum = {};

      await connectWallet();

      expect(mockSend).toHaveBeenCalledWith("eth_requestAccounts", []);
    });

    it("retorna o provider instanciado com método send", async () => {
      (window as Window & { ethereum?: unknown }).ethereum = {};

      const result = await connectWallet();

      expect(result).toHaveProperty("send");
    });
  });
});
