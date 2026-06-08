import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@test/utils/render";
import { redirect, usePathname } from "next/navigation";
import { WalletContext } from "@/components/providers/WalletProvider";
import type { WalletContextValue } from "@/components/providers/WalletProvider";
import type { Role } from "@/hooks/useActorRole";
import { RouteGuard } from "@/components/layout/RouteGuard";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/inicio"),
  useRouter: vi
    .fn()
    .mockReturnValue({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  redirect: vi.fn(),
}));

function buildContext(
  role: Role,
  address: string | null = null,
): WalletContextValue {
  return {
    address,
    provider: null,
    signer: null,
    role,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function renderGuard(role: Role, address: string | null, pathname: string) {
  vi.mocked(usePathname).mockReturnValue(pathname);
  return render(
    <WalletContext.Provider value={buildContext(role, address)}>
      <RouteGuard>
        <span data-testid="content">conteúdo</span>
      </RouteGuard>
    </WalletContext.Provider>,
  );
}

describe("RouteGuard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza children quando papel tem permissão na rota", () => {
    renderGuard("doador", "0xabc", "/fazer-doacao");
    expect(screen.getByTestId("content")).toBeDefined();
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });

  it("redireciona para /inicio quando papel não tem permissão", () => {
    renderGuard("operador", "0xabc", "/fazer-doacao");
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/inicio");
    expect(screen.queryByTestId("content")).toBeNull();
  });

  it("renderiza WalletRequired quando carteira não conectada", () => {
    renderGuard(null, null, "/fazer-doacao");
    expect(
      screen.getByText("Conecte sua carteira para continuar."),
    ).toBeDefined();
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });

  it("renderiza loading enquanto role é null com carteira conectada", () => {
    renderGuard(null, "0xabc", "/fazer-doacao");
    expect(screen.queryByTestId("content")).toBeNull();
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });

  it("renderiza children em rota não mapeada", () => {
    renderGuard("doador", "0xabc", "/rota-desconhecida");
    expect(screen.getByTestId("content")).toBeDefined();
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });
});
