import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@test/utils/render";
import FornecedoresPage from "@/app/(pages)/fornecedores/page";
import type { Supplier } from "@/services/supplierService";

const { mockUseWallet, mockUseSuppliers } = vi.hoisted(() => ({
  mockUseWallet: vi.fn(),
  mockUseSuppliers: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({ useWallet: mockUseWallet }));
vi.mock("@/hooks/useSuppliers", () => ({
  useSuppliers: mockUseSuppliers,
}));

const APPROVED: Supplier = {
  address: "0xAAAA000000000000000000000000000000000001",
  name: "Distribuidora Alpha",
  serviceType: "Alimentos",
  approved: true,
};

const REVOKED: Supplier = {
  address: "0xBBBB000000000000000000000000000000000002",
  name: "Transportes Beta",
  serviceType: "Logistica",
  approved: false,
};

function setupWallet(connected = true) {
  mockUseWallet.mockReturnValue({
    provider: connected ? { _isProvider: true } : null,
    signer: connected ? { _isSigner: true } : null,
    address: connected ? "0xUSER000000000000000000000000000000000000" : null,
    role: "doador",
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
}

function setupSuppliers(suppliers: Supplier[] = [APPROVED]) {
  mockUseSuppliers.mockReturnValue({
    suppliers,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
}

function renderPage() {
  return render(<FornecedoresPage />);
}

describe("FornecedoresPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupWallet();
    setupSuppliers();
  });

  it("renderiza sem erros", () => {
    expect(() => renderPage()).not.toThrow();
  });

  it("exibe titulo da pagina", () => {
    renderPage();
    expect(screen.getByText(/fornecedor/i)).toBeDefined();
  });

  it("exibe card para fornecedor com data-testid correto", () => {
    renderPage();
    expect(
      screen.getByTestId(`supplier-card-${APPROVED.address}`),
    ).toBeDefined();
  });

  it("exibe iniciais do fornecedor no banner do card", () => {
    renderPage();
    expect(screen.getByText("DA")).toBeDefined();
  });

  it("exibe nome do fornecedor aprovado", () => {
    renderPage();
    expect(screen.getByText(APPROVED.name)).toBeDefined();
  });

  it("exibe tipo de servico do fornecedor", () => {
    renderPage();
    expect(screen.getByText(APPROVED.serviceType)).toBeDefined();
  });

  it("exibe badge Aprovado para fornecedor aprovado", () => {
    renderPage();
    expect(screen.getByText("Aprovado")).toBeDefined();
  });

  it("exibe badge Revogado para fornecedor nao aprovado", () => {
    setupSuppliers([REVOKED]);
    renderPage();
    expect(screen.getByText("Revogado")).toBeDefined();
  });

  it("exibe mensagem quando lista esta vazia", () => {
    setupSuppliers([]);
    renderPage();
    expect(screen.getByTestId("empty-suppliers")).toBeDefined();
  });

  it("exibe loader enquanto carrega", () => {
    mockUseSuppliers.mockReturnValue({
      suppliers: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(document.querySelector(".mantine-Loader-root")).not.toBeNull();
  });

  it("exibe erro quando hook retorna error", () => {
    mockUseSuppliers.mockReturnValue({
      suppliers: [],
      loading: false,
      error: "Erro ao carregar fornecedores",
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/erro ao carregar fornecedores/i)).toBeDefined();
  });

  it("TC-W02 — sem carteira exibe aviso de conexao", () => {
    setupWallet(false);
    renderPage();
    expect(screen.getByText(/conecte sua carteira/i)).toBeDefined();
  });

  it("exibe tanto aprovados quanto revogados na listagem", () => {
    setupSuppliers([APPROVED, REVOKED]);
    renderPage();
    expect(screen.getByText(APPROVED.name)).toBeDefined();
    expect(screen.getByText(REVOKED.name)).toBeDefined();
  });
});
