import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@test/utils/render";
import { PageHeader } from "@/components/PageHeader";

describe("PageHeader", () => {
  it("exibe o título", () => {
    render(<PageHeader title="Meus Pedidos" />);
    expect(screen.getByText("Meus Pedidos")).toBeInTheDocument();
  });

  it("exibe botão Atualizar quando onRefresh fornecido", () => {
    render(<PageHeader title="Título" onRefresh={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /atualizar/i }),
    ).toBeInTheDocument();
  });

  it("não exibe botão Atualizar sem onRefresh", () => {
    render(<PageHeader title="Título" />);
    expect(
      screen.queryByRole("button", { name: /atualizar/i }),
    ).not.toBeInTheDocument();
  });

  it("chama onRefresh ao clicar no botão", () => {
    const onRefresh = vi.fn();
    render(<PageHeader title="Título" onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole("button", { name: /atualizar/i }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("botão fica desabilitado durante loading", () => {
    render(<PageHeader title="Título" onRefresh={vi.fn()} loading />);
    expect(screen.getByRole("button", { name: /atualizar/i })).toBeDisabled();
  });
});
