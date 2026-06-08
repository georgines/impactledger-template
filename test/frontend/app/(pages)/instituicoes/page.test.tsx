import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@test/utils/render";
import InstituicoesPage from "@/app/(pages)/instituicoes/page";
import { InstitutionStatus } from "@/services/institutionService";
import type { Institution } from "@/services/institutionService";

// ----- hoisted mocks -----
const { mockUseWallet, mockUseInstitutions, mockPropose } = vi.hoisted(() => ({
  mockUseWallet: vi.fn(),
  mockUseInstitutions: vi.fn(),
  mockPropose: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({ useWallet: mockUseWallet }));
vi.mock("@/hooks/useInstitutions", () => ({
  useInstitutions: mockUseInstitutions,
}));
vi.mock("@/hooks/useGovernance", () => ({
  useGovernance: vi.fn(() => ({
    propose: mockPropose,
    loading: false,
    error: null,
  })),
}));

// ----- fixtures -----
const ACTIVE: Institution = {
  address: "0xAAAA000000000000000000000000000000000001",
  name: "Casa da Esperanca",
  areaOfWork: "Saude",
  status: InstitutionStatus.Active,
};

const PAUSED: Institution = {
  address: "0xBBBB000000000000000000000000000000000002",
  name: "Lar dos Anjos",
  areaOfWork: "Educacao",
  status: InstitutionStatus.Paused,
};

const REMOVED: Institution = {
  address: "0xCCCC000000000000000000000000000000000003",
  name: "Fundacao Removida",
  areaOfWork: "Social",
  status: InstitutionStatus.Removed,
};

const INACTIVE: Institution = {
  address: "0xDDDD000000000000000000000000000000000004",
  name: "Projeto Inativo",
  areaOfWork: "Ambiente",
  status: InstitutionStatus.Inactive,
};

// ----- helpers -----
function setupWallet(role: string = "doador", connected = true) {
  mockUseWallet.mockReturnValue({
    provider: connected ? { _isProvider: true } : null,
    signer: connected ? { _isSigner: true } : null,
    address: connected ? "0xUSER000000000000000000000000000000000000" : null,
    role: connected ? role : null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
}

function setupInstitutions(institutions: Institution[] = [ACTIVE]) {
  mockUseInstitutions.mockReturnValue({
    institutions,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
}

function renderPage() {
  return render(<InstituicoesPage />);
}

async function openModal(institution: Institution) {
  fireEvent.click(
    screen.getByTestId(`institution-card-${institution.address}`),
  );
  await waitFor(() => {
    expect(
      screen.getByText(institution.name, {
        selector: ".mantine-Modal-title, h2, [class*='title']",
      }),
    ).toBeDefined();
  });
}

// ----- testes -----
describe("InstituicoesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPropose.mockResolvedValue(undefined);
    setupWallet("doador");
    setupInstitutions();
  });

  it("renderiza sem erros", () => {
    expect(() => renderPage()).not.toThrow();
  });

  it("exibe titulo da pagina", () => {
    renderPage();
    expect(screen.getByText(/institui/i)).toBeDefined();
  });

  it("exibe card para instituicao ativa com data-testid correto", () => {
    renderPage();
    expect(
      screen.getByTestId(`institution-card-${ACTIVE.address}`),
    ).toBeDefined();
  });

  it("exibe iniciais da instituicao no banner do card", () => {
    renderPage();
    expect(screen.getByText("CD")).toBeDefined();
  });

  it("exibe nome da instituicao ativa", () => {
    renderPage();
    expect(screen.getByText(ACTIVE.name)).toBeDefined();
  });

  it("exibe area de atuacao da instituicao", () => {
    renderPage();
    expect(screen.getByText(ACTIVE.areaOfWork)).toBeDefined();
  });

  it("exibe badge Ativa para instituicao ativa", () => {
    renderPage();
    expect(screen.getByText("Ativa")).toBeDefined();
  });

  it("exibe badge Pausada para instituicao pausada", () => {
    setupInstitutions([PAUSED]);
    renderPage();
    expect(screen.getByText("Pausada")).toBeDefined();
  });

  it("card de instituicao pausada tem atributo data-paused", () => {
    setupInstitutions([PAUSED]);
    renderPage();
    const card = screen.getByTestId(`institution-card-${PAUSED.address}`);
    expect(card.getAttribute("data-paused")).toBe("true");
  });

  it("card de instituicao ativa nao tem atributo data-paused", () => {
    renderPage();
    const card = screen.getByTestId(`institution-card-${ACTIVE.address}`);
    expect(card.getAttribute("data-paused")).toBeNull();
  });

  it("nao exibe instituicoes removidas", () => {
    setupInstitutions([ACTIVE, REMOVED]);
    renderPage();
    expect(screen.queryByText(REMOVED.name)).toBeNull();
  });

  it("nao exibe instituicoes inativas", () => {
    setupInstitutions([ACTIVE, INACTIVE]);
    renderPage();
    expect(screen.queryByText(INACTIVE.name)).toBeNull();
  });

  it("exibe mensagem quando lista esta vazia", () => {
    setupInstitutions([]);
    renderPage();
    expect(screen.getByTestId("empty-institutions")).toBeDefined();
  });

  it("exibe loader enquanto carrega", () => {
    mockUseInstitutions.mockReturnValue({
      institutions: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(document.querySelector(".mantine-Loader-root")).not.toBeNull();
  });

  it("exibe erro quando hook retorna error", () => {
    mockUseInstitutions.mockReturnValue({
      institutions: [],
      loading: false,
      error: "Erro ao carregar instituicoes",
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/erro ao carregar institui/i)).toBeDefined();
  });

  it("TC-W02 — sem carteira exibe aviso de conexao", () => {
    setupWallet("doador", false);
    renderPage();
    expect(screen.getByText(/conecte sua carteira/i)).toBeDefined();
  });

  // ----------------------------------------------------------------
  describe("modal — doador (sem acoes de governanca)", () => {
    it("abre modal ao clicar no card", async () => {
      renderPage();
      fireEvent.click(screen.getByTestId(`institution-card-${ACTIVE.address}`));
      await waitFor(() => {
        expect(screen.getByTestId("institution-modal")).toBeDefined();
      });
    });

    it("modal exibe endereco completo da instituicao", async () => {
      renderPage();
      fireEvent.click(screen.getByTestId(`institution-card-${ACTIVE.address}`));
      await waitFor(() => {
        expect(screen.getByText(ACTIVE.address)).toBeDefined();
      });
    });

    it("TC-OP07 — doador nao ve botoes de governanca no modal", async () => {
      renderPage();
      fireEvent.click(screen.getByTestId(`institution-card-${ACTIVE.address}`));
      await waitFor(() => {
        expect(screen.getByTestId("institution-modal")).toBeDefined();
      });
      expect(screen.queryByTestId("btn-pausar")).toBeNull();
      expect(screen.queryByTestId("btn-despausar")).toBeNull();
      expect(screen.queryByTestId("btn-remover")).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  describe("modal — operador (acoes de governanca — TC-OP03, TC-OP04, TC-OP05)", () => {
    beforeEach(() => {
      setupWallet("operador");
    });

    it("operador ve secao de governanca no modal", async () => {
      renderPage();
      fireEvent.click(screen.getByTestId(`institution-card-${ACTIVE.address}`));
      await waitFor(() => {
        expect(screen.getByTestId("governance-actions")).toBeDefined();
      });
    });

    it("instituicao ativa — operador ve Pausar e Remover, nao ve Despausar", async () => {
      renderPage();
      fireEvent.click(screen.getByTestId(`institution-card-${ACTIVE.address}`));
      await waitFor(() => {
        expect(screen.getByTestId("btn-pausar")).toBeDefined();
        expect(screen.getByTestId("btn-remover")).toBeDefined();
      });
      expect(screen.queryByTestId("btn-despausar")).toBeNull();
    });

    it("instituicao pausada — operador ve Despausar e Remover, nao ve Pausar", async () => {
      setupInstitutions([PAUSED]);
      renderPage();
      fireEvent.click(screen.getByTestId(`institution-card-${PAUSED.address}`));
      await waitFor(() => {
        expect(screen.getByTestId("btn-despausar")).toBeDefined();
        expect(screen.getByTestId("btn-remover")).toBeDefined();
      });
      expect(screen.queryByTestId("btn-pausar")).toBeNull();
    });

    it("operador ve campo de motivo da proposta", async () => {
      renderPage();
      fireEvent.click(screen.getByTestId(`institution-card-${ACTIVE.address}`));
      await waitFor(() => {
        expect(screen.getByTestId("input-motivo")).toBeDefined();
      });
    });

    it("TC-OP03 — clicar Pausar sem motivo desabilita envio", async () => {
      renderPage();
      fireEvent.click(screen.getByTestId(`institution-card-${ACTIVE.address}`));
      await waitFor(() => {
        expect(screen.getByTestId("btn-pausar")).toBeDefined();
      });
      const btn = screen.getByTestId("btn-pausar") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("TC-OP03 — Pausar com motivo chama propose com kind 2", async () => {
      renderPage();
      fireEvent.click(screen.getByTestId(`institution-card-${ACTIVE.address}`));
      await waitFor(() => {
        expect(screen.getByTestId("input-motivo")).toBeDefined();
      });

      fireEvent.change(screen.getByTestId("input-motivo"), {
        target: { value: "Suspeita de desvio de verbas" },
      });
      fireEvent.click(screen.getByTestId("btn-pausar"));

      await waitFor(() => {
        expect(mockPropose).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: 2,
            target: ACTIVE.address,
            metadata: "Suspeita de desvio de verbas",
          }),
        );
      });
    });

    it("TC-OP04 — Despausar com motivo chama propose com kind 3", async () => {
      setupInstitutions([PAUSED]);
      renderPage();
      fireEvent.click(screen.getByTestId(`institution-card-${PAUSED.address}`));
      await waitFor(() => {
        expect(screen.getByTestId("input-motivo")).toBeDefined();
      });

      fireEvent.change(screen.getByTestId("input-motivo"), {
        target: { value: "Investigacao concluida" },
      });
      fireEvent.click(screen.getByTestId("btn-despausar"));

      await waitFor(() => {
        expect(mockPropose).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: 3,
            target: PAUSED.address,
            metadata: "Investigacao concluida",
          }),
        );
      });
    });

    it("TC-OP05 — Remover com motivo chama propose com kind 4", async () => {
      renderPage();
      fireEvent.click(screen.getByTestId(`institution-card-${ACTIVE.address}`));
      await waitFor(() => {
        expect(screen.getByTestId("input-motivo")).toBeDefined();
      });

      fireEvent.change(screen.getByTestId("input-motivo"), {
        target: { value: "Fraude comprovada" },
      });
      fireEvent.click(screen.getByTestId("btn-remover"));

      await waitFor(() => {
        expect(mockPropose).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: 4,
            target: ACTIVE.address,
            metadata: "Fraude comprovada",
          }),
        );
      });
    });

    it("exibe confirmacao de sucesso apos proposta enviada", async () => {
      renderPage();
      fireEvent.click(screen.getByTestId(`institution-card-${ACTIVE.address}`));
      await waitFor(() => {
        expect(screen.getByTestId("input-motivo")).toBeDefined();
      });

      fireEvent.change(screen.getByTestId("input-motivo"), {
        target: { value: "Motivo qualquer" },
      });
      fireEvent.click(screen.getByTestId("btn-pausar"));

      await waitFor(() => {
        expect(screen.getByTestId("propose-success")).toBeDefined();
      });
    });

    it("exibe mensagem traduzida quando propose lanca erro de contrato", async () => {
      mockPropose.mockRejectedValue(new Error("GovernanceDAO__OnlyOperator()"));
      renderPage();
      fireEvent.click(screen.getByTestId(`institution-card-${ACTIVE.address}`));
      await waitFor(() => {
        expect(screen.getByTestId("input-motivo")).toBeDefined();
      });

      fireEvent.change(screen.getByTestId("input-motivo"), {
        target: { value: "Motivo qualquer" },
      });
      fireEvent.click(screen.getByTestId("btn-pausar"));

      await waitFor(() => {
        expect(
          screen.getByText("Apenas o operador pode executar esta ação."),
        ).toBeDefined();
      });
    });

    it("nao exibe mensagem raw do ethers — usa traducao humanizada", async () => {
      mockPropose.mockRejectedValue(new Error("GovernanceDAO__OnlyOperator()"));
      renderPage();
      fireEvent.click(screen.getByTestId(`institution-card-${ACTIVE.address}`));
      await waitFor(() => {
        expect(screen.getByTestId("input-motivo")).toBeDefined();
      });

      fireEvent.change(screen.getByTestId("input-motivo"), {
        target: { value: "Motivo qualquer" },
      });
      fireEvent.click(screen.getByTestId("btn-pausar"));

      await waitFor(() => {
        expect(screen.queryByText(/GovernanceDAO__OnlyOperator/)).toBeNull();
      });
    });
  });
});
