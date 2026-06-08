import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@test/utils/render";
import { useRouter } from "next/navigation";
import RootPage from "@/app/page";
import { WalletContext } from "@/components/providers/WalletProvider";
import type { WalletContextValue } from "@/components/providers/WalletProvider";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/"),
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  redirect: vi.fn(),
}));

function buildContext(
  overrides: Partial<WalletContextValue> = {},
): WalletContextValue {
  return {
    address: null,
    provider: null,
    signer: null,
    role: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...overrides,
  };
}

function renderPage(overrides: Partial<WalletContextValue> = {}) {
  return render(
    <WalletContext.Provider value={buildContext(overrides)}>
      <RootPage />
    </WalletContext.Provider>,
  );
}

describe("RootPage", () => {
  describe("estrutura da landing page", () => {
    it("exibe o logo EloSolidário", () => {
      renderPage();
      expect(screen.getByText("EloSolidário")).toBeDefined();
    });

    it("exibe o botão Conectar Carteira", () => {
      renderPage();
      expect(
        screen.getByRole("button", { name: /conectar carteira/i }),
      ).toBeDefined();
    });

    it("não exibe mensagem de erro inicialmente", () => {
      renderPage();
      expect(screen.queryByTestId("connect-error")).toBeNull();
    });
  });

  describe("TC-W01 — conexão bem-sucedida", () => {
    it("chama connect() e redireciona para /inicio", async () => {
      const connect = vi.fn().mockResolvedValue(undefined);
      const pushMock = vi.fn();
      vi.mocked(useRouter).mockReturnValueOnce({
        push: pushMock,
        replace: vi.fn(),
        prefetch: vi.fn(),
      });
      renderPage({ connect });
      fireEvent.click(
        screen.getByRole("button", { name: /conectar carteira/i }),
      );
      await waitFor(() => {
        expect(connect).toHaveBeenCalledOnce();
        expect(pushMock).toHaveBeenCalledWith("/inicio");
      });
    });
  });

  describe("TC-W03 — rejeição de conexão", () => {
    it("exibe aviso de rejeição quando usuário recusa a conexão", async () => {
      const connect = vi
        .fn()
        .mockRejectedValue(new Error("User rejected the request"));
      renderPage({ connect });
      fireEvent.click(
        screen.getByRole("button", { name: /conectar carteira/i }),
      );
      await waitFor(() => {
        expect(screen.getByTestId("connect-error")).toBeDefined();
        expect(screen.getByText(/rejeitad/i)).toBeDefined();
      });
    });
  });

  describe("TC-W02 — sem carteira instalada", () => {
    it("exibe mensagem de instalação quando carteira não encontrada", async () => {
      const connect = vi
        .fn()
        .mockRejectedValue(new Error("Nenhuma carteira Web3 encontrada"));
      renderPage({ connect });
      fireEvent.click(
        screen.getByRole("button", { name: /conectar carteira/i }),
      );
      await waitFor(() => {
        expect(screen.getByTestId("connect-error")).toBeDefined();
        expect(screen.getByText(/instale/i)).toBeDefined();
      });
    });
  });
});
