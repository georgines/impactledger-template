import { describe, it, expect } from "vitest";
import { translateContractError } from "@/services/contractErrors";

// Seletor pré-calculado e verificado para GovernanceDAO__NoVotingPower(address)
// keccak256("GovernanceDAO__NoVotingPower(address)") = 0xcf444d83...
const NO_VOTING_POWER_SELECTOR = "0xcf444d83";
const DUMMY_ADDRESS_PADDED =
  "00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8";

function errWithData(
  selector: string,
  extraData = DUMMY_ADDRESS_PADDED,
): Error {
  return Object.assign(new Error("execution reverted (unknown custom error)"), {
    data: selector + extraData,
  });
}

// ---------------------------------------------------------------------------
// Matching por seletor em err.data (caso "unknown custom error" do ethers)
// ---------------------------------------------------------------------------
describe("translateContractError — matching por seletor", () => {
  it("traduz GovernanceDAO__NoVotingPower pelo seletor hex", () => {
    const err = errWithData(NO_VOTING_POWER_SELECTOR);
    expect(translateContractError(err)).toBe(
      "Você não tem poder de voto nesta proposta.",
    );
  });

  it("retorna mensagem genérica quando seletor não está no mapa", () => {
    const err = errWithData("0xdeadbeef");
    expect(translateContractError(err)).toBe(
      "Ocorreu um erro inesperado. Tente novamente.",
    );
  });

  it("ignora err.data com menos de 10 caracteres", () => {
    const err = Object.assign(new Error("GovernanceDAO__NotActive()"), {
      data: "0xcf",
    });
    // Deve cair no name matching e traduzir pelo nome
    expect(translateContractError(err)).toBe(
      "Esta proposta não está mais ativa.",
    );
  });

  it("funciona quando err.data não está presente", () => {
    const err = new Error("GovernanceDAO__AlreadyVoted(1, 0xabc)");
    expect(translateContractError(err)).toBe("Você já votou nesta proposta.");
  });
});

// ---------------------------------------------------------------------------
// Matching por nome em err.message
// ---------------------------------------------------------------------------
describe("translateContractError — matching por nome — GovernanceDAO", () => {
  it("traduz GovernanceDAO__AlreadyVoted", () => {
    expect(
      translateContractError(
        new Error("execution reverted: GovernanceDAO__AlreadyVoted(1, 0xabc)"),
      ),
    ).toBe("Você já votou nesta proposta.");
  });

  it("traduz GovernanceDAO__VotingEnded", () => {
    expect(
      translateContractError(new Error("GovernanceDAO__VotingEnded(1)")),
    ).toBe("O prazo de votação encerrou.");
  });

  it("traduz GovernanceDAO__NotFinalizable", () => {
    expect(
      translateContractError(
        new Error("execution reverted: GovernanceDAO__NotFinalizable()"),
      ),
    ).toBe(
      "A proposta ainda não pode ser finalizada. Aguarde o prazo encerrar.",
    );
  });

  it("traduz GovernanceDAO__NotActive", () => {
    expect(
      translateContractError(
        new Error("execution reverted: GovernanceDAO__NotActive()"),
      ),
    ).toBe("Esta proposta não está mais ativa.");
  });

  it("traduz GovernanceDAO__InvalidNameMetadata", () => {
    expect(
      translateContractError(new Error("GovernanceDAO__InvalidNameMetadata()")),
    ).toBe(
      "Dados da proposta inválidos. Recarregue a página e tente novamente.",
    );
  });

  it("traduz GovernanceDAO__ProposalNotFound", () => {
    expect(
      translateContractError(new Error("GovernanceDAO__ProposalNotFound(5)")),
    ).toBe("Proposta não encontrada.");
  });

  it("traduz GovernanceDAO__OnlyOperator", () => {
    expect(
      translateContractError(new Error("GovernanceDAO__OnlyOperator()")),
    ).toBe("Apenas o operador pode executar esta ação.");
  });
});

describe("translateContractError — matching por nome — PurchaseManager", () => {
  it("traduz PurchaseManager__EmptyProofHash", () => {
    expect(
      translateContractError(new Error("PurchaseManager__EmptyProofHash()")),
    ).toBe("O comprovante de impacto não pode ser vazio.");
  });

  it("traduz PurchaseManager__OnlyInstitution", () => {
    expect(
      translateContractError(
        new Error("PurchaseManager__OnlyInstitution(1, 0xabc)"),
      ),
    ).toBe("Apenas a instituição responsável pode executar esta ação.");
  });

  it("traduz PurchaseManager__OnlySupplier", () => {
    expect(
      translateContractError(
        new Error("PurchaseManager__OnlySupplier(1, 0xabc)"),
      ),
    ).toBe("Apenas o fornecedor contratado pode executar esta ação.");
  });

  it("traduz PurchaseManager__InvalidStatus", () => {
    expect(
      translateContractError(
        new Error("PurchaseManager__InvalidStatus(1, 0, 1)"),
      ),
    ).toBe("Status inválido para esta operação.");
  });

  it("traduz PurchaseManager__DisputeWindowClosed", () => {
    expect(
      translateContractError(
        new Error("PurchaseManager__DisputeWindowClosed(1)"),
      ),
    ).toBe("O período de disputa está encerrado.");
  });

  it("traduz PurchaseManager__NoVotingPower", () => {
    expect(
      translateContractError(
        new Error("PurchaseManager__NoVotingPower(0xabc)"),
      ),
    ).toBe("Você não tem poder de voto nesta disputa.");
  });

  it("traduz PurchaseManager__AlreadyVoted", () => {
    expect(
      translateContractError(
        new Error("PurchaseManager__AlreadyVoted(1, 0xabc)"),
      ),
    ).toBe("Você já votou nesta disputa.");
  });

  it("traduz PurchaseManager__NotFinalizable", () => {
    expect(
      translateContractError(new Error("PurchaseManager__NotFinalizable(1)")),
    ).toBe("O pedido de compra ainda não pode ser finalizado.");
  });

  it("traduz PurchaseManager__PurchaseNotFound", () => {
    expect(
      translateContractError(new Error("PurchaseManager__PurchaseNotFound(9)")),
    ).toBe("Pedido de compra não encontrado.");
  });
});

describe("translateContractError — matching por nome — Treasury", () => {
  it("traduz Treasury__InsufficientBalance", () => {
    expect(
      translateContractError(
        new Error("Treasury__InsufficientBalance(0xabc, 50, 100)"),
      ),
    ).toBe("Saldo insuficiente para esta operação.");
  });

  it("traduz Treasury__TransferFailed", () => {
    expect(
      translateContractError(new Error("Treasury__TransferFailed()")),
    ).toBe("Falha na transferência de fundos. Tente novamente.");
  });

  it("traduz Treasury__InstitutionNotActive", () => {
    expect(
      translateContractError(
        new Error("Treasury__InstitutionNotActive(0xabc)"),
      ),
    ).toBe("Instituição não está ativa.");
  });
});

describe("translateContractError — matching por nome — InstitutionRegistry", () => {
  it("traduz InstitutionRegistry__AlreadyRegistered", () => {
    expect(
      translateContractError(
        new Error("InstitutionRegistry__AlreadyRegistered(0xabc)"),
      ),
    ).toBe("Esta instituição já está registrada.");
  });

  it("traduz InstitutionRegistry__InvalidTransition", () => {
    expect(
      translateContractError(
        new Error("InstitutionRegistry__InvalidTransition(0, 2)"),
      ),
    ).toBe("Transição de status inválida.");
  });
});

describe("translateContractError — matching por nome — SupplierRegistry", () => {
  it("traduz SupplierRegistry__NotWhitelisted", () => {
    expect(
      translateContractError(
        new Error(
          "execution reverted: SupplierRegistry__NotWhitelisted(0xabc)",
        ),
      ),
    ).toBe(
      "Este fornecedor não está aprovado na lista de fornecedores confiáveis.",
    );
  });

  it("traduz SupplierRegistry__AlreadyWhitelisted", () => {
    expect(
      translateContractError(
        new Error("SupplierRegistry__AlreadyWhitelisted(0xabc)"),
      ),
    ).toBe("Este fornecedor já está aprovado.");
  });

  it("traduz SupplierRegistry__ZeroAddress", () => {
    expect(
      translateContractError(new Error("SupplierRegistry__ZeroAddress()")),
    ).toBe("Endereço inválido.");
  });
});

// ---------------------------------------------------------------------------
// Erros de carteira/provider (ethers ErrorCode) — não são reverts de contrato
// ---------------------------------------------------------------------------
describe("translateContractError — códigos de erro de carteira/provider", () => {
  it("traduz INSUFFICIENT_FUNDS para mensagem de saldo insuficiente", () => {
    const err = Object.assign(
      new Error("insufficient funds for intrinsic transaction cost"),
      {
        code: "INSUFFICIENT_FUNDS",
      },
    );
    expect(translateContractError(err)).toBe(
      "Saldo insuficiente na carteira para cobrir o valor e a taxa de rede.",
    );
  });

  it("traduz CALL_EXCEPTION para mensagem de simulação falha", () => {
    const err = Object.assign(new Error("execution reverted"), {
      code: "CALL_EXCEPTION",
    });
    expect(translateContractError(err)).toBe(
      "Não foi possível simular a transação. Verifique os dados informados ou tente novamente.",
    );
  });

  it("traduz UNPREDICTABLE_GAS_LIMIT para mensagem de simulação falha", () => {
    const err = Object.assign(new Error("cannot estimate gas"), {
      code: "UNPREDICTABLE_GAS_LIMIT",
    });
    expect(translateContractError(err)).toBe(
      "Não foi possível simular a transação. Verifique os dados informados ou tente novamente.",
    );
  });

  it("traduz NETWORK_ERROR para mensagem de falha de conexão", () => {
    const err = Object.assign(new Error("could not detect network"), {
      code: "NETWORK_ERROR",
    });
    expect(translateContractError(err)).toBe(
      "Falha de conexão com a rede. Verifique sua internet e tente novamente.",
    );
  });

  it("traduz TIMEOUT para mensagem de falha de conexão", () => {
    const err = Object.assign(new Error("timeout exceeded"), {
      code: "TIMEOUT",
    });
    expect(translateContractError(err)).toBe(
      "Falha de conexão com a rede. Verifique sua internet e tente novamente.",
    );
  });

  it("traduz NONCE_EXPIRED para mensagem de transação pendente", () => {
    const err = Object.assign(new Error("nonce has already been used"), {
      code: "NONCE_EXPIRED",
    });
    expect(translateContractError(err)).toBe(
      "Já existe uma transação pendente. Aguarde ela confirmar ou ajuste a taxa de gás.",
    );
  });

  it("traduz REPLACEMENT_UNDERPRICED para mensagem de transação pendente", () => {
    const err = Object.assign(new Error("replacement fee too low"), {
      code: "REPLACEMENT_UNDERPRICED",
    });
    expect(translateContractError(err)).toBe(
      "Já existe uma transação pendente. Aguarde ela confirmar ou ajuste a taxa de gás.",
    );
  });

  it("código de erro de carteira desconhecido cai no fallback genérico", () => {
    const err = Object.assign(new Error("algo aconteceu"), {
      code: "BUFFER_OVERRUN",
    });
    expect(translateContractError(err)).toBe(
      "Ocorreu um erro inesperado. Tente novamente.",
    );
  });
});

// ---------------------------------------------------------------------------
// Rejeição de transação pelo usuário
// ---------------------------------------------------------------------------
describe("translateContractError — rejeição de transação", () => {
  it("traduz rejeição com code 4001 (MetaMask padrão)", () => {
    const err = Object.assign(new Error("User rejected the request."), {
      code: 4001,
    });
    expect(translateContractError(err)).toBe(
      "Transação cancelada pelo usuário.",
    );
  });

  it("traduz rejeição com code ACTION_REJECTED (ethers v6)", () => {
    const err = Object.assign(new Error("user rejected action"), {
      code: "ACTION_REJECTED",
    });
    expect(translateContractError(err)).toBe(
      "Transação cancelada pelo usuário.",
    );
  });

  it("traduz rejeição quando mensagem contém ACTION_REJECTED", () => {
    const err = new Error("ACTION_REJECTED: user denied transaction");
    expect(translateContractError(err)).toBe(
      "Transação cancelada pelo usuário.",
    );
  });
});

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------
describe("translateContractError — fallback", () => {
  it("retorna mensagem genérica para erro completamente desconhecido", () => {
    expect(translateContractError(new Error("Network timeout"))).toBe(
      "Ocorreu um erro inesperado. Tente novamente.",
    );
  });

  it("retorna mensagem genérica quando input não é Error", () => {
    expect(translateContractError("string de erro")).toBe(
      "Ocorreu um erro inesperado. Tente novamente.",
    );
  });

  it("retorna mensagem genérica para null", () => {
    expect(translateContractError(null)).toBe(
      "Ocorreu um erro inesperado. Tente novamente.",
    );
  });
});
