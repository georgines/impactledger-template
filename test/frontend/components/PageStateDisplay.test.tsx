import { describe, it, expect } from "vitest";
import { render, screen } from "@test/utils/render";
import { PageStateDisplay } from "@/components/PageStateDisplay";

describe("PageStateDisplay", () => {
  it("exibe loader quando loading=true", () => {
    render(
      <PageStateDisplay loading={true} empty={false} emptyMessage="Vazio" />,
    );
    expect(screen.getByTestId("page-loading")).toBeInTheDocument();
  });

  it("não exibe loader quando loading=false", () => {
    render(
      <PageStateDisplay loading={false} empty={false} emptyMessage="Vazio" />,
    );
    expect(screen.queryByTestId("page-loading")).not.toBeInTheDocument();
  });

  it("exibe alert de erro quando error fornecido", () => {
    render(
      <PageStateDisplay
        loading={false}
        error="Falha ao carregar"
        empty={false}
        emptyMessage="Vazio"
      />,
    );
    expect(screen.getByText("Falha ao carregar")).toBeInTheDocument();
  });

  it("não exibe alert de erro quando error é null", () => {
    render(
      <PageStateDisplay
        loading={false}
        error={null}
        empty={false}
        emptyMessage="Vazio"
      />,
    );
    expect(screen.queryByText("Falha ao carregar")).not.toBeInTheDocument();
  });

  it("exibe mensagem vazia quando empty=true", () => {
    render(
      <PageStateDisplay
        loading={false}
        empty={true}
        emptyMessage="Nenhum item encontrado."
      />,
    );
    expect(screen.getByText("Nenhum item encontrado.")).toBeInTheDocument();
  });

  it("aplica emptyTestId no alert vazio", () => {
    render(
      <PageStateDisplay
        loading={false}
        empty={true}
        emptyMessage="Nenhum item."
        emptyTestId="empty-items"
      />,
    );
    expect(screen.getByTestId("empty-items")).toBeInTheDocument();
  });

  it("não exibe alerta vazio quando empty=false", () => {
    render(
      <PageStateDisplay
        loading={false}
        empty={false}
        emptyMessage="Nenhum item."
        emptyTestId="empty-items"
      />,
    );
    expect(screen.queryByTestId("empty-items")).not.toBeInTheDocument();
  });

  it("não renderiza loader, erro ou vazio quando tudo false", () => {
    render(
      <PageStateDisplay loading={false} empty={false} emptyMessage="Vazio" />,
    );
    expect(screen.queryByTestId("page-loading")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
