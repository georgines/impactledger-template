import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MantineProvider } from "@mantine/core";
import { MapaDoBemPanel } from "@/components/MapaDoBemPanel";

const {
  mockUseMapaDoBem,
  mockUseIpfsMetadata,
  mockUseInstitutions,
  mockUseSuppliers,
} = vi.hoisted(() => ({
  mockUseMapaDoBem: vi.fn(),
  mockUseIpfsMetadata: vi.fn(),
  mockUseInstitutions: vi.fn(),
  mockUseSuppliers: vi.fn(),
}));

vi.mock("@/hooks/useMapaDoBem", () => ({
  useMapaDoBem: mockUseMapaDoBem,
}));

vi.mock("@/hooks/useIpfsMetadata", () => ({
  useIpfsMetadata: mockUseIpfsMetadata,
}));

vi.mock("@/hooks/useInstitutions", () => ({
  useInstitutions: mockUseInstitutions,
}));

vi.mock("@/hooks/useSuppliers", () => ({
  useSuppliers: mockUseSuppliers,
}));

const EMPTY_HASH = "0x" + "0".repeat(64);
const PROOF_HASH =
  "0xabcd000000000000000000000000000000000000000000000000000000000001";
const DESC_HASH =
  "0xdead000000000000000000000000000000000000000000000000000000000001";

const DONATION = {
  kind: "donation" as const,
  blockNumber: 200,
  txHash: "0x1234",
  donor: "0xCCCC000000000000000000000000000000000003",
  institution: "0xAAAA000000000000000000000000000000000001",
  amount: 200000000000000000n,
};

const PAYMENT = {
  kind: "payment" as const,
  blockNumber: 100,
  txHash: "0x5678",
  purchaseId: 42n,
  institution: "0xAAAA000000000000000000000000000000000001",
  supplier: "0xBBBB000000000000000000000000000000000002",
  amount: 500000000000000000n,
  impactProofHash: PROOF_HASH,
  descriptionHash: DESC_HASH,
};

function renderPanel(provider = null) {
  return render(
    <MantineProvider>
      <MapaDoBemPanel provider={provider} />
    </MantineProvider>,
  );
}

describe("MapaDoBemPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIpfsMetadata.mockReturnValue({ metadata: null, loading: false });
    mockUseInstitutions.mockReturnValue({
      institutions: [],
      loading: false,
      error: null,
    });
    mockUseSuppliers.mockReturnValue({
      suppliers: [],
      loading: false,
      error: null,
    });
  });

  describe("estado de carregamento", () => {
    it("exibe skeletons quando loading e true", () => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [],
        loading: true,
        error: null,
      });
      renderPanel();
      const skeletons = document.querySelectorAll("[data-skeleton]");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("nao exibe filtros durante loading", () => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [],
        loading: true,
        error: null,
      });
      renderPanel();
      expect(screen.queryByTestId("activity-filter")).toBeNull();
    });
  });

  describe("estado de erro", () => {
    it("exibe alerta quando ha erro de rede", () => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [],
        loading: false,
        error: "Falha",
      });
      renderPanel();
      expect(
        screen.getByText("Não foi possível carregar os dados da plataforma."),
      ).toBeInTheDocument();
    });

    it("nao exibe filtros quando ha erro", () => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [],
        loading: false,
        error: "Falha",
      });
      renderPanel();
      expect(screen.queryByTestId("activity-filter")).toBeNull();
    });
  });

  describe("estado vazio", () => {
    it("exibe mensagem quando nao ha atividades", () => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [],
        loading: false,
        error: null,
      });
      renderPanel();
      expect(
        screen.getByText("Nenhuma atividade registrada ainda."),
      ).toBeInTheDocument();
    });

    it("exibe filtros mesmo sem atividades", () => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [],
        loading: false,
        error: null,
      });
      renderPanel();
      expect(screen.getByTestId("activity-filter")).toBeInTheDocument();
    });
  });

  describe("card de doacao", () => {
    beforeEach(() => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [DONATION],
        loading: false,
        error: null,
      });
    });

    it("exibe titulo Doacao recebida", () => {
      renderPanel();
      expect(screen.getByText("Doação recebida")).toBeInTheDocument();
    });

    it("exibe endereco do doador abreviado", () => {
      renderPanel();
      expect(screen.getByText("0xCCCC...0003")).toBeInTheDocument();
    });

    it("exibe endereco da instituicao abreviado", () => {
      renderPanel();
      expect(screen.getByText("0xAAAA...0001")).toBeInTheDocument();
    });

    it("exibe valor da doacao em ETH", () => {
      renderPanel();
      expect(screen.getAllByText(/0\.2 ETH/).length).toBeGreaterThan(0);
    });
  });

  describe("card de pagamento", () => {
    beforeEach(() => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [PAYMENT],
        loading: false,
        error: null,
      });
    });

    it("exibe numero do pedido", () => {
      renderPanel();
      expect(screen.getByText("Pedido #42")).toBeInTheDocument();
    });

    it("exibe endereco da instituicao abreviado", () => {
      renderPanel();
      expect(screen.getByText("0xAAAA...0001")).toBeInTheDocument();
    });

    it("exibe endereco do fornecedor abreviado", () => {
      renderPanel();
      expect(screen.getByText("0xBBBB...0002")).toBeInTheDocument();
    });

    it("exibe valor do pagamento em ETH", () => {
      renderPanel();
      expect(screen.getAllByText(/0\.5 ETH/).length).toBeGreaterThan(0);
    });

    it("link de prova de impacto tem target _blank e rel noopener", () => {
      renderPanel();
      const link = screen.getByText(/Prova de Impacto/);
      expect(link.closest("a")).toHaveAttribute("target", "_blank");
      expect(link.closest("a")).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("nao exibe link de arquivo original (removido por M3)", () => {
      renderPanel();
      expect(screen.queryByText(/Ver arquivo original/)).toBeNull();
    });

    it("nao exibe link de prova quando impactProofHash e zero", () => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [{ ...PAYMENT, impactProofHash: EMPTY_HASH }],
        loading: false,
        error: null,
      });
      renderPanel();
      expect(screen.queryByText(/Prova de Impacto/)).toBeNull();
    });

    it("nao exibe link de descricao quando descriptionHash e zero", () => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [{ ...PAYMENT, descriptionHash: EMPTY_HASH }],
        loading: false,
        error: null,
      });
      renderPanel();
      expect(screen.queryByText(/Ver arquivo original/)).toBeNull();
    });
  });

  describe("stats de resumo", () => {
    it("exibe total doado em ETH verde", () => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [DONATION],
        loading: false,
        error: null,
      });
      renderPanel();
      expect(screen.getByText("Total doado")).toBeInTheDocument();
      expect(screen.getAllByText("0.2 ETH").length).toBeGreaterThan(0);
    });

    it("exibe total pago com prova", () => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [PAYMENT],
        loading: false,
        error: null,
      });
      renderPanel();
      expect(screen.getByText("Total pago (com prova)")).toBeInTheDocument();
      expect(screen.getAllByText("0.5 ETH").length).toBeGreaterThan(0);
    });

    it("soma corretamente quando ha multiplas doacoes", () => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [DONATION, { ...DONATION, blockNumber: 201 }],
        loading: false,
        error: null,
      });
      renderPanel();
      expect(screen.getAllByText("0.4 ETH").length).toBeGreaterThan(0);
    });
  });

  describe("filtros", () => {
    beforeEach(() => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [DONATION, PAYMENT],
        loading: false,
        error: null,
      });
    });

    it("exibe todos os eventos no filtro Todos", () => {
      renderPanel();
      expect(screen.getByText("Doação recebida")).toBeInTheDocument();
      expect(screen.getByText("Pedido #42")).toBeInTheDocument();
    });

    it("exibe apenas doacoes ao filtrar por Doacoes", async () => {
      renderPanel();
      await userEvent.click(screen.getByText("Doações"));
      expect(screen.getByText("Doação recebida")).toBeInTheDocument();
      expect(screen.queryByText("Pedido #42")).toBeNull();
    });

    it("exibe apenas pagamentos ao filtrar por Pagamentos", async () => {
      renderPanel();
      await userEvent.click(screen.getByText("Pagamentos"));
      expect(screen.queryByText("Doação recebida")).toBeNull();
      expect(screen.getByText("Pedido #42")).toBeInTheDocument();
    });
  });

  describe("titulos do painel", () => {
    it("exibe titulo Mapa do Bem", () => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [],
        loading: false,
        error: null,
      });
      renderPanel();
      expect(screen.getByText("Mapa do Bem")).toBeInTheDocument();
    });

    it("exibe subtitulo de auditoria publica", () => {
      mockUseMapaDoBem.mockReturnValue({
        activities: [],
        loading: false,
        error: null,
      });
      renderPanel();
      expect(
        screen.getByText("Auditoria pública em tempo real"),
      ).toBeInTheDocument();
    });
  });
});
