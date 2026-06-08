import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@test/utils/render";
import { WalletContext } from "@/components/providers/WalletProvider";
import type { WalletContextValue } from "@/components/providers/WalletProvider";
import PagesLayout from "@/app/(pages)/layout";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/dashboard"),
  useRouter: vi
    .fn()
    .mockReturnValue({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  redirect: vi.fn(),
}));

const ctxDoador: WalletContextValue = {
  address: "0xabc123",
  provider: null,
  signer: null,
  role: "doador",
  connect: vi.fn(),
  disconnect: vi.fn(),
};

describe("PagesLayout", () => {
  it("renderiza os filhos dentro do shell", () => {
    render(
      <WalletContext.Provider value={ctxDoador}>
        <PagesLayout>
          <span data-testid="page">conteúdo</span>
        </PagesLayout>
      </WalletContext.Provider>,
    );
    expect(screen.getByTestId("page")).toBeDefined();
  });

  it("renderiza a navegação lateral", () => {
    render(
      <WalletContext.Provider value={ctxDoador}>
        <PagesLayout>
          <div />
        </PagesLayout>
      </WalletContext.Provider>,
    );
    expect(screen.getByText("EloSolidário")).toBeDefined();
  });
});
