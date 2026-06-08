import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import {
  WalletProvider,
  useWalletContext,
} from "@/components/providers/WalletProvider";

// ----- hoisted mocks -----
const { mockConnectWallet, mockGetSigner, mockGetAddress, mockEthAccounts } =
  vi.hoisted(() => ({
    mockConnectWallet: vi.fn(),
    mockGetSigner: vi.fn(),
    mockGetAddress: vi.fn(),
    mockEthAccounts: vi.fn(),
  }));

vi.mock("@/services/walletService", () => ({
  connectWallet: mockConnectWallet,
}));

vi.mock("@/hooks/useActorRole", () => ({
  useActorRole: vi.fn().mockReturnValue("doador"),
}));

const MOCK_ADDRESS = "0xABC0000000000000000000000000000000000001";

function buildProvider() {
  const signer = { getAddress: mockGetAddress };
  const provider = { getSigner: mockGetSigner };
  mockGetSigner.mockResolvedValue(signer);
  mockGetAddress.mockResolvedValue(MOCK_ADDRESS);
  mockConnectWallet.mockResolvedValue(provider);
  return provider;
}

function setupEthereum(accounts: string[]) {
  Object.defineProperty(window, "ethereum", {
    value: {
      request: mockEthAccounts.mockResolvedValue(accounts),
      on: vi.fn(),
      removeListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
}

function AddressProbe() {
  const { address } = useWalletContext();
  return <span data-testid="address">{address ?? "desconectado"}</span>;
}

describe("WalletProvider — auto-connect no mount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "ethereum", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  function renderProvider() {
    return render(
      <MantineProvider>
        <WalletProvider>
          <AddressProbe />
        </WalletProvider>
      </MantineProvider>,
    );
  }

  it("permanece desconectado quando nao ha window.ethereum", async () => {
    const { getByTestId } = renderProvider();

    await waitFor(() => {
      expect(getByTestId("address").textContent).toBe("desconectado");
    });

    expect(mockConnectWallet).not.toHaveBeenCalled();
  });

  it("permanece desconectado quando eth_accounts retorna lista vazia", async () => {
    buildProvider();
    setupEthereum([]);

    const { getByTestId } = renderProvider();

    await waitFor(() => {
      expect(getByTestId("address").textContent).toBe("desconectado");
    });

    expect(mockConnectWallet).not.toHaveBeenCalled();
  });

  it("reconecta automaticamente no mount quando eth_accounts tem contas", async () => {
    buildProvider();
    setupEthereum([MOCK_ADDRESS]);

    const { getByTestId } = renderProvider();

    await waitFor(() => {
      expect(getByTestId("address").textContent).toBe(MOCK_ADDRESS);
    });

    expect(mockConnectWallet).toHaveBeenCalledOnce();
  });

  it("nao exibe popup ao reconectar — usa eth_accounts nao eth_requestAccounts", async () => {
    buildProvider();
    setupEthereum([MOCK_ADDRESS]);

    renderProvider();

    await waitFor(() => {
      expect(mockEthAccounts).toHaveBeenCalledWith({ method: "eth_accounts" });
    });
  });
});
