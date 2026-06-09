// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IInstitutionRegistry } from "./InstitutionRegistry.sol";
import { QuadraticMath }        from "./lib/QuadraticMath.sol";
import { VotingCheckpoint }     from "./lib/VotingCheckpoint.sol";

/// @title Treasury
/// @notice Custodia todos os saldos da plataforma.
///         Não toma decisões de negócio — apenas movimenta valores sob comando
///         de PurchaseManager ou GovernanceDAO.
///
///         [Segurança — Flash Loan]
///         Peso de voto rastreado por checkpoints (blockNumber, weight).
///         Busca binária retorna o peso válido em qualquer bloco histórico,
///         tornando inútil qualquer tentativa de inflar totalDonated após a
///         abertura de uma proposta ou disputa.
contract Treasury {

    using QuadraticMath    for uint256;
    using VotingCheckpoint for VotingCheckpoint.Checkpoint[];

    address public immutable governance;
    address public immutable purchaseManager;
    IInstitutionRegistry public immutable registry;

    /// @dev Saldo disponível por instituição
    mapping(address => uint256) public availableBalance;
    /// @dev Saldo reservado em solicitações abertas — indisponível para outros gastos
    mapping(address => uint256) public reservedBalance;
    /// @dev Cofre Central — acumula saldo de instituições removidas
    uint256 public centralVault;

    /// @dev Total doado por doador (acumulado)
    mapping(address => uint256) public totalDonated;
    /// @dev Histórico de checkpoints de peso de voto por doador
    mapping(address => VotingCheckpoint.Checkpoint[]) private _weightHistory;

    error Treasury__OnlyGovernance();
    error Treasury__OnlyPurchaseManager();
    error Treasury__ZeroAddress();
    error Treasury__ZeroAmount();
    error Treasury__InstitutionNotActive(address institution);
    error Treasury__InsufficientBalance(address institution, uint256 available, uint256 requested);
    error Treasury__InsufficientReserved(address institution, uint256 reserved, uint256 requested);
    error Treasury__TransferFailed();

    event DonationReceived(address indexed donor, address indexed institution, uint256 amount);
    event BalanceReserved(address indexed institution, uint256 indexed purchaseId, uint256 amount);
    event PaymentReleased(address indexed supplier, uint256 indexed purchaseId, uint256 amount);
    event FundsReturned(address indexed institution, uint256 indexed purchaseId, uint256 amount);
    event FundsSeized(address indexed institution, uint256 amount);
    event VotingWeightUpdated(address indexed donor, uint256 donated, uint256 weight);

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Treasury__OnlyGovernance();
        _;
    }

    modifier onlyPurchaseManager() {
        if (msg.sender != purchaseManager) revert Treasury__OnlyPurchaseManager();
        _;
    }

    constructor(address _governance, address _purchaseManager, address _registry) {
        if (_governance == address(0) || _purchaseManager == address(0) || _registry == address(0))
            revert Treasury__ZeroAddress();

        governance      = _governance;
        purchaseManager = _purchaseManager;
        registry        = IInstitutionRegistry(_registry);
    }

    // -------------------------------------------------------------------------
    // Doações — público
    // -------------------------------------------------------------------------

    /// @notice Recebe doação em ETH e vincula ao saldo da instituição.
    ///         Rejeita instituição pausada ou removida.
    ///         Grava checkpoint de peso de voto no bloco atual.
    function donate(address institution) external payable {
        if (msg.value == 0) revert Treasury__ZeroAmount();
        if (institution == address(0)) revert Treasury__ZeroAddress();
        if (!registry.isActive(institution)) revert Treasury__InstitutionNotActive(institution);

        availableBalance[institution] += msg.value;

        uint256 donated = totalDonated[msg.sender] + msg.value;
        totalDonated[msg.sender] = donated;
        uint256 weight = donated.sqrt();
        _weightHistory[msg.sender].push(weight);

        emit DonationReceived(msg.sender, institution, msg.value);
        emit VotingWeightUpdated(msg.sender, donated, weight);
    }

    // -------------------------------------------------------------------------
    // Operações de saldo — apenas PurchaseManager
    // -------------------------------------------------------------------------

    // Reserva valor do saldo disponível de uma instituição para um pedido de compra.
    function reserve(address institution, uint256 purchaseId, uint256 amount)
        external onlyPurchaseManager
    {
        if (amount == 0) revert Treasury__ZeroAmount();
        if (availableBalance[institution] < amount)
            revert Treasury__InsufficientBalance(institution, availableBalance[institution], amount);

        availableBalance[institution] -= amount;
        reservedBalance[institution]  += amount;
        emit BalanceReserved(institution, purchaseId, amount);
    }

    // Libera valor reservado e transfere ETH ao fornecedor.
    function release(address institution, address supplier, uint256 purchaseId, uint256 amount)
        external onlyPurchaseManager
    {
        if (amount == 0) revert Treasury__ZeroAmount();
        if (supplier == address(0)) revert Treasury__ZeroAddress();
        if (reservedBalance[institution] < amount)
            revert Treasury__InsufficientReserved(institution, reservedBalance[institution], amount);

        // CEI: atualiza estado antes da transferência
        reservedBalance[institution] -= amount;
        emit PaymentReleased(supplier, purchaseId, amount);

        (bool ok,) = supplier.call{ value: amount }("");
        if (!ok) revert Treasury__TransferFailed();
    }

    // Devolve valor reservado ao saldo disponível da instituição (disputa favorável).
    function returnFunds(address institution, uint256 purchaseId, uint256 amount)
        external onlyPurchaseManager
    {
        if (amount == 0) revert Treasury__ZeroAmount();
        if (reservedBalance[institution] < amount)
            revert Treasury__InsufficientReserved(institution, reservedBalance[institution], amount);

        reservedBalance[institution]  -= amount;
        availableBalance[institution] += amount;
        emit FundsReturned(institution, purchaseId, amount);
    }

    // -------------------------------------------------------------------------
    // Remoção de instituição — apenas GovernanceDAO
    // -------------------------------------------------------------------------

    // Confisca todo saldo disponível e reservado de uma instituição removida para o cofre central.
    function seizeToVault(address institution) external onlyGovernance {
        uint256 total = availableBalance[institution] + reservedBalance[institution];
        availableBalance[institution] = 0;
        reservedBalance[institution]  = 0;
        centralVault += total;
        emit FundsSeized(institution, total);
    }

    // -------------------------------------------------------------------------
    // Leitura de peso de voto
    // -------------------------------------------------------------------------

    /// @notice Retorna o peso de voto do doador válido em um bloco histórico.
    ///         Usado por GovernanceDAO e PurchaseManager para garantir snapshot.
    function votingWeightAtBlock(address donor, uint256 blockNumber)
        external view returns (uint256)
    {
        return _weightHistory[donor].weightAt(blockNumber);
    }

    // Retorna o peso de voto atual do doador (último checkpoint registrado).
    function currentVotingWeight(address donor) external view returns (uint256) {
        VotingCheckpoint.Checkpoint[] storage ckpts = _weightHistory[donor];
        uint256 len = ckpts.length;
        return len == 0 ? 0 : ckpts[len - 1].weight;
    }
}
