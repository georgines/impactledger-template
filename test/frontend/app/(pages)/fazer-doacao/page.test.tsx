import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@test/utils/render";
import FazerDoacaoPage from "@/app/(pages)/fazer-doacao/page";
import { InstitutionStatus } from "@/services/institutionService";
import type { Institution } from "@/services/institutionService";
import { useDonation } from "@/hooks/useDonation";

// ----- hoisted mocks -----
const { mockUseWallet, mockUseInstitutions, mockDonate } = vi.hoisted(() => ({
  mockUseWallet: vi.fn(),
  mockUseInstitutions: vi.fn(),
  mockDonate: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({ useWallet: mockUseWallet }));
vi.mock("@/hooks/useInstitutions", () => ({
  useInstitutions: mockUseInstitutions,
}));
vi.mock("@/hooks/useDonation", () => ({
  useDonation: vi.fn(() => ({
    donate: mockDonate,
    loading: false,
    error: null,
  })),
}));

// ----- fixtures -----
const ACTIVE_INSTITUTION: Institution = {
  address: "0xABC0000000000000000000000000000000000001",
  name: "Casa da Esperanca",
  areaOfWork: "saude",
  status: InstitutionStatus.Active,
};

const PAUSED_INSTITUTION: Institution = {
  address: "0xDEF0000000000000000000000000000000000002",
  name: "Lar dos Anjos",
  areaOfWork: "educacao",
  status: InstitutionStatus.Paused,
};

const REMOVED_INSTITUTION: Institution = {
  address: "0x0000000000000000000000000000000000000003",
  name: "Fundacao Removida",
  areaOfWork: "social",
  status: InstitutionStatus.Removed,
};

// ----- helpers -----
function setupWallet(connected = true) {
  mockUseWallet.mockReturnValue({
    provider: connected ? { _isProvider: true } : null,
    signer: connected ? { _isSigner: true } : null,
    address: connected ? "0xDONOR000000000000000000000000000000000" : null,
    role: "doador",
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
}

function setupInstitutions(institutions: Institution[] = [ACTIVE_INSTITUTION]) {
  mockUseInstitutions.mockReturnValue({
    institutions,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
}

function renderPage() {
  return render(<FazerDoacaoPage />);
}

/** Clica no card e aguarda o conteúdo do modal aparecer. */
async function openModal(institution: Institution) {
  fireEvent.click(
    screen.getByTestId(`institution-card-${institution.address}`),
  );
  await waitFor(() => {
    expect(screen.getByPlaceholderText("0.01")).toBeDefined();
  });
}

// ----- testes -----
describe("FazerDoacaoPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDonate.mockResolvedValue(undefined);
    // restaura implementação padrão do useDonation a cada teste
    vi.mocked(useDonation).mockReturnValue({
      donate: mockDonate,
      loading: false,
      error: null,
    });
    setupWallet();
    setupInstitutions();
  });

  it("renderiza sem erros", () => {
    expect(() => renderPage()).not.toThrow();
  });

  // ----------------------------------------------------------------
  describe("controle de acesso", () => {
    it("TC-W02 — sem carteira exibe aviso de conexao e nao renderiza grid", () => {
      setupWallet(false);
      renderPage();

      expect(screen.getByText(/conecte sua carteira/i)).toBeDefined();
      expect(
        screen.queryByTestId(`institution-card-${ACTIVE_INSTITUTION.address}`),
      ).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  describe("grid de instituicoes — TC-D01", () => {
    it("exibe card para cada instituicao visivel", () => {
      setupInstitutions([ACTIVE_INSTITUTION, PAUSED_INSTITUTION]);
      renderPage();

      expect(
        screen.getByTestId(`institution-card-${ACTIVE_INSTITUTION.address}`),
      ).toBeDefined();
      expect(
        screen.getByTestId(`institution-card-${PAUSED_INSTITUTION.address}`),
      ).toBeDefined();
    });

    it("exibe nome da instituicao no card", () => {
      renderPage();

      expect(screen.getByText(ACTIVE_INSTITUTION.name)).toBeDefined();
    });

    it("exibe area de atuacao no card", () => {
      renderPage();

      expect(
        screen.getAllByText(ACTIVE_INSTITUTION.areaOfWork).length,
      ).toBeGreaterThan(0);
    });

    it("nao exibe instituicoes removidas", () => {
      setupInstitutions([ACTIVE_INSTITUTION, REMOVED_INSTITUTION]);
      renderPage();

      expect(
        screen.queryByTestId(`institution-card-${REMOVED_INSTITUTION.address}`),
      ).toBeNull();
      expect(screen.queryByText(REMOVED_INSTITUTION.name)).toBeNull();
    });

    it("exibe mensagem quando nao ha instituicoes disponiveis", () => {
      setupInstitutions([]);
      renderPage();

      expect(screen.getByTestId("empty-institutions")).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  describe("modal de doacao — TC-D01", () => {
    it("abre modal ao clicar no card da instituicao", async () => {
      renderPage();

      await openModal(ACTIVE_INSTITUTION);

      expect(
        screen.getByText(`Doe para ${ACTIVE_INSTITUTION.name}`),
      ).toBeDefined();
    });

    it("modal exibe campo de valor e botao confirmar", async () => {
      renderPage();

      await openModal(ACTIVE_INSTITUTION);

      expect(screen.getByPlaceholderText("0.01")).toBeDefined();
      expect(screen.getByTestId("btn-confirmar-doacao")).toBeDefined();
    });

    it("TC-D01 — realiza doacao com sucesso e exibe confirmacao", async () => {
      renderPage();

      await openModal(ACTIVE_INSTITUTION);
      fireEvent.change(screen.getByPlaceholderText("0.01"), {
        target: { value: "0.5" },
      });
      fireEvent.click(screen.getByTestId("btn-confirmar-doacao"));

      await waitFor(() => {
        expect(screen.getByTestId("donation-success")).toBeDefined();
      });

      expect(mockDonate).toHaveBeenCalledOnce();
    });

    it("TC-D01 — botao desabilitado antes de preencher valor", async () => {
      renderPage();

      await openModal(ACTIVE_INSTITUTION);

      const btn = screen.getByTestId(
        "btn-confirmar-doacao",
      ) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("fecha modal ao clicar no botao fechar", async () => {
      renderPage();

      await openModal(ACTIVE_INSTITUTION);
      expect(
        screen.getByText(`Doe para ${ACTIVE_INSTITUTION.name}`),
      ).toBeDefined();

      const closeBtn = document.querySelector(
        ".mantine-Modal-close",
      ) as HTMLButtonElement;
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(
          screen.queryByText(`Doe para ${ACTIVE_INSTITUTION.name}`),
        ).toBeNull();
      });
    });
  });

  // ----------------------------------------------------------------
  describe("validacao — TC-D02", () => {
    it("TC-D02 — botao desabilitado com valor zero", async () => {
      renderPage();

      await openModal(ACTIVE_INSTITUTION);
      fireEvent.change(screen.getByPlaceholderText("0.01"), {
        target: { value: "0" },
      });

      const btn = screen.getByTestId(
        "btn-confirmar-doacao",
      ) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("TC-D02 — submissao sem valor exibe erro de validacao", async () => {
      renderPage();

      await openModal(ACTIVE_INSTITUTION);
      fireEvent.submit(
        screen.getByTestId("btn-confirmar-doacao").closest("form")!,
      );

      await waitFor(() => {
        expect(screen.getByText(/valor maior que zero/i)).toBeDefined();
      });

      expect(mockDonate).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  describe("instituicao pausada — TC-D03", () => {
    it("TC-D03 — card de instituicao pausada tem badge Pausada", () => {
      setupInstitutions([PAUSED_INSTITUTION]);
      renderPage();

      expect(screen.getByText("Pausada")).toBeDefined();
    });

    it("TC-D03 — modal de instituicao pausada exibe alerta", async () => {
      setupInstitutions([PAUSED_INSTITUTION]);
      renderPage();

      await openModal(PAUSED_INSTITUTION);

      expect(screen.getByTestId("paused-alert")).toBeDefined();
    });

    it("TC-D03 — botao desabilitado para instituicao pausada", async () => {
      setupInstitutions([PAUSED_INSTITUTION]);
      renderPage();

      await openModal(PAUSED_INSTITUTION);

      const btn = screen.getByTestId(
        "btn-confirmar-doacao",
      ) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("TC-D03 — campo de valor desabilitado para instituicao pausada", async () => {
      setupInstitutions([PAUSED_INSTITUTION]);
      renderPage();

      await openModal(PAUSED_INSTITUTION);

      const input = screen.getByPlaceholderText("0.01") as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  describe("erros do hook", () => {
    it("exibe mensagem de erro retornada pelo useDonation no modal", async () => {
      vi.mocked(useDonation).mockReturnValue({
        donate: mockDonate,
        loading: false,
        error: "Transacao rejeitada pelo usuario",
      });

      renderPage();
      await openModal(ACTIVE_INSTITUTION);

      expect(
        screen.getByText("Transacao rejeitada pelo usuario"),
      ).toBeDefined();
    });
  });
});
