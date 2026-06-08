import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@test/utils/render";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { WalletContext } from "@/components/providers/WalletProvider";
import type { WalletContextValue } from "@/components/providers/WalletProvider";
import type { Role } from "@/hooks/useActorRole";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/dashboard"),
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
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

function renderShell(
  role: Role,
  address: string | null = role ? "0xabc123def456" : null,
) {
  return render(
    <WalletContext.Provider value={buildContext(role, address)}>
      <DashboardShell>
        <div />
      </DashboardShell>
    </WalletContext.Provider>,
  );
}

describe("DashboardShell", () => {
  describe("estrutura do shell", () => {
    it("renderiza o nome da plataforma no header", () => {
      renderShell("doador");
      expect(screen.getByText("EloSolidário")).toBeDefined();
    });

    it("renderiza o botão de conectar carteira quando desconectado", () => {
      renderShell(null);
      expect(screen.getByTestId("connect-wallet")).toBeDefined();
      expect(screen.getByText("Conectar Carteira")).toBeDefined();
    });

    it("exibe o endereço abreviado no botão quando conectado", () => {
      renderShell("doador", "0xabc123def456");
      expect(screen.getByTestId("connect-wallet")).toBeDefined();
      expect(screen.getByText("0xabc1...f456")).toBeDefined();
    });

    it("renderiza o conteúdo filho na área principal", () => {
      render(
        <WalletContext.Provider
          value={buildContext("doador", "0xabc123def456")}
        >
          <DashboardShell>
            <span data-testid="page-content">conteúdo da página</span>
          </DashboardShell>
        </WalletContext.Provider>,
      );
      expect(screen.getByTestId("page-content")).toBeDefined();
    });
  });

  describe("itens comuns a todos os papéis autenticados", () => {
    it.each(["operador", "doador", "instituicao", "fornecedor"] as Role[])(
      "papel %s vê Início",
      (role) => {
        renderShell(role);
        expect(screen.getByText("Início")).toBeDefined();
      },
    );
  });

  describe("papel: operador", () => {
    it("exibe votações", () => {
      renderShell("operador");
      expect(screen.getByText("Votações")).toBeDefined();
      expect(screen.getByText("Propostas em Votação")).toBeDefined();
      expect(screen.getByText("Histórico de Votações")).toBeDefined();
    });

    it("oculta Doações, Pedidos e Disputas", () => {
      renderShell("operador");
      expect(screen.queryByText("Fazer Doação")).toBeNull();
      expect(screen.queryByText("Pedidos de Compra")).toBeNull();
      expect(screen.queryByText("Disputas Ativas")).toBeNull();
      expect(screen.queryByText("Minhas Disputas")).toBeNull();
    });

    it("exibe links de cadastro de instituição e fornecedor", () => {
      renderShell("operador");
      expect(screen.getByText("Cadastrar Instituição")).toBeDefined();
      expect(screen.getByText("Cadastrar Fornecedor")).toBeDefined();
    });
  });

  describe("papel: doador", () => {
    it("exibe Doações e Disputas Ativas", () => {
      renderShell("doador");
      expect(screen.getByText("Doações")).toBeDefined();
      expect(screen.getByText("Fazer Doação")).toBeDefined();
      expect(screen.getByText("Minhas Doações")).toBeDefined();
      expect(screen.getByText("Disputas")).toBeDefined();
      expect(screen.getByText("Disputas Ativas")).toBeDefined();
    });

    it("exibe votações", () => {
      renderShell("doador");
      expect(screen.getByText("Propostas em Votação")).toBeDefined();
      expect(screen.getByText("Histórico de Votações")).toBeDefined();
    });

    it("oculta Pedidos e Minhas Disputas", () => {
      renderShell("doador");
      expect(screen.queryByText("Pedidos de Compra")).toBeNull();
      expect(screen.queryByText("Minhas Entregas")).toBeNull();
      expect(screen.queryByText("Minhas Disputas")).toBeNull();
    });
  });

  describe("papel: instituicao", () => {
    it("exibe Pedidos e Minhas Disputas", () => {
      renderShell("instituicao");
      expect(screen.getByText("Pedidos")).toBeDefined();
      expect(screen.getByText("Meus Pedidos de Compra")).toBeDefined();
      expect(screen.getByText("Novo Pedido")).toBeDefined();
      expect(screen.getByText("Meus Recebimentos")).toBeDefined();
      expect(screen.getByText("Disputas")).toBeDefined();
      expect(screen.getByText("Minhas Disputas")).toBeDefined();
    });

    it("oculta Doações, Adicionar Proposta, Entregas e Disputas Ativas", () => {
      renderShell("instituicao");
      expect(screen.queryByText("Fazer Doação")).toBeNull();
      expect(screen.queryByText("Adicionar Proposta")).toBeNull();
      expect(screen.queryByText("Minhas Entregas")).toBeNull();
      expect(screen.queryByText("Disputas Ativas")).toBeNull();
    });
  });

  describe("papel: fornecedor", () => {
    it("exibe Pedidos Recebidos e Minhas Disputas", () => {
      renderShell("fornecedor");
      expect(screen.getByText("Pedidos")).toBeDefined();
      expect(screen.getByText("Pedidos Recebidos")).toBeDefined();
      expect(screen.getByText("Disputas")).toBeDefined();
      expect(screen.getByText("Minhas Disputas")).toBeDefined();
    });

    it("oculta Doações, Adicionar Proposta, Pedidos de Compra e Disputas Ativas", () => {
      renderShell("fornecedor");
      expect(screen.queryByText("Fazer Doação")).toBeNull();
      expect(screen.queryByText("Adicionar Proposta")).toBeNull();
      expect(screen.queryByText("Pedidos de Compra")).toBeNull();
      expect(screen.queryByText("Disputas Ativas")).toBeNull();
    });
  });

  describe("caixa — Saldo", () => {
    it.each(["operador", "instituicao", "fornecedor"] as Role[])(
      "papel %s vê seção Caixa e link Saldo",
      (role) => {
        renderShell(role);
        expect(screen.getByText("Caixa")).toBeDefined();
        expect(screen.getByText("Saldo")).toBeDefined();
      },
    );

    it("doador não vê seção Caixa", () => {
      renderShell("doador");
      expect(screen.queryByText("Caixa")).toBeNull();
      expect(screen.queryByText("Saldo")).toBeNull();
    });
  });

  describe("cadastro — links exclusivos do operador", () => {
    it.each(["doador", "instituicao", "fornecedor"] as Role[])(
      "papel %s não vê Cadastrar Instituição nem Cadastrar Fornecedor",
      (role) => {
        renderShell(role);
        expect(screen.queryByText("Cadastrar Instituição")).toBeNull();
        expect(screen.queryByText("Cadastrar Fornecedor")).toBeNull();
      },
    );
  });

  describe("diretório — Instituições e Fornecedores", () => {
    it("operador vê seção Instituições com opções de cadastro e listagem", () => {
      renderShell("operador");
      expect(screen.getByText("Instituições")).toBeDefined();
      expect(screen.getByText("Cadastrar Instituição")).toBeDefined();
      expect(screen.getByText("Listar Instituições")).toBeDefined();
    });

    it("operador vê seção Fornecedores com opções de cadastro e listagem", () => {
      renderShell("operador");
      expect(screen.getByText("Fornecedores")).toBeDefined();
      expect(screen.getByText("Cadastrar Fornecedor")).toBeDefined();
      expect(screen.getByText("Listar Fornecedores")).toBeDefined();
    });

    it.each(["doador", "instituicao", "fornecedor"] as Role[])(
      "papel %s não vê seções de Instituições nem Fornecedores",
      (role) => {
        renderShell(role);
        expect(screen.queryByText("Listar Instituições")).toBeNull();
        expect(screen.queryByText("Listar Fornecedores")).toBeNull();
        expect(screen.queryByText("Cadastrar Instituição")).toBeNull();
        expect(screen.queryByText("Cadastrar Fornecedor")).toBeNull();
      },
    );
  });

  describe("botão de sair da carteira", () => {
    it("exibe botão de sair quando carteira está conectada", () => {
      renderShell("doador");
      expect(screen.getByTestId("logout-button")).toBeDefined();
      expect(screen.getByText("Sair")).toBeDefined();
    });

    it("oculta botão de sair quando carteira está desconectada", () => {
      renderShell(null);
      expect(screen.queryByTestId("logout-button")).toBeNull();
    });

    it("chama disconnect e redireciona para / ao clicar em Sair", () => {
      const disconnect = vi.fn();
      const pushMock = vi.fn();
      vi.mocked(useRouter).mockReturnValueOnce({
        push: pushMock,
        replace: vi.fn(),
        prefetch: vi.fn(),
      });
      render(
        <WalletContext.Provider
          value={{ ...buildContext("doador", "0xabc123def456"), disconnect }}
        >
          <DashboardShell>
            <div />
          </DashboardShell>
        </WalletContext.Provider>,
      );
      fireEvent.click(screen.getByTestId("logout-button"));
      expect(disconnect).toHaveBeenCalledOnce();
      expect(pushMock).toHaveBeenCalledWith("/");
    });
  });
});
