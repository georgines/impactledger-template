import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@test/utils/render";
import CadastroInstituicaoPage from "@/app/(pages)/cadastro/instituicoes/page";
import { WalletContext } from "@/components/providers/WalletProvider";
import type { WalletContextValue } from "@/components/providers/WalletProvider";
import { useGovernance } from "@/hooks/useGovernance";
import { useBootstrapRegister } from "@/hooks/useBootstrapRegister";
import { useBootstrapStatus } from "@/hooks/useBootstrapStatus";

const { mockPropose, mockWait, mockBootstrapFn } = vi.hoisted(() => ({
  mockPropose: vi.fn(),
  mockWait: vi.fn().mockResolvedValue({}),
  mockBootstrapFn: vi.fn(),
}));

vi.mock("@/services/contractService", () => ({
  getGovernanceDAOContract: vi.fn(() => ({
    propose: mockPropose,
    bootstrapRegister: mockBootstrapFn,
  })),
  getInstitutionRegistryContract: vi.fn(() => ({
    isActive: vi.fn().mockResolvedValue(false),
  })),
  getPurchaseManagerContract: vi.fn(() => ({
    isSupplierWhitelisted: vi.fn().mockResolvedValue(false),
  })),
}));

vi.mock("@/hooks/useGovernance", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/hooks/useGovernance")>();
  return { ...original, useGovernance: vi.fn(original.useGovernance) };
});

vi.mock("@/hooks/useBootstrapRegister", () => ({
  useBootstrapRegister: vi.fn(() => ({
    bootstrapRegister: mockBootstrapFn,
    loading: false,
    error: null,
  })),
}));

vi.mock("@/hooks/useBootstrapStatus", () => ({
  useBootstrapStatus: vi.fn(() => ({
    isBootstrapped: false,
    loading: false,
  })),
}));

const VALID_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const mockSigner = { _isSigner: true } as never;

function buildContext(
  overrides: Partial<WalletContextValue> = {},
): WalletContextValue {
  return {
    address: VALID_ADDRESS,
    provider: null,
    signer: mockSigner,
    role: "operador",
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...overrides,
  };
}

function renderPage(overrides: Partial<WalletContextValue> = {}) {
  return render(
    <WalletContext.Provider value={buildContext(overrides)}>
      <CadastroInstituicaoPage />
    </WalletContext.Provider>,
  );
}

describe("CadastroInstituicaoPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPropose.mockResolvedValue({ wait: mockWait });
    mockBootstrapFn.mockResolvedValue(undefined);
    vi.mocked(useBootstrapRegister).mockReturnValue({
      bootstrapRegister: mockBootstrapFn,
      loading: false,
      error: null,
    });
    vi.mocked(useBootstrapStatus).mockReturnValue({
      isBootstrapped: false,
      loading: false,
    });
  });

  it("renderiza sem erros", () => {
    expect(() => renderPage()).not.toThrow();
  });

  describe("controle de acesso", () => {
    it("exibe aviso quando carteira não conectada", () => {
      renderPage({ signer: null, role: null, address: null });
      expect(screen.getByText(/conecte sua carteira/i)).toBeDefined();
    });

    it("não exibe formulário sem carteira conectada", () => {
      renderPage({ signer: null, role: null, address: null });
      expect(screen.queryByText("Área de Atuação")).toBeNull();
    });
  });

  describe("formulário único", () => {
    it("exibe campos de endereço, nome e área de atuação", () => {
      renderPage();
      expect(screen.getByText("Endereço")).toBeDefined();
      expect(screen.getByText("Nome")).toBeDefined();
      expect(screen.getByText("Área de Atuação")).toBeDefined();
    });
  });

  describe("quando plataforma não foi inicializada", () => {
    it("exibe aviso de registro inicial", () => {
      renderPage();
      expect(screen.getByTestId("bootstrap-section")).toBeDefined();
    });

    it("não exibe aviso enquanto verifica status no contrato", () => {
      vi.mocked(useBootstrapStatus).mockReturnValue({
        isBootstrapped: false,
        loading: true,
      });
      renderPage();
      expect(screen.queryByTestId("bootstrap-section")).toBeNull();
    });

    it("exibe botão de registrar primeira instituição", () => {
      renderPage();
      expect(
        screen.getByRole("button", { name: /registrar primeira/i }),
      ).toBeDefined();
    });

    it("exibe erro de endereço inválido sem chamar bootstrapRegister", async () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText("0x..."), {
        target: { value: "endereco-invalido" },
      });
      fireEvent.change(screen.getByPlaceholderText("Nome da instituição"), {
        target: { value: "ONG Teste" },
      });
      fireEvent.change(screen.getByPlaceholderText("Ex: educação, saúde"), {
        target: { value: "saude" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: /registrar primeira/i }),
      );
      await waitFor(() => {
        expect(screen.getByText(/endereço inválido/i)).toBeDefined();
      });
      expect(mockBootstrapFn).not.toHaveBeenCalled();
    });

    it("registra com sucesso e exibe confirmação", async () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText("0x..."), {
        target: { value: VALID_ADDRESS },
      });
      fireEvent.change(screen.getByPlaceholderText("Nome da instituição"), {
        target: { value: "ONG Teste" },
      });
      fireEvent.change(screen.getByPlaceholderText("Ex: educação, saúde"), {
        target: { value: "saude" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: /registrar primeira/i }),
      );
      await waitFor(() => {
        expect(screen.getByTestId("bootstrap-success")).toBeDefined();
      });
      expect(mockBootstrapFn).toHaveBeenCalledOnce();
    });

    it("após registrar primeira instituição, exibe formulário de proposta sem atualizar página", async () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText("0x..."), {
        target: { value: VALID_ADDRESS },
      });
      fireEvent.change(screen.getByPlaceholderText("Nome da instituição"), {
        target: { value: "ONG Teste" },
      });
      fireEvent.change(screen.getByPlaceholderText("Ex: educação, saúde"), {
        target: { value: "saude" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: /registrar primeira/i }),
      );
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /propor/i })).toBeDefined();
      });
    });

    it("exibe erro retornado pelo useBootstrapRegister", () => {
      vi.mocked(useBootstrapRegister).mockReturnValue({
        bootstrapRegister: mockBootstrapFn,
        loading: false,
        error: "A plataforma já foi inicializada.",
      });
      renderPage();
      expect(
        screen.getByText("A plataforma já foi inicializada."),
      ).toBeDefined();
    });
  });

  describe("quando plataforma já foi inicializada", () => {
    beforeEach(() => {
      vi.mocked(useBootstrapStatus).mockReturnValue({
        isBootstrapped: true,
        loading: false,
      });
    });

    it("não exibe aviso de registro inicial", () => {
      renderPage();
      expect(screen.queryByTestId("bootstrap-section")).toBeNull();
    });

    it("exibe botão de proposta", () => {
      renderPage();
      expect(screen.getByRole("button", { name: /propor/i })).toBeDefined();
    });

    it("exibe erro para endereço inválido sem enviar transação", async () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText("0x..."), {
        target: { value: "endereco-invalido" },
      });
      fireEvent.click(screen.getByRole("button", { name: /propor/i }));
      await waitFor(() => {
        expect(screen.getByText(/endereço inválido/i)).toBeDefined();
      });
      expect(mockPropose).not.toHaveBeenCalled();
    });

    it("exibe erro quando nome está vazio", async () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText("0x..."), {
        target: { value: VALID_ADDRESS },
      });
      fireEvent.click(screen.getByRole("button", { name: /propor/i }));
      await waitFor(() => {
        expect(screen.getByText(/nome obrigatório/i)).toBeDefined();
      });
      expect(mockPropose).not.toHaveBeenCalled();
    });

    it("exibe erro quando área de atuação está vazia", async () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText("0x..."), {
        target: { value: VALID_ADDRESS },
      });
      fireEvent.change(screen.getByPlaceholderText("Nome da instituição"), {
        target: { value: "ONG Teste" },
      });
      fireEvent.click(screen.getByRole("button", { name: /propor/i }));
      await waitFor(() => {
        expect(screen.getByText(/área de atuação obrigatória/i)).toBeDefined();
      });
      expect(mockPropose).not.toHaveBeenCalled();
    });

    it("chama propose com kind=0 e dados corretos", async () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText("0x..."), {
        target: { value: VALID_ADDRESS },
      });
      fireEvent.change(screen.getByPlaceholderText("Nome da instituição"), {
        target: { value: "ONG Teste" },
      });
      fireEvent.change(screen.getByPlaceholderText("Ex: educação, saúde"), {
        target: { value: "educação" },
      });
      fireEvent.click(screen.getByRole("button", { name: /propor/i }));
      await waitFor(() => {
        expect(mockPropose).toHaveBeenCalledWith(
          0,
          VALID_ADDRESS,
          "ONG Teste",
          "educação",
        );
      });
    });

    it("exibe mensagem de sucesso após proposta enviada", async () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText("0x..."), {
        target: { value: VALID_ADDRESS },
      });
      fireEvent.change(screen.getByPlaceholderText("Nome da instituição"), {
        target: { value: "ONG Teste" },
      });
      fireEvent.change(screen.getByPlaceholderText("Ex: educação, saúde"), {
        target: { value: "educação" },
      });
      fireEvent.click(screen.getByRole("button", { name: /propor/i }));
      await waitFor(() => {
        expect(
          screen.getByText(/proposta registrada com sucesso/i),
        ).toBeDefined();
      });
    });

    it("exibe erro retornado pelo useGovernance", () => {
      vi.mocked(useGovernance).mockReturnValueOnce({
        propose: mockPropose,
        vote: vi.fn(),
        getMinQuorum: vi.fn().mockResolvedValue(BigInt(1)),
        finalize: vi.fn(),
        loading: false,
        error: "Transação rejeitada pelo usuário",
      });
      renderPage();
      expect(
        screen.getByText("Transação rejeitada pelo usuário"),
      ).toBeDefined();
    });
  });
});
