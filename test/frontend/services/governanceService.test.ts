import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  KINDS_REQUIRING_NAME,
  validateProposalForm,
  validateBootstrapForm,
  fetchProposals,
  fetchHasVoted,
  fetchIsBootstrapped,
  getMetadataLabel,
  formatTimeRemaining,
  computeEffectiveStatus,
  getProposalStatusLabel,
  ProposalStatus,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_KIND_LABELS,
  type FormState,
  type BootstrapFormState,
  type Proposal,
} from "@/services/governanceService";

const { mockQueryFilter, mockGetProposal, mockHasVoted, mockBootstrapped } =
  vi.hoisted(() => ({
    mockQueryFilter: vi.fn(),
    mockGetProposal: vi.fn(),
    mockHasVoted: vi.fn(),
    mockBootstrapped: vi.fn(),
  }));

vi.mock("@/services/contractService", () => ({
  getGovernanceDAOContract: vi.fn(() => ({
    filters: { ProposalCreated: vi.fn().mockReturnValue({}) },
    queryFilter: mockQueryFilter,
    getProposal: mockGetProposal,
    hasVoted: mockHasVoted,
    bootstrapped: mockBootstrapped,
  })),
}));

const VALID_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

function baseForm(overrides: Partial<FormState> = {}): FormState {
  return {
    kind: "2",
    target: VALID_ADDRESS,
    name: "",
    metadata: "",
    ...overrides,
  };
}

// =========================================================================
// KINDS_REQUIRING_NAME — apenas kinds que exibem campo Nome
// =========================================================================

describe("KINDS_REQUIRING_NAME", () => {
  it("inclui ApproveInstitution ('0')", () => {
    expect(KINDS_REQUIRING_NAME.has("0")).toBe(true);
  });

  it("inclui ApproveSupplier ('1')", () => {
    expect(KINDS_REQUIRING_NAME.has("1")).toBe(true);
  });

  it("não inclui PauseInstitution ('2')", () => {
    expect(KINDS_REQUIRING_NAME.has("2")).toBe(false);
  });

  it("não inclui UnpauseInstitution ('3')", () => {
    expect(KINDS_REQUIRING_NAME.has("3")).toBe(false);
  });

  it("não inclui RemoveInstitution ('4')", () => {
    expect(KINDS_REQUIRING_NAME.has("4")).toBe(false);
  });

  it("contém exatamente 2 entradas", () => {
    expect(KINDS_REQUIRING_NAME.size).toBe(2);
  });
});

// =========================================================================
// getMetadataLabel — label dinâmico do campo metadata
// =========================================================================

describe("getMetadataLabel", () => {
  it("kind 0 retorna 'Área de Atuação'", () => {
    expect(getMetadataLabel("0")).toBe("Área de Atuação");
  });

  it("kind 1 retorna 'Tipo de Serviço'", () => {
    expect(getMetadataLabel("1")).toBe("Tipo de Serviço");
  });

  it("kind 2 retorna 'Motivo da Proposta'", () => {
    expect(getMetadataLabel("2")).toBe("Motivo da Proposta");
  });

  it("kind 3 retorna 'Motivo da Proposta'", () => {
    expect(getMetadataLabel("3")).toBe("Motivo da Proposta");
  });

  it("kind 4 retorna 'Motivo da Proposta'", () => {
    expect(getMetadataLabel("4")).toBe("Motivo da Proposta");
  });
});

// =========================================================================
// PROPOSAL_STATUS_LABELS
// =========================================================================

describe("PROPOSAL_STATUS_LABELS", () => {
  it("mapeia todos os 4 status", () => {
    expect(PROPOSAL_STATUS_LABELS[ProposalStatus.Active]).toBe("Em Votação");
    expect(PROPOSAL_STATUS_LABELS[ProposalStatus.Approved]).toBe("APROVADA");
    expect(PROPOSAL_STATUS_LABELS[ProposalStatus.Rejected]).toBe("REJEITADA");
    expect(PROPOSAL_STATUS_LABELS[ProposalStatus.Executed]).toBe("EXECUTADA");
  });
});

// =========================================================================
// PROPOSAL_KIND_LABELS — deve refletir o enum do contrato
// =========================================================================

describe("PROPOSAL_KIND_LABELS", () => {
  it("0 = Aprovar Instituição", () => {
    expect(PROPOSAL_KIND_LABELS[0]).toBe("Aprovar Instituição");
  });

  it("1 = Aprovar Fornecedor", () => {
    expect(PROPOSAL_KIND_LABELS[1]).toBe("Aprovar Fornecedor");
  });

  it("2 = Pausar Instituição", () => {
    expect(PROPOSAL_KIND_LABELS[2]).toBe("Pausar Instituição");
  });

  it("3 = Despausar Instituição", () => {
    expect(PROPOSAL_KIND_LABELS[3]).toBe("Despausar Instituição");
  });

  it("4 = Remover Instituição", () => {
    expect(PROPOSAL_KIND_LABELS[4]).toBe("Remover Instituição");
  });
});

// =========================================================================
// formatTimeRemaining
// =========================================================================

describe("formatTimeRemaining", () => {
  const NOW = 1_000_000; // segundos Unix fixo para testes

  it("retorna 'Expirada' quando deadline já passou", () => {
    expect(formatTimeRemaining(BigInt(NOW - 1), NOW)).toBe("Expirada");
  });

  it("retorna 'Expirada' quando deadline é exatamente agora", () => {
    expect(formatTimeRemaining(BigInt(NOW), NOW)).toBe("Expirada");
  });

  it("retorna minutos quando faltam menos de 1 hora", () => {
    const deadline = BigInt(NOW + 30 * 60); // 30 min
    expect(formatTimeRemaining(deadline, NOW)).toBe("30min");
  });

  it("retorna horas e minutos quando falta menos de 1 dia", () => {
    const deadline = BigInt(NOW + 5 * 3600 + 20 * 60); // 5h20min
    expect(formatTimeRemaining(deadline, NOW)).toBe("5h 20min");
  });

  it("retorna dias e horas quando falta mais de 1 dia", () => {
    const deadline = BigInt(NOW + 3 * 86400 + 6 * 3600); // 3d 6h
    expect(formatTimeRemaining(deadline, NOW)).toBe("3d 6h");
  });

  it("retorna '1d 0h' para exatamente 1 dia restante", () => {
    const deadline = BigInt(NOW + 86400);
    expect(formatTimeRemaining(deadline, NOW)).toBe("1d 0h");
  });
});

// =========================================================================
// fetchProposals — lê campos corretos do struct Solidity:
// id, deadline, totalWeight (não proposalId, commitDeadline, totalVoteWeight)
// =========================================================================

describe("fetchProposals", () => {
  const mockProvider = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna array vazio quando não há eventos", async () => {
    mockQueryFilter.mockResolvedValue([]);
    const proposals = await fetchProposals(mockProvider);
    expect(proposals).toEqual([]);
  });

  it("retorna proposta mapeando campos corretos do contrato", async () => {
    mockQueryFilter.mockResolvedValue([
      {
        args: { proposalId: 1n, name: "ONG Exemplo", metadata: "educacao" },
      },
    ]);
    // Nomes de campo espelham exatamente o struct Solidity
    mockGetProposal.mockResolvedValue({
      id: 1n,
      kind: 0,
      target: "0xABC",
      snapshotBlock: 100n,
      deadline: 9999999n,
      quorum: 100n,
      yesWeight: 30n,
      noWeight: 20n,
      status: 0, // Active no contrato
      nameMetadataHash: "0x" + "00".repeat(32),
    });

    const proposals = await fetchProposals(mockProvider);

    expect(proposals).toHaveLength(1);
    expect(proposals[0].proposalId).toBe(1n);
    expect(proposals[0].deadline).toBe(9999999n);
    expect(proposals[0].yesWeight).toBe(30n);
    expect(proposals[0].noWeight).toBe(20n);
    expect(proposals[0].quorum).toBe(100n);
    expect(proposals[0].name).toBe("ONG Exemplo");
    expect(proposals[0].metadata).toBe("educacao");
    expect(proposals[0].status).toBe(ProposalStatus.Active);
    expect(proposals[0].kind).toBe(0);
    expect(proposals[0].target).toBe("0xABC");
  });

  it("mapeia status Executed do contrato (1) corretamente", async () => {
    mockQueryFilter.mockResolvedValue([
      { args: { proposalId: 1n, name: "", metadata: "" } },
    ]);
    mockGetProposal.mockResolvedValue({
      id: 1n,
      kind: 2,
      target: "0xABC",
      snapshotBlock: 0n,
      deadline: 0n,
      quorum: 10n,
      yesWeight: 10n,
      noWeight: 0n,
      status: 1, // Executed no contrato
      nameMetadataHash: "0x" + "00".repeat(32),
    });

    const proposals = await fetchProposals(mockProvider);

    expect(proposals[0].status).toBe(ProposalStatus.Executed);
  });

  it("chama getProposal para cada evento encontrado", async () => {
    mockQueryFilter.mockResolvedValue([
      { args: { proposalId: 1n, name: "A", metadata: "" } },
      { args: { proposalId: 2n, name: "B", metadata: "" } },
    ]);
    mockGetProposal.mockResolvedValue({
      id: 1n,
      kind: 2,
      target: "0xABC",
      snapshotBlock: 0n,
      deadline: 0n,
      quorum: 10n,
      yesWeight: 0n,
      noWeight: 0n,
      status: 0,
      nameMetadataHash: "0x" + "00".repeat(32),
    });

    const proposals = await fetchProposals(mockProvider);

    expect(mockGetProposal).toHaveBeenCalledTimes(2);
    expect(proposals).toHaveLength(2);
  });
});

// =========================================================================
// validateProposalForm — caminhos felizes e tristes
// =========================================================================

describe("validateProposalForm", () => {
  // --- Caminho feliz ---

  it("formulário válido para ApproveInstitution (kind 0) com nome e metadata", () => {
    const errors = validateProposalForm(
      baseForm({ kind: "0", name: "ONG Solar", metadata: "educacao" }),
    );
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("formulário válido para ApproveSupplier (kind 1) com nome e metadata", () => {
    const errors = validateProposalForm(
      baseForm({ kind: "1", name: "Fornecedor X", metadata: "logistica" }),
    );
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("formulário válido para PauseInstitution (kind 2) com motivo", () => {
    const errors = validateProposalForm(
      baseForm({ kind: "2", metadata: "Suspeita de fraude" }),
    );
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("formulário válido para UnpauseInstitution (kind 3) com motivo", () => {
    const errors = validateProposalForm(
      baseForm({ kind: "3", metadata: "Investigação concluída" }),
    );
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("formulário válido para RemoveInstitution (kind 4) com motivo", () => {
    const errors = validateProposalForm(
      baseForm({ kind: "4", metadata: "Fraude comprovada" }),
    );
    expect(Object.keys(errors)).toHaveLength(0);
  });

  // --- Caminho triste: campos obrigatórios ausentes ---

  it("retorna erro quando kind não está selecionado", () => {
    const errors = validateProposalForm(baseForm({ kind: "" }));
    expect(errors.kind).toMatch(/selecione/i);
  });

  it("retorna erro para endereço vazio", () => {
    const errors = validateProposalForm(baseForm({ target: "" }));
    expect(errors.target).toBeDefined();
  });

  it("retorna erro para endereço inválido", () => {
    const errors = validateProposalForm(baseForm({ target: "invalido" }));
    expect(errors.target).toMatch(/inválido/i);
  });

  it("exige nome para ApproveInstitution (kind 0)", () => {
    const errors = validateProposalForm(
      baseForm({ kind: "0", name: "", metadata: "educacao" }),
    );
    expect(errors.name).toBeDefined();
  });

  it("exige nome para ApproveSupplier (kind 1)", () => {
    const errors = validateProposalForm(
      baseForm({ kind: "1", name: "", metadata: "logistica" }),
    );
    expect(errors.name).toBeDefined();
  });

  it("exige metadata para ApproveInstitution (kind 0)", () => {
    const errors = validateProposalForm(
      baseForm({ kind: "0", name: "ONG Solar", metadata: "" }),
    );
    expect(errors.metadata).toBeDefined();
  });

  it("exige metadata para ApproveSupplier (kind 1)", () => {
    const errors = validateProposalForm(
      baseForm({ kind: "1", name: "Fornecedor X", metadata: "" }),
    );
    expect(errors.metadata).toBeDefined();
  });

  it("exige metadata (motivo) para PauseInstitution (kind 2)", () => {
    const errors = validateProposalForm(baseForm({ kind: "2", metadata: "" }));
    expect(errors.metadata).toBeDefined();
  });

  it("exige metadata (motivo) para UnpauseInstitution (kind 3)", () => {
    const errors = validateProposalForm(baseForm({ kind: "3", metadata: "" }));
    expect(errors.metadata).toBeDefined();
  });

  it("exige metadata (motivo) para RemoveInstitution (kind 4)", () => {
    const errors = validateProposalForm(baseForm({ kind: "4", metadata: "" }));
    expect(errors.metadata).toBeDefined();
  });

  it("não exige nome para PauseInstitution (kind 2)", () => {
    const errors = validateProposalForm(
      baseForm({ kind: "2", name: "", metadata: "motivo" }),
    );
    expect(errors.name).toBeUndefined();
  });

  it("não exige nome para UnpauseInstitution (kind 3)", () => {
    const errors = validateProposalForm(
      baseForm({ kind: "3", name: "", metadata: "motivo" }),
    );
    expect(errors.name).toBeUndefined();
  });

  it("não exige nome para RemoveInstitution (kind 4)", () => {
    const errors = validateProposalForm(
      baseForm({ kind: "4", name: "", metadata: "motivo" }),
    );
    expect(errors.name).toBeUndefined();
  });
});

// =========================================================================
// computeEffectiveStatus — status derivado para exibição no frontend.
// Aprovação exige: prazo expirado + yesWeight > noWeight + quórum atingido.
// =========================================================================

function makeProposal(
  overrides: Partial<Proposal> = {},
): Pick<Proposal, "status" | "deadline" | "yesWeight" | "noWeight" | "quorum"> {
  return {
    status: ProposalStatus.Active,
    deadline: BigInt(1_000_060), // 60s após NOW
    yesWeight: BigInt(0),
    noWeight: BigInt(0),
    quorum: BigInt(100),
    ...overrides,
  };
}

const NOW = 1_000_000; // segundos Unix fixo para testes

describe("computeEffectiveStatus", () => {
  it("retorna Active quando prazo não expirou", () => {
    const p = makeProposal({ deadline: BigInt(NOW + 60) });
    expect(computeEffectiveStatus(p, NOW)).toBe(ProposalStatus.Active);
  });

  it("retorna Active quando prazo não expirou mesmo com quórum atingido", () => {
    // Nova regra: aprovação só após prazo — quórum antes do prazo não antecipa
    const p = makeProposal({
      deadline: BigInt(NOW + 3600),
      yesWeight: BigInt(150),
      noWeight: BigInt(0),
      quorum: BigInt(100),
    });
    expect(computeEffectiveStatus(p, NOW)).toBe(ProposalStatus.Active);
  });

  it("retorna Rejected quando prazo expirou sem quórum", () => {
    const p = makeProposal({
      deadline: BigInt(NOW - 1),
      yesWeight: BigInt(0),
      noWeight: BigInt(0),
      quorum: BigInt(100),
    });
    expect(computeEffectiveStatus(p, NOW)).toBe(ProposalStatus.Rejected);
  });

  it("retorna Rejected quando deadline é exatamente agora", () => {
    const p = makeProposal({
      deadline: BigInt(NOW),
      yesWeight: BigInt(0),
      noWeight: BigInt(0),
      quorum: BigInt(100),
    });
    expect(computeEffectiveStatus(p, NOW)).toBe(ProposalStatus.Rejected);
  });

  it("retorna Approved quando prazo expirou, quórum atingido e yesWeight > noWeight", () => {
    const p = makeProposal({
      deadline: BigInt(NOW - 1),
      yesWeight: BigInt(80),
      noWeight: BigInt(20),
      quorum: BigInt(100),
    });
    expect(computeEffectiveStatus(p, NOW)).toBe(ProposalStatus.Approved);
  });

  it("retorna Rejected quando prazo expirou com noWeight >= yesWeight", () => {
    const p = makeProposal({
      deadline: BigInt(NOW - 1),
      yesWeight: BigInt(50),
      noWeight: BigInt(60),
      quorum: BigInt(100),
    });
    expect(computeEffectiveStatus(p, NOW)).toBe(ProposalStatus.Rejected);
  });

  it("retorna Rejected quando prazo expirou com empate (yesWeight === noWeight)", () => {
    const p = makeProposal({
      deadline: BigInt(NOW - 1),
      yesWeight: BigInt(50),
      noWeight: BigInt(50),
      quorum: BigInt(100),
    });
    expect(computeEffectiveStatus(p, NOW)).toBe(ProposalStatus.Rejected);
  });

  it("preserva Executed quando status on-chain já é Executed", () => {
    const p = makeProposal({ status: ProposalStatus.Executed });
    expect(computeEffectiveStatus(p, NOW)).toBe(ProposalStatus.Executed);
  });

  it("preserva Rejected quando status on-chain já é Rejected", () => {
    const p = makeProposal({ status: ProposalStatus.Rejected });
    expect(computeEffectiveStatus(p, NOW)).toBe(ProposalStatus.Rejected);
  });
});

// =========================================================================
// getProposalStatusLabel — rótulo amigável distinguindo QUÓRUM NÃO ATINGIDO
// =========================================================================

describe("getProposalStatusLabel", () => {
  it("retorna 'Em Votação' quando proposta ainda está ativa", () => {
    const p = makeProposal({
      deadline: BigInt(NOW + 9999),
      yesWeight: BigInt(0),
      noWeight: BigInt(0),
      quorum: BigInt(100),
    });
    expect(getProposalStatusLabel(p, NOW)).toBe("Em Votação");
  });

  it("retorna 'APROVADA' quando quórum atingido e yesWeight vence", () => {
    const p = makeProposal({
      deadline: BigInt(NOW - 1),
      yesWeight: BigInt(80),
      noWeight: BigInt(20),
      quorum: BigInt(100),
    });
    expect(getProposalStatusLabel(p, NOW)).toBe("APROVADA");
  });

  it("retorna 'QUÓRUM NÃO ATINGIDO' quando totalWeight < quorum após prazo", () => {
    const p = makeProposal({
      deadline: BigInt(NOW - 1),
      yesWeight: BigInt(30),
      noWeight: BigInt(20),
      quorum: BigInt(100),
    });
    expect(getProposalStatusLabel(p, NOW)).toBe("QUÓRUM NÃO ATINGIDO");
  });

  it("retorna 'REJEITADA' quando quórum atingido mas noWeight >= yesWeight", () => {
    const p = makeProposal({
      deadline: BigInt(NOW - 1),
      yesWeight: BigInt(40),
      noWeight: BigInt(60),
      quorum: BigInt(100),
    });
    expect(getProposalStatusLabel(p, NOW)).toBe("REJEITADA");
  });

  it("retorna 'APROVADA' quando status é Executed (proposta aprovada e executada)", () => {
    const p = makeProposal({ status: ProposalStatus.Executed });
    expect(getProposalStatusLabel(p, NOW)).toBe("APROVADA");
  });
});

// =========================================================================
// fetchHasVoted — lê se doador já votou em proposta
// =========================================================================

describe("fetchHasVoted", () => {
  const mockProvider = {} as never;
  const VOTER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna true quando doador já votou", async () => {
    mockHasVoted.mockResolvedValue(true);
    const result = await fetchHasVoted(1n, VOTER, mockProvider);
    expect(result).toBe(true);
    expect(mockHasVoted).toHaveBeenCalledWith(1n, VOTER);
  });

  it("retorna false quando doador não votou", async () => {
    mockHasVoted.mockResolvedValue(false);
    const result = await fetchHasVoted(1n, VOTER, mockProvider);
    expect(result).toBe(false);
  });
});

// =========================================================================
// validateBootstrapForm — validação do formulário de registro inicial
// =========================================================================

const VALID_ETH_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

function baseBootstrapForm(
  overrides: Partial<BootstrapFormState> = {},
): BootstrapFormState {
  return {
    address: VALID_ETH_ADDRESS,
    name: "ONG Bootstrap",
    areaOfWork: "saude",
    ...overrides,
  };
}

describe("validateBootstrapForm", () => {
  // --- Caminho feliz ---

  it("formulário válido com todos os campos preenchidos corretamente", () => {
    const errors = validateBootstrapForm(baseBootstrapForm());
    expect(Object.keys(errors)).toHaveLength(0);
  });

  // --- Endereço ---

  it("retorna erro quando endereço está vazio", () => {
    const errors = validateBootstrapForm(baseBootstrapForm({ address: "" }));
    expect(errors.address).toMatch(/obrigatório/i);
  });

  it("retorna erro quando endereço é inválido", () => {
    const errors = validateBootstrapForm(
      baseBootstrapForm({ address: "nao-e-um-endereco" }),
    );
    expect(errors.address).toMatch(/inválido/i);
  });

  it("aceita endereço Ethereum válido sem erro", () => {
    const errors = validateBootstrapForm(baseBootstrapForm());
    expect(errors.address).toBeUndefined();
  });

  // --- Nome ---

  it("retorna erro quando nome está vazio", () => {
    const errors = validateBootstrapForm(baseBootstrapForm({ name: "" }));
    expect(errors.name).toMatch(/obrigatório/i);
  });

  it("retorna erro quando nome contém apenas espaços", () => {
    const errors = validateBootstrapForm(baseBootstrapForm({ name: "   " }));
    expect(errors.name).toMatch(/obrigatório/i);
  });

  // --- Área de atuação ---

  it("retorna erro quando área de atuação está vazia", () => {
    const errors = validateBootstrapForm(baseBootstrapForm({ areaOfWork: "" }));
    expect(errors.areaOfWork).toMatch(/obrigat/i);
  });

  it("retorna erro quando área de atuação contém apenas espaços", () => {
    const errors = validateBootstrapForm(
      baseBootstrapForm({ areaOfWork: "   " }),
    );
    expect(errors.areaOfWork).toMatch(/obrigat/i);
  });

  // --- Múltiplos erros simultâneos ---

  it("retorna todos os erros quando formulário está completamente vazio", () => {
    const errors = validateBootstrapForm({
      address: "",
      name: "",
      areaOfWork: "",
    });
    expect(errors.address).toBeDefined();
    expect(errors.name).toBeDefined();
    expect(errors.areaOfWork).toBeDefined();
  });
});

// =========================================================================
// fetchIsBootstrapped — lê estado do registro inicial no contrato
// =========================================================================

describe("fetchIsBootstrapped", () => {
  const mockProvider = {} as never;

  it("retorna true quando contrato indica que bootstrap foi realizado", async () => {
    mockBootstrapped.mockResolvedValue(true);
    const result = await fetchIsBootstrapped(mockProvider);
    expect(result).toBe(true);
  });

  it("retorna false quando contrato indica que bootstrap não foi realizado", async () => {
    mockBootstrapped.mockResolvedValue(false);
    const result = await fetchIsBootstrapped(mockProvider);
    expect(result).toBe(false);
  });
});
