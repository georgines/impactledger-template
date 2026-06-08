// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IInstitutionRegistry } from "./InstitutionRegistry.sol";
import { Treasury }             from "./Treasury.sol";
import { SupplierRegistry }     from "./lib/SupplierRegistry.sol";

/// @title PurchaseManager
/// @notice Orquestra o fluxo operacional completo:
///         abertura → entrega → confirmação + PoI → pagamento → disputa → veredicto.
///
///         Disputas são votadas diretamente pelos Doadores aqui, sem intermediação
///         do GovernanceDAO — alinhado com a separação de "Votações" e "Disputas" na UI.
contract PurchaseManager {

    using SupplierRegistry for SupplierRegistry.Registry;

    enum PurchaseStatus {
        Open,       // Solicitação aberta, valor reservado
        Delivered,  // Fornecedor confirmou entrega on-chain
        Confirmed,  // Instituição confirmou recebimento on-chain
        Disputed,   // Disputa aberta automaticamente após prazo
        Paid,       // Pagamento liberado ao fornecedor
        Refunded    // Valor devolvido à instituição
    }

    struct Purchase {
        uint256        purchaseId;
        address        institution;
        address        supplier;
        uint256        amount;
        bytes32        descriptionHash;
        PurchaseStatus status;
        bytes32        impactProofHash;
        uint256        deliveryDeadline;
        uint256        confirmDeadline;
        uint256        disputeDeadline;
        uint256        disputeSnapshotBlock;
        uint256        supplierVoteWeight;
        uint256        institutionVoteWeight;
    }

    address public immutable governance;
    IInstitutionRegistry public immutable registry;
    Treasury public immutable treasury;
    uint256 public immutable disputeQuorum;
    uint256 public immutable disputeWindow;
    uint256 public immutable confirmationWindow;

    SupplierRegistry.Registry private _supplierRegistry;

    uint256 private _nextPurchaseId;
    mapping(uint256 => Purchase) private _purchases;

    mapping(uint256 => bytes32[])                private _disputeEvidences;
    mapping(uint256 => mapping(address => bool)) private _hasVotedOnDispute;

    error PurchaseManager__OnlyGovernance();
    error PurchaseManager__ZeroAddress();
    error PurchaseManager__ZeroAmount();
    error PurchaseManager__InvalidDeadline();
    error PurchaseManager__InstitutionNotActive(address institution);
    error PurchaseManager__OnlyInstitution(uint256 purchaseId, address expected);
    error PurchaseManager__OnlySupplier(uint256 purchaseId, address expected);
    error PurchaseManager__OnlyParty(uint256 purchaseId);
    error PurchaseManager__InvalidStatus(uint256 purchaseId, PurchaseStatus current, PurchaseStatus expected);
    error PurchaseManager__DeadlineNotExpired(uint256 purchaseId);
    error PurchaseManager__DisputeWindowClosed(uint256 purchaseId);
    error PurchaseManager__EmptyProofHash();
    error PurchaseManager__ProofAlreadySubmitted(uint256 purchaseId);
    error PurchaseManager__NotFinalizable(uint256 purchaseId);
    error PurchaseManager__AlreadyVoted(uint256 purchaseId, address voter);
    error PurchaseManager__NoVotingPower(address voter);
    error PurchaseManager__PurchaseNotFound(uint256 purchaseId);

    event PurchaseOpened(
        uint256 indexed purchaseId,
        address indexed institution,
        address indexed supplier,
        uint256 amount,
        uint256 deliveryDeadline,
        bytes32 descriptionHash
    );
    event DeliveryConfirmed(uint256 indexed purchaseId, uint256 confirmDeadline);
    event ReceiptConfirmed(uint256 indexed purchaseId);
    event ImpactProofSubmitted(uint256 indexed purchaseId, bytes32 ipfsHash);
    event ImmutableReceipt(
        uint256 indexed purchaseId,
        address indexed institution,
        address indexed supplier,
        uint256 amount,
        bytes32 impactProofHash
    );
    event PaymentReleased(uint256 indexed purchaseId, address indexed supplier, uint256 amount);
    event DisputeOpened(uint256 indexed purchaseId, uint256 deadline);
    event DisputeEvidenceAdded(uint256 indexed purchaseId, bytes32 ipfsHash, address submittedBy);
    event DisputeVoteCast(uint256 indexed purchaseId, address indexed voter, bool supportSupplier, uint256 weight);
    event DisputeResolved(uint256 indexed purchaseId, bool supplierWon, uint256 amount);

    modifier onlyGovernance() {
        if (msg.sender != governance) revert PurchaseManager__OnlyGovernance();
        _;
    }

    constructor(
        address _governance,
        address _registry,
        address _treasury,
        uint256 _disputeQuorum,
        uint256 _disputeWindow,
        uint256 _confirmationWindow
    ) {
        if (_governance == address(0) || _registry == address(0) || _treasury == address(0))
            revert PurchaseManager__ZeroAddress();

        governance          = _governance;
        registry            = IInstitutionRegistry(_registry);
        treasury            = Treasury(_treasury);
        disputeQuorum       = _disputeQuorum;
        disputeWindow       = _disputeWindow;
        confirmationWindow  = _confirmationWindow;
    }

    // -------------------------------------------------------------------------
    // Gestão de fornecedores — apenas GovernanceDAO
    // -------------------------------------------------------------------------

    function approveSupplier(
        address supplier,
        string calldata name,
        string calldata serviceType
    ) external onlyGovernance {
        _supplierRegistry.approve(supplier, name, serviceType);
    }

    function revokeSupplier(address supplier) external onlyGovernance {
        _supplierRegistry.revoke(supplier);
    }

    function approvedSuppliers(address supplier) external view returns (bool) {
        return _supplierRegistry.isWhitelisted[supplier];
    }

    // -------------------------------------------------------------------------
    // Fluxo principal
    // -------------------------------------------------------------------------

    /// @notice Instituição solicita produto/serviço a um fornecedor on-chain.
    ///         Valida: instituição ativa, fornecedor aprovado, valor > 0, prazo futuro.
    ///         Bloqueia o valor no Treasury.
    function openPurchase(
        address supplier,
        uint256 amount,
        uint256 deliveryDeadline,
        bytes32 descriptionHash
    ) external returns (uint256 purchaseId) {
        if (!registry.isActive(msg.sender))
            revert PurchaseManager__InstitutionNotActive(msg.sender);
        if (amount == 0)
            revert PurchaseManager__ZeroAmount();
        // slither-disable-next-line timestamp
        if (deliveryDeadline <= block.timestamp)
            revert PurchaseManager__InvalidDeadline();

        _supplierRegistry.requireWhitelisted(supplier);

        purchaseId = ++_nextPurchaseId;
        _purchases[purchaseId] = Purchase({
            purchaseId:           purchaseId,
            institution:          msg.sender,
            supplier:             supplier,
            amount:               amount,
            descriptionHash:      descriptionHash,
            status:               PurchaseStatus.Open,
            impactProofHash:      bytes32(0),
            deliveryDeadline:     deliveryDeadline,
            confirmDeadline:      0,
            disputeDeadline:      0,
            disputeSnapshotBlock: 0,
            supplierVoteWeight:   0,
            institutionVoteWeight: 0
        });

        emit PurchaseOpened(purchaseId, msg.sender, supplier, amount, deliveryDeadline, descriptionHash);

        // CEI: estado atualizado antes da chamada externa
        treasury.reserve(msg.sender, purchaseId, amount);
    }

    /// @notice Fornecedor confirma a entrega on-chain.
    ///         Inicia o prazo de confirmação da instituição (CONFIRMATION_WINDOW).
    function confirmDelivery(uint256 purchaseId) external {
        Purchase storage p = _getPurchase(purchaseId);

        if (msg.sender != p.supplier)
            revert PurchaseManager__OnlySupplier(purchaseId, p.supplier);
        if (p.status != PurchaseStatus.Open)
            revert PurchaseManager__InvalidStatus(purchaseId, p.status, PurchaseStatus.Open);

        p.status         = PurchaseStatus.Delivered;
        p.confirmDeadline = block.timestamp + confirmationWindow;

        emit DeliveryConfirmed(purchaseId, p.confirmDeadline);
    }

    /// @notice Instituição confirma o recebimento on-chain.
    function confirmReceipt(uint256 purchaseId) external {
        Purchase storage p = _getPurchase(purchaseId);

        if (msg.sender != p.institution)
            revert PurchaseManager__OnlyInstitution(purchaseId, p.institution);
        if (p.status != PurchaseStatus.Delivered)
            revert PurchaseManager__InvalidStatus(purchaseId, p.status, PurchaseStatus.Delivered);

        p.status = PurchaseStatus.Confirmed;
        emit ReceiptConfirmed(purchaseId);
    }

    /// @notice Instituição submete Proof of Impact (hash IPFS) e aciona
    ///         pagamento automático ao fornecedor com emissão do recibo imutável.
    function submitImpactProof(uint256 purchaseId, bytes32 ipfsHash) external {
        Purchase storage p = _getPurchase(purchaseId);

        if (msg.sender != p.institution)
            revert PurchaseManager__OnlyInstitution(purchaseId, p.institution);
        if (p.status != PurchaseStatus.Confirmed)
            revert PurchaseManager__InvalidStatus(purchaseId, p.status, PurchaseStatus.Confirmed);
        if (ipfsHash == bytes32(0))
            revert PurchaseManager__EmptyProofHash();
        if (p.impactProofHash != bytes32(0))
            revert PurchaseManager__ProofAlreadySubmitted(purchaseId);

        address supplier = p.supplier;
        uint256 amount   = p.amount;

        // CEI: estado antes das interações
        p.impactProofHash = ipfsHash;
        p.status          = PurchaseStatus.Paid;

        emit ImpactProofSubmitted(purchaseId, ipfsHash);
        emit ImmutableReceipt(purchaseId, p.institution, supplier, amount, ipfsHash);
        emit PaymentReleased(purchaseId, supplier, amount);

        treasury.release(p.institution, supplier, purchaseId, amount);
    }

    /// @notice Instituição confirma recebimento e submete Proof of Impact em uma única transação.
    ///         Vai diretamente de Delivered para Paid, sem estado intermediário Confirmed.
    function confirmReceiptAndSubmitProof(uint256 purchaseId, bytes32 ipfsHash) external {
        Purchase storage p = _getPurchase(purchaseId);

        if (msg.sender != p.institution)
            revert PurchaseManager__OnlyInstitution(purchaseId, p.institution);
        if (p.status != PurchaseStatus.Delivered)
            revert PurchaseManager__InvalidStatus(purchaseId, p.status, PurchaseStatus.Delivered);
        if (ipfsHash == bytes32(0))
            revert PurchaseManager__EmptyProofHash();

        address supplier = p.supplier;
        uint256 amount   = p.amount;

        // CEI: estado antes das interações
        p.impactProofHash = ipfsHash;
        p.status          = PurchaseStatus.Paid;

        emit ReceiptConfirmed(purchaseId);
        emit ImpactProofSubmitted(purchaseId, ipfsHash);
        emit ImmutableReceipt(purchaseId, p.institution, supplier, amount, ipfsHash);
        emit PaymentReleased(purchaseId, supplier, amount);

        treasury.release(p.institution, supplier, purchaseId, amount);
    }

    // -------------------------------------------------------------------------
    // Disputas automáticas
    // -------------------------------------------------------------------------

    /// @notice Abre disputa após prazo expirado.
    ///         Open + deliveryDeadline expirado → apenas a instituição (fornecedor não entregou).
    ///         Delivered + confirmDeadline expirado → apenas o fornecedor (instituição não confirmou).
    function openDispute(uint256 purchaseId) external {
        Purchase storage p = _getPurchase(purchaseId);

        if (p.status == PurchaseStatus.Open) {
            // slither-disable-next-line timestamp
            if (block.timestamp <= p.deliveryDeadline)
                revert PurchaseManager__DeadlineNotExpired(purchaseId);
            if (msg.sender != p.institution)
                revert PurchaseManager__OnlyInstitution(purchaseId, p.institution);
        } else if (p.status == PurchaseStatus.Delivered) {
            // slither-disable-next-line timestamp
            if (block.timestamp <= p.confirmDeadline)
                revert PurchaseManager__DeadlineNotExpired(purchaseId);
            if (msg.sender != p.supplier)
                revert PurchaseManager__OnlySupplier(purchaseId, p.supplier);
        } else {
            revert PurchaseManager__InvalidStatus(purchaseId, p.status, PurchaseStatus.Open);
        }

        p.status               = PurchaseStatus.Disputed;
        p.disputeDeadline      = block.timestamp + disputeWindow;
        p.disputeSnapshotBlock = block.number;

        emit DisputeOpened(purchaseId, p.disputeDeadline);
    }

    /// @notice Instituição ou Fornecedor adicionam evidências durante a disputa.
    function addDisputeEvidence(uint256 purchaseId, bytes32 ipfsHash) external {
        Purchase storage p = _getPurchase(purchaseId);

        if (p.status != PurchaseStatus.Disputed)
            revert PurchaseManager__InvalidStatus(purchaseId, p.status, PurchaseStatus.Disputed);
        if (ipfsHash == bytes32(0))
            revert PurchaseManager__EmptyProofHash();
        // slither-disable-next-line timestamp
        if (block.timestamp > p.disputeDeadline)
            revert PurchaseManager__DisputeWindowClosed(purchaseId);
        if (msg.sender != p.institution && msg.sender != p.supplier)
            revert PurchaseManager__OnlyParty(purchaseId);

        _disputeEvidences[purchaseId].push(ipfsHash);
        emit DisputeEvidenceAdded(purchaseId, ipfsHash, msg.sender);
    }

    /// @notice Doador vota na resolução de uma disputa ativa.
    ///         Peso calculado a partir do snapshot do bloco em que a disputa foi aberta.
    function voteOnDispute(uint256 purchaseId, bool supportSupplier) external {
        Purchase storage p = _getPurchase(purchaseId);

        if (p.status != PurchaseStatus.Disputed)
            revert PurchaseManager__InvalidStatus(purchaseId, p.status, PurchaseStatus.Disputed);
        // slither-disable-next-line timestamp
        if (block.timestamp > p.disputeDeadline)
            revert PurchaseManager__DisputeWindowClosed(purchaseId);
        if (_hasVotedOnDispute[purchaseId][msg.sender])
            revert PurchaseManager__AlreadyVoted(purchaseId, msg.sender);

        uint256 weight = treasury.votingWeightAtBlock(msg.sender, p.disputeSnapshotBlock);
        if (weight == 0) revert PurchaseManager__NoVotingPower(msg.sender);

        _hasVotedOnDispute[purchaseId][msg.sender] = true;

        if (supportSupplier) {
            p.supplierVoteWeight += weight;
        } else {
            p.institutionVoteWeight += weight;
        }

        emit DisputeVoteCast(purchaseId, msg.sender, supportSupplier, weight);
    }

    /// @notice Finaliza a disputa após o DISPUTE_WINDOW ou quando o quórum é atingido.
    ///         Se quórum atingido: vencedor é o lado com mais peso.
    ///         Se quórum não atingido após prazo: instituição vence por padrão (protege fundos).
    function finalizeDispute(uint256 purchaseId) external {
        Purchase storage p = _getPurchase(purchaseId);

        if (p.status != PurchaseStatus.Disputed)
            revert PurchaseManager__InvalidStatus(purchaseId, p.status, PurchaseStatus.Disputed);

        uint256 totalVotes = p.supplierVoteWeight + p.institutionVoteWeight;
        bool quorumReached = totalVotes >= disputeQuorum;
        // slither-disable-next-line timestamp
        bool windowClosed  = block.timestamp > p.disputeDeadline;

        if (!quorumReached && !windowClosed)
            revert PurchaseManager__NotFinalizable(purchaseId);

        bool supplierWon = quorumReached && p.supplierVoteWeight > p.institutionVoteWeight;

        address institution = p.institution;
        address supplier    = p.supplier;
        uint256 amount      = p.amount;

        // CEI: estado antes das interações
        p.status = supplierWon ? PurchaseStatus.Paid : PurchaseStatus.Refunded;

        emit DisputeResolved(purchaseId, supplierWon, amount);

        if (supplierWon) {
            emit ImmutableReceipt(purchaseId, institution, supplier, amount, p.impactProofHash);
            treasury.release(institution, supplier, purchaseId, amount);
        } else {
            treasury.returnFunds(institution, purchaseId, amount);
        }
    }

    // -------------------------------------------------------------------------
    // Leitura
    // -------------------------------------------------------------------------

    function getPurchase(uint256 purchaseId) external view returns (Purchase memory) {
        return _getPurchase(purchaseId);
    }

    function getDisputeEvidences(uint256 purchaseId) external view returns (bytes32[] memory) {
        return _disputeEvidences[purchaseId];
    }

    function hasVotedOnDispute(uint256 purchaseId, address voter) external view returns (bool) {
        return _hasVotedOnDispute[purchaseId][voter];
    }

    // -------------------------------------------------------------------------
    // Interno
    // -------------------------------------------------------------------------

    function _getPurchase(uint256 purchaseId) private view returns (Purchase storage) {
        Purchase storage p = _purchases[purchaseId];
        if (p.purchaseId == 0) revert PurchaseManager__PurchaseNotFound(purchaseId);
        return p;
    }
}
