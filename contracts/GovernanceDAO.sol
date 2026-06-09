// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { InstitutionRegistry } from "./InstitutionRegistry.sol";
import { PurchaseManager }     from "./PurchaseManager.sol";
import { Treasury }            from "./Treasury.sol";

/// @title GovernanceDAO
/// @notice Ciclo de vida de propostas de governança com votação quadrática.
///
///         [Segurança — Flash Loan]
///         Snapshot no bloco de abertura da proposta. Peso de voto lido de
///         Treasury.votingWeightAtBlock(voter, snapshotBlock).
///
///         [Execução automática]
///         finalize() pode ser chamado por qualquer endereço:
///         - antes do prazo, se o quórum já foi atingido → executa imediatamente
///         - após o prazo, independente do quórum → executa ou rejeita
///         Nenhum ator privilegiado é necessário para executar uma proposta aprovada.
///
///         [Disputas]
///         Resolvidas diretamente em PurchaseManager (seção "Disputas" na UI),
///         não por propostas de governança.
contract GovernanceDAO {

    enum ProposalType {
        ApproveInstitution,
        ApproveSupplier,
        PauseInstitution,
        UnpauseInstitution,
        RemoveInstitution
    }

    enum ProposalStatus {
        Active,   // Em votação
        Executed, // Quórum atingido e ação executada
        Rejected  // Prazo encerrado sem quórum
    }

    struct Proposal {
        uint256        id;
        ProposalType   kind;
        address        target;
        uint256        snapshotBlock;
        uint256        deadline;
        uint256        quorum;
        uint256        yesWeight;
        uint256        noWeight;
        ProposalStatus status;
        // Apenas para ApproveInstitution e ApproveSupplier — emitido em evento,
        // verificado por hash na execução para evitar storage de strings longas.
        bytes32        nameMetadataHash;
    }

    address public immutable operator;
    uint256 public immutable minQuorum;
    uint256 public immutable votingPeriod;

    InstitutionRegistry public immutable registry;
    PurchaseManager     public immutable purchaseManager;
    Treasury            public immutable treasury;

    bool    private _bootstrapped;
    uint256 private _nextProposalId;
    mapping(uint256 => Proposal)                         private _proposals;
    mapping(uint256 => mapping(address => bool))         private _hasVoted;

    error GovernanceDAO__OnlyOperator();
    error GovernanceDAO__ZeroAddress();
    error GovernanceDAO__ProposalNotFound(uint256 proposalId);
    error GovernanceDAO__NotActive(uint256 proposalId);
    error GovernanceDAO__VotingEnded(uint256 proposalId);
    error GovernanceDAO__AlreadyVoted(uint256 proposalId, address voter);
    error GovernanceDAO__NoVotingPower(address voter);
    error GovernanceDAO__NotFinalizable(uint256 proposalId);
    error GovernanceDAO__InvalidNameMetadata(uint256 proposalId);
    error GovernanceDAO__AlreadyBootstrapped();

    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalType    kind,
        address         target,
        uint256         snapshotBlock,
        uint256         deadline,
        uint256         quorum,
        string          name,
        string          metadata
    );
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalRejected(uint256 indexed proposalId);

    modifier onlyOperator() {
        if (msg.sender != operator) revert GovernanceDAO__OnlyOperator();
        _;
    }

    constructor(
        address _operator,
        address _registry,
        address _purchaseManager,
        address _treasury,
        uint256 _minQuorum,
        uint256 _votingPeriod
    ) {
        if (_operator == address(0) || _registry == address(0) ||
            _purchaseManager == address(0) || _treasury == address(0))
            revert GovernanceDAO__ZeroAddress();

        operator        = _operator;
        minQuorum       = _minQuorum;
        votingPeriod    = _votingPeriod;
        registry        = InstitutionRegistry(_registry);
        purchaseManager = PurchaseManager(_purchaseManager);
        treasury        = Treasury(_treasury);
    }

    // -------------------------------------------------------------------------
    // Abertura de proposta — apenas Operador
    // -------------------------------------------------------------------------

    /// @notice Operador abre uma proposta de governança.
    ///         name e metadata são emitidos em evento (não armazenados em storage).
    ///         Para ApproveInstitution e ApproveSupplier, o hash é salvo para
    ///         verificação na execução.
    function propose(
        ProposalType   kind,
        address        target,
        string calldata name,
        string calldata metadata
    ) external onlyOperator returns (uint256 proposalId) {
        if (target == address(0)) revert GovernanceDAO__ZeroAddress();

        bool needsNameMetadata = kind == ProposalType.ApproveInstitution ||
                                 kind == ProposalType.ApproveSupplier;
        bytes32 nameMetadataHash = needsNameMetadata
            ? keccak256(abi.encode(name, metadata))
            : bytes32(0);

        proposalId = ++_nextProposalId;
        _proposals[proposalId] = Proposal({
            id:               proposalId,
            kind:             kind,
            target:           target,
            snapshotBlock:    block.number,
            deadline:         block.timestamp + votingPeriod,
            quorum:           minQuorum,
            yesWeight:        0,
            noWeight:         0,
            status:           ProposalStatus.Active,
            nameMetadataHash: nameMetadataHash
        });

        emit ProposalCreated(
            proposalId, kind, target,
            block.number,
            block.timestamp + votingPeriod,
            minQuorum, name, metadata
        );
    }

    // -------------------------------------------------------------------------
    // Bootstrap — apenas Operador, apenas uma vez
    // -------------------------------------------------------------------------

    /// @notice Retorna true se o registro inicial já foi executado.
    function bootstrapped() external view returns (bool) {
        return _bootstrapped;
    }

    /// @notice Registra a primeira instituição sem votação.
    ///         Só pode ser chamada pelo Operador uma única vez,
    ///         antes de qualquer instituição existir na plataforma.
    function bootstrapRegister(
        address institution,
        string calldata name,
        string calldata areaOfWork
    ) external onlyOperator {
        if (_bootstrapped) revert GovernanceDAO__AlreadyBootstrapped();
        _bootstrapped = true;
        registry.register(institution, name, areaOfWork);
    }

    // -------------------------------------------------------------------------
    // Votação — Doadores
    // -------------------------------------------------------------------------

    /// @notice Doador registra voto a favor (support=true) ou contra (support=false).
    ///         Peso calculado a partir do snapshot do bloco de abertura da proposta.
    ///         Quórum = yesWeight + noWeight. Aprovação exige prazo expirado,
    ///         yesWeight > noWeight e quórum atingido.
    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = _getProposal(proposalId);

        if (p.status != ProposalStatus.Active)
            revert GovernanceDAO__NotActive(proposalId);
        // slither-disable-next-line timestamp
        if (block.timestamp > p.deadline)
            revert GovernanceDAO__VotingEnded(proposalId);
        if (_hasVoted[proposalId][msg.sender])
            revert GovernanceDAO__AlreadyVoted(proposalId, msg.sender);

        uint256 weight = treasury.votingWeightAtBlock(msg.sender, p.snapshotBlock);
        if (weight == 0) revert GovernanceDAO__NoVotingPower(msg.sender);

        _hasVoted[proposalId][msg.sender] = true;

        if (support) {
            p.yesWeight += weight;
        } else {
            p.noWeight += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    // -------------------------------------------------------------------------
    // Finalização — qualquer endereço
    // -------------------------------------------------------------------------

    /// @notice Finaliza a apuração e executa a ação se aprovada.
    ///         Só pode ser chamado após o prazo expirar.
    ///         Aprovação exige: prazo expirado + yesWeight > noWeight + quórum atingido.
    ///         Rejeição: prazo expirou + (quórum não atingido OU noWeight >= yesWeight).
    ///         Para ApproveInstitution/ApproveSupplier: fornecer name e metadata
    ///         originais para verificação. Para outros tipos: passar strings vazias.
    function finalize(
        uint256 proposalId,
        string calldata name,
        string calldata metadata
    ) external {
        Proposal storage p = _getProposal(proposalId);

        if (p.status != ProposalStatus.Active)
            revert GovernanceDAO__NotActive(proposalId);

        // slither-disable-next-line timestamp
        bool deadlinePassed = block.timestamp > p.deadline;

        if (!deadlinePassed)
            revert GovernanceDAO__NotFinalizable(proposalId);

        uint256 totalWeight = p.yesWeight + p.noWeight;
        bool quorumReached  = totalWeight >= p.quorum;
        bool yesWins        = p.yesWeight > p.noWeight;

        if (!quorumReached || !yesWins) {
            p.status = ProposalStatus.Rejected;
            emit ProposalRejected(proposalId);
            return;
        }

        if (p.nameMetadataHash != bytes32(0)) {
            if (keccak256(abi.encode(name, metadata)) != p.nameMetadataHash)
                revert GovernanceDAO__InvalidNameMetadata(proposalId);
        }

        // CEI: estado atualizado antes das interações
        p.status = ProposalStatus.Executed;
        emit ProposalExecuted(proposalId);

        _dispatch(p, name, metadata);
    }

    // -------------------------------------------------------------------------
    // Leitura
    // -------------------------------------------------------------------------

    // Retorna os dados completos de uma proposta pelo ID.
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return _getProposal(proposalId);
    }

    // Verifica se um endereço já votou em uma proposta específica.
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return _hasVoted[proposalId][voter];
    }

    // -------------------------------------------------------------------------
    // Internos
    // -------------------------------------------------------------------------

    // Executa a ação on-chain correspondente ao tipo de proposta aprovada.
    function _dispatch(
        Proposal storage p,
        string calldata name,
        string calldata metadata
    ) private {
        if (p.kind == ProposalType.ApproveInstitution) {
            registry.register(p.target, name, metadata);

        } else if (p.kind == ProposalType.ApproveSupplier) {
            purchaseManager.approveSupplier(p.target, name, metadata);

        } else if (p.kind == ProposalType.PauseInstitution) {
            registry.pause(p.target);

        } else if (p.kind == ProposalType.UnpauseInstitution) {
            registry.unpause(p.target);

        } else if (p.kind == ProposalType.RemoveInstitution) {
            registry.remove(p.target);
            treasury.seizeToVault(p.target);
        }
    }

    // Busca uma proposta pelo ID; reverte com ProposalNotFound se não existir.
    function _getProposal(uint256 proposalId) private view returns (Proposal storage) {
        Proposal storage p = _proposals[proposalId];
        if (p.id == 0) revert GovernanceDAO__ProposalNotFound(proposalId);
        return p;
    }
}
