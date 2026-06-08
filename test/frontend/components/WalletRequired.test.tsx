import { describe, it, expect } from "vitest";
import { render, screen } from "@test/utils/render";
import { WalletRequired } from "@/components/WalletRequired";

describe("WalletRequired", () => {
  it("exibe mensagem padrão quando nenhum endereço conectado", () => {
    render(<WalletRequired />);
    expect(
      screen.getByText("Conecte sua carteira para continuar."),
    ).toBeInTheDocument();
  });

  it("exibe mensagem customizada quando fornecida", () => {
    render(
      <WalletRequired message="Conecte sua carteira para realizar uma doação." />,
    );
    expect(
      screen.getByText("Conecte sua carteira para realizar uma doação."),
    ).toBeInTheDocument();
  });

  it("não exibe children", () => {
    render(<WalletRequired>conteúdo protegido</WalletRequired>);
    expect(screen.queryByText("conteúdo protegido")).not.toBeInTheDocument();
  });
});
