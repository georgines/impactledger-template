import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@test/utils/render";
import CadastroFornecedorPage from "@/app/(pages)/cadastro/fornecedores/page";
import { WalletContext } from "@/components/providers/WalletProvider";
import type { WalletContextValue } from "@/components/providers/WalletProvider";
import { useGovernance } from "@/hooks/useGovernance";

const { mockPropose, mockWait } = vi.hoisted(() => ({
  mockPropose: vi.fn(),
  mockWait: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/services/contractService", () => ({
  getGovernanceDAOContract: vi.fn(() => ({
    propose: mockPropose,
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
      <CadastroFornecedorPage />
    </WalletContext.Provider>,
  );
}

describe("CadastroFornecedorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPropose.mockResolvedValue({ wait: mockWait });
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
      expect(screen.queryByText("Endereço do Fornecedor")).toBeNull();
    });

    it("exibe aviso quando papel não é operador", () => {
      renderPage({ role: "doador" });
      expect(screen.getByText(/apenas o operador/i)).toBeDefined();
    });

    it("não exibe formulário para não-operador", () => {
      renderPage({ role: "doador" });
      expect(screen.queryByText("Endereço do Fornecedor")).toBeNull();
    });
  });

  describe("formulário", () => {
    it("exibe campos de endereço, nome e tipo de serviço", () => {
      renderPage();
      expect(screen.getByText("Endereço do Fornecedor")).toBeDefined();
      expect(screen.getByText("Nome")).toBeDefined();
      expect(screen.getByText("Tipo de Serviço")).toBeDefined();
    });

    it("exibe botão de proposta", () => {
      renderPage();
      expect(screen.getByRole("button", { name: /propor/i })).toBeDefined();
    });
  });

  describe("validação", () => {
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

    it("exibe erro quando tipo de serviço está vazio", async () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText("0x..."), {
        target: { value: VALID_ADDRESS },
      });
      fireEvent.change(screen.getByPlaceholderText("Nome do fornecedor"), {
        target: { value: "Fornecedor Teste" },
      });
      fireEvent.click(screen.getByRole("button", { name: /propor/i }));
      await waitFor(() => {
        expect(screen.getByText(/campo obrigatório/i)).toBeDefined();
      });
      expect(mockPropose).not.toHaveBeenCalled();
    });
  });

  describe("submissão", () => {
    it("chama propose com kind=1 e dados corretos", async () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText("0x..."), {
        target: { value: VALID_ADDRESS },
      });
      fireEvent.change(screen.getByPlaceholderText("Nome do fornecedor"), {
        target: { value: "Fornecedor Teste" },
      });
      fireEvent.change(
        screen.getByPlaceholderText("Ex: logística, tecnologia"),
        { target: { value: "logística" } },
      );
      fireEvent.click(screen.getByRole("button", { name: /propor/i }));
      await waitFor(() => {
        expect(mockPropose).toHaveBeenCalledWith(
          1,
          VALID_ADDRESS,
          "Fornecedor Teste",
          "logística",
        );
      });
    });

    it("exibe mensagem de sucesso após proposta enviada", async () => {
      renderPage();
      fireEvent.change(screen.getByPlaceholderText("0x..."), {
        target: { value: VALID_ADDRESS },
      });
      fireEvent.change(screen.getByPlaceholderText("Nome do fornecedor"), {
        target: { value: "Fornecedor Teste" },
      });
      fireEvent.change(
        screen.getByPlaceholderText("Ex: logística, tecnologia"),
        { target: { value: "logística" } },
      );
      fireEvent.click(screen.getByRole("button", { name: /propor/i }));
      await waitFor(() => {
        expect(
          screen.getByText(/proposta registrada com sucesso/i),
        ).toBeDefined();
      });
    });
  });

  describe("erro do hook", () => {
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
