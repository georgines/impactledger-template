// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { QuadraticMath }       from "../contracts/lib/QuadraticMath.sol";
import { SupplierRegistry }    from "../contracts/lib/SupplierRegistry.sol";
import { InstitutionRegistry } from "../contracts/InstitutionRegistry.sol";
import { Treasury }            from "../contracts/Treasury.sol";
import { PurchaseManager }     from "../contracts/PurchaseManager.sol";
import { GovernanceDAO }       from "../contracts/GovernanceDAO.sol";

/// @title E2EFlowTest
/// @notice Testes de integração end-to-end cobrindo todos os fluxos da plataforma EloSolidário:
///         G — Governança, C — Compra, D — Disputa, F — Doação, S — Segurança, M — Mapa do Bem
///
/// Setup base:
///   - operator    = dono da plataforma
///   - doador1     = doador com 100 ETH
///   - doador2     = doador com 100 ETH
///   - instituicao1 = primeira instituição (bootstrapped)
///   - instituicao2 = segunda instituição (aprovada via votação)
///   - fornecedor   = fornecedor aprovado via votação
///
/// Configuração: MIN_QUORUM=0, VOTING_PERIOD=7 days, DISPUTE_WINDOW=7 days, CONFIRM_WINDOW=7 days

contract E2EFlowTest is Test {
    using QuadraticMath for uint256;

    // =========================================================================
    // Atores
    // =========================================================================

    address operator    = makeAddr("operator");
    address doador1     = makeAddr("doador1");
    address doador2     = makeAddr("doador2");
    address instituicao1 = makeAddr("instituicao1");
    address instituicao2 = makeAddr("instituicao2");
    address fornecedor  = makeAddr("fornecedor");

    // =========================================================================
    // Contratos
    // =========================================================================

    GovernanceDAO       governance;
    InstitutionRegistry registry;
    Treasury            treasury;
    PurchaseManager     purchaseManager;

    // =========================================================================
    // Constantes
    // =========================================================================

    uint256 constant VOTING_PERIOD   = 7 days;
    uint256 constant DISPUTE_WINDOW  = 7 days;
    uint256 constant CONFIRM_WINDOW  = 7 days;
    uint256 constant MIN_QUORUM      = 0;
    uint256 constant PRAZO_ENTREGA   = 14 days;

    // =========================================================================
    // Setup
    // =========================================================================

    function setUp() public {
        uint256 nonce = vm.getNonce(address(this));

        address govAddr = vm.computeCreateAddress(address(this), nonce);
        address regAddr = vm.computeCreateAddress(address(this), nonce + 1);
        address trsAddr = vm.computeCreateAddress(address(this), nonce + 2);
        address pmAddr  = vm.computeCreateAddress(address(this), nonce + 3);

        governance      = new GovernanceDAO(operator, regAddr, pmAddr, trsAddr, MIN_QUORUM, VOTING_PERIOD);
        registry        = new InstitutionRegistry(govAddr);
        treasury        = new Treasury(govAddr, pmAddr, regAddr);
        purchaseManager = new PurchaseManager(govAddr, regAddr, trsAddr, MIN_QUORUM, DISPUTE_WINDOW, CONFIRM_WINDOW);

        vm.deal(doador1, 100 ether);
        vm.deal(doador2, 100 ether);
    }

    // =========================================================================
    // Helpers internos
    // =========================================================================

    /// @dev Executa o bootstrap da plataforma: registra instituicao1 e doa para dar poder de voto ao doador1.
    function _bootstrapPlataforma() internal {
        vm.prank(operator);
        governance.bootstrapRegister(instituicao1, "ONG Alimentos", "alimentos");

        vm.roll(block.number + 1);
        vm.prank(doador1);
        treasury.donate{ value: 10 ether }(instituicao1);
    }

    /// @dev Aprova instituicao2 via votação completa.
    function _aprovarInstituicao2() internal {
        _bootstrapPlataforma();

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.ApproveInstitution,
            instituicao2,
            "ONG Educacao",
            "educacao"
        );

        vm.prank(doador1);
        governance.vote(propId, true);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        governance.finalize(propId, "ONG Educacao", "educacao");
    }

    /// @dev Aprova fornecedor via votação completa. Requer bootstrap prévio e poder de voto.
    function _aprovarFornecedor() internal {
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.ApproveSupplier,
            fornecedor,
            "Fornecedor Logistica",
            "logistica"
        );

        vm.prank(doador1);
        governance.vote(propId, true);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        governance.finalize(propId, "Fornecedor Logistica", "logistica");
    }

    /// @dev Executa fluxo completo de compra até o pagamento ao fornecedor.
    function _fluxoCompletoDeCompra(address inst, uint256 valor) internal returns (uint256 pedidoId) {
        vm.prank(inst);
        pedidoId = purchaseManager.openPurchase(
            fornecedor,
            valor,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("descricao da compra")
        );

        vm.prank(fornecedor);
        purchaseManager.confirmDelivery(pedidoId);

        vm.prank(inst);
        purchaseManager.confirmReceipt(pedidoId);

        vm.prank(inst);
        purchaseManager.submitImpactProof(pedidoId, keccak256("foto_evidencia.jpg"));
    }

    /// @dev Abre disputa após expirar o prazo de entrega.
    ///      Apenas a instituição pode acionar — usa p.institution do struct.
    function _abrirDisputaPorPrazoEntrega(uint256 pedidoId) internal {
        PurchaseManager.Purchase memory p = purchaseManager.getPurchase(pedidoId);
        vm.warp(p.deliveryDeadline + 1);
        vm.prank(p.institution);
        purchaseManager.openDispute(pedidoId);
    }

    /// @dev Abre disputa após expirar o prazo de confirmação (fornecedor já entregou).
    ///      Apenas o fornecedor pode acionar — usa p.supplier do struct.
    function _abrirDisputaPorPrazoConfirmacao(uint256 pedidoId) internal {
        PurchaseManager.Purchase memory p = purchaseManager.getPurchase(pedidoId);
        vm.warp(p.confirmDeadline + 1);
        vm.prank(p.supplier);
        purchaseManager.openDispute(pedidoId);
    }

    // =========================================================================
    // G — Governança
    // =========================================================================

    // -------------------------------------------------------------------------
    // G1 — Caminho feliz: bootstrap → doação → proposta ApproveInstitution → voto → finalize → inst ativa
    // -------------------------------------------------------------------------

    function test_G1_CaminhoFeliz_BootstrapDoacaoPropostaVotoFinalize_InstituicaoAtiva() public {
        // bootstrap registra primeira instituição sem votação
        vm.prank(operator);
        governance.bootstrapRegister(instituicao1, "ONG Alimentos", "alimentos");

        assertEq(
            uint256(registry.statusOf(instituicao1)),
            uint256(InstitutionRegistry.Status.Active)
        );
        assertTrue(governance.bootstrapped());

        // doador1 doa para adquirir poder de voto
        vm.roll(block.number + 1);
        vm.prank(doador1);
        treasury.donate{ value: 5 ether }(instituicao1);

        // operador propõe aprovação de segunda instituição
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.ApproveInstitution,
            instituicao2,
            "ONG Educacao",
            "educacao"
        );

        // doador1 vota a favor
        vm.prank(doador1);
        governance.vote(propId, true);

        // prazo expira
        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        // qualquer endereço finaliza — execução automática
        governance.finalize(propId, "ONG Educacao", "educacao");

        // verificação: instituicao2 está ativa
        assertEq(
            uint256(registry.statusOf(instituicao2)),
            uint256(InstitutionRegistry.Status.Active)
        );
        assertEq(
            uint256(governance.getProposal(propId).status),
            uint256(GovernanceDAO.ProposalStatus.Executed)
        );
    }

    // -------------------------------------------------------------------------
    // G2 — Caminho feliz: inst2 ativa → proposta de pausa → voto → finalize → inst2 pausada
    // -------------------------------------------------------------------------

    function test_G2_CaminhoFeliz_PropostaDepausa_InstituicaoPausada() public {
        _aprovarInstituicao2();

        assertEq(
            uint256(registry.statusOf(instituicao2)),
            uint256(InstitutionRegistry.Status.Active)
        );

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            instituicao2,
            "",
            ""
        );

        vm.prank(doador1);
        governance.vote(propId, true);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        governance.finalize(propId, "", "");

        assertEq(
            uint256(registry.statusOf(instituicao2)),
            uint256(InstitutionRegistry.Status.Paused)
        );
        assertEq(
            uint256(governance.getProposal(propId).status),
            uint256(GovernanceDAO.ProposalStatus.Executed)
        );
    }

    // -------------------------------------------------------------------------
    // G3 — Caminho feliz: inst2 pausada → proposta de despausa → voto → finalize → inst2 ativa
    // -------------------------------------------------------------------------

    function test_G3_CaminhoFeliz_PropostaDespausa_InstituicaoAtiva() public {
        _aprovarInstituicao2();

        // pausa inst2
        vm.prank(operator);
        uint256 propPausa = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            instituicao2,
            "",
            ""
        );
        vm.prank(doador1);
        governance.vote(propPausa, true);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        governance.finalize(propPausa, "", "");

        assertEq(
            uint256(registry.statusOf(instituicao2)),
            uint256(InstitutionRegistry.Status.Paused)
        );

        // despausa inst2
        vm.prank(operator);
        uint256 propDespausa = governance.propose(
            GovernanceDAO.ProposalType.UnpauseInstitution,
            instituicao2,
            "",
            ""
        );
        vm.prank(doador1);
        governance.vote(propDespausa, true);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        governance.finalize(propDespausa, "", "");

        assertEq(
            uint256(registry.statusOf(instituicao2)),
            uint256(InstitutionRegistry.Status.Active)
        );
        assertEq(
            uint256(governance.getProposal(propDespausa).status),
            uint256(GovernanceDAO.ProposalStatus.Executed)
        );
    }

    // -------------------------------------------------------------------------
    // G4 — Caminho feliz: inst2 ativa com saldo → proposta de remoção → finalize → inst2 removida, saldo no cofre
    // -------------------------------------------------------------------------

    function test_G4_CaminhoFeliz_PropostaRemocao_InstituicaoRemovidaSaldoNoCofreCentral() public {
        _aprovarInstituicao2();

        // doador2 doa para inst2 — saldo que deve ir ao cofre central
        vm.prank(doador2);
        treasury.donate{ value: 8 ether }(instituicao2);

        uint256 saldoInst2 = treasury.availableBalance(instituicao2);
        assertEq(saldoInst2, 8 ether);

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.RemoveInstitution,
            instituicao2,
            "",
            ""
        );

        vm.prank(doador1);
        governance.vote(propId, true);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        governance.finalize(propId, "", "");

        assertEq(
            uint256(registry.statusOf(instituicao2)),
            uint256(InstitutionRegistry.Status.Removed)
        );
        assertEq(treasury.availableBalance(instituicao2), 0);
        assertEq(treasury.centralVault(), 8 ether);
    }

    // -------------------------------------------------------------------------
    // G5 — Caminho feliz: proposta ApproveSupplier → voto → finalize → fornecedor na whitelist
    // -------------------------------------------------------------------------

    function test_G5_CaminhoFeliz_PropostaApproveSupplier_FornecedorNaWhitelist() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        assertTrue(purchaseManager.approvedSuppliers(fornecedor));
    }

    // -------------------------------------------------------------------------
    // G6 — Caminho feliz: proposta sem votos → prazo expira → finalize → Rejected
    // -------------------------------------------------------------------------

    function test_G6_CaminhoFeliz_PropostaSemVotos_PropostaRejeitada() public {
        _bootstrapPlataforma();

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            instituicao1,
            "",
            ""
        );

        // ninguém vota — prazo expira
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        governance.finalize(propId, "", "");

        assertEq(
            uint256(governance.getProposal(propId).status),
            uint256(GovernanceDAO.ProposalStatus.Rejected)
        );
    }

    // -------------------------------------------------------------------------
    // G_Triste — Endereço não autorizado tenta criar proposta
    // -------------------------------------------------------------------------

    function test_G_Triste_OperadorNaoAutorizado_RevertGovernanceDAO__OnlyOperator() public {
        address qualquerEndereco = makeAddr("qualquerEndereco");

        vm.prank(qualquerEndereco);
        vm.expectRevert(GovernanceDAO.GovernanceDAO__OnlyOperator.selector);
        governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            instituicao1,
            "",
            ""
        );
    }

    // -------------------------------------------------------------------------
    // G_Triste — Operador propõe com address(0) → revert ZeroAddress
    // -------------------------------------------------------------------------

    function test_G_Triste_EnderecoZeroNaProposta_RevertGovernanceDAO__ZeroAddress() public {
        vm.prank(operator);
        vm.expectRevert(GovernanceDAO.GovernanceDAO__ZeroAddress.selector);
        governance.propose(
            GovernanceDAO.ProposalType.ApproveInstitution,
            address(0),
            "Nome",
            "area"
        );
    }

    // -------------------------------------------------------------------------
    // G_Triste — Doador tenta votar duas vezes → revert AlreadyVoted
    // -------------------------------------------------------------------------

    function test_G_Triste_DuploVoto_RevertGovernanceDAO__AlreadyVoted() public {
        _bootstrapPlataforma();

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            instituicao1,
            "",
            ""
        );

        vm.prank(doador1);
        governance.vote(propId, true);

        vm.prank(doador1);
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__AlreadyVoted.selector, propId, doador1));
        governance.vote(propId, true);
    }

    // -------------------------------------------------------------------------
    // G_Triste — Doador sem doações tenta votar → revert NoVotingPower
    // -------------------------------------------------------------------------

    function test_G_Triste_SemPoderDeVoto_RevertGovernanceDAO__NoVotingPower() public {
        _bootstrapPlataforma();

        address semDoacao = makeAddr("semDoacao");

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            instituicao1,
            "",
            ""
        );

        vm.prank(semDoacao);
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__NoVotingPower.selector, semDoacao));
        governance.vote(propId, true);
    }

    // -------------------------------------------------------------------------
    // G_Triste — Vota após prazo da proposta → revert VotingEnded
    // -------------------------------------------------------------------------

    function test_G_Triste_VotoAposDeadline_RevertGovernanceDAO__VotingEnded() public {
        _bootstrapPlataforma();

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            instituicao1,
            "",
            ""
        );

        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        vm.prank(doador1);
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__VotingEnded.selector, propId));
        governance.vote(propId, true);
    }

    // -------------------------------------------------------------------------
    // G_Triste — Tenta finalizar antes do prazo → revert NotFinalizable
    // -------------------------------------------------------------------------

    function test_G_Triste_FinalizarAntesDoDeadline_RevertGovernanceDAO__NotFinalizable() public {
        _bootstrapPlataforma();

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            instituicao1,
            "",
            ""
        );

        vm.prank(doador1);
        governance.vote(propId, true);

        // tenta finalizar antes do prazo expirar
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__NotFinalizable.selector, propId));
        governance.finalize(propId, "", "");
    }

    // -------------------------------------------------------------------------
    // G_Triste — Bootstrap duplo → revert AlreadyBootstrapped
    // -------------------------------------------------------------------------

    function test_G_Triste_BootstrapDuplo_RevertGovernanceDAO__AlreadyBootstrapped() public {
        vm.prank(operator);
        governance.bootstrapRegister(instituicao1, "ONG Bootstrap", "saude");

        address outraInstituicao = makeAddr("outraInstituicao");
        vm.prank(operator);
        vm.expectRevert(GovernanceDAO.GovernanceDAO__AlreadyBootstrapped.selector);
        governance.bootstrapRegister(outraInstituicao, "ONG 2", "educacao");
    }

    // -------------------------------------------------------------------------
    // G_Triste — finalize com nome diferente do proposto → revert InvalidNameMetadata
    // -------------------------------------------------------------------------

    function test_G_Triste_NomeIncorretoNoFinalize_RevertGovernanceDAO__InvalidNameMetadata() public {
        _bootstrapPlataforma();

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.ApproveInstitution,
            instituicao2,
            "ONG Correta",
            "saude"
        );

        vm.prank(doador1);
        governance.vote(propId, true);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__InvalidNameMetadata.selector, propId));
        governance.finalize(propId, "Nome Errado", "area_errada");
    }

    // =========================================================================
    // C — Compra
    // =========================================================================

    // -------------------------------------------------------------------------
    // C1 — Caminho feliz: compra completa — inst → forn confirma → inst confirma → PoI → ETH ao forn
    // -------------------------------------------------------------------------

    function test_C1_CaminhoFeliz_FluxoCompletoDeCompra_FornecedorRecebePagamento() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        // doador2 doa para inst1 ter saldo
        vm.prank(doador2);
        treasury.donate{ value: 5 ether }(instituicao1);

        uint256 saldoFornecedorAntes = fornecedor.balance;

        // abre pedido
        uint256 prazo = block.timestamp + PRAZO_ENTREGA;
        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            fornecedor,
            2 ether,
            prazo,
            keccak256("reforma do abrigo")
        );

        // saldo reservado
        assertEq(treasury.reservedBalance(instituicao1), 2 ether);
        assertEq(treasury.availableBalance(instituicao1), 13 ether); // 10 + 5 - 2

        // fornecedor confirma entrega
        vm.prank(fornecedor);
        purchaseManager.confirmDelivery(pedidoId);

        assertEq(
            uint256(purchaseManager.getPurchase(pedidoId).status),
            uint256(PurchaseManager.PurchaseStatus.Delivered)
        );

        // instituição confirma recebimento
        vm.prank(instituicao1);
        purchaseManager.confirmReceipt(pedidoId);

        assertEq(
            uint256(purchaseManager.getPurchase(pedidoId).status),
            uint256(PurchaseManager.PurchaseStatus.Confirmed)
        );

        // instituição submete PoI → pagamento liberado
        vm.prank(instituicao1);
        purchaseManager.submitImpactProof(pedidoId, keccak256("foto_geo_evidencia.jpg"));

        // fornecedor recebeu ETH
        assertEq(fornecedor.balance, saldoFornecedorAntes + 2 ether);
        assertEq(treasury.reservedBalance(instituicao1), 0);
        assertEq(
            uint256(purchaseManager.getPurchase(pedidoId).status),
            uint256(PurchaseManager.PurchaseStatus.Paid)
        );
    }

    // -------------------------------------------------------------------------
    // C2 — Triste: fornecedor não aprovado → revert SupplierRegistry__NotWhitelisted
    // -------------------------------------------------------------------------

    function test_C2_Triste_FornecedorNaoAprovado_RevertSupplierRegistry__NotWhitelisted() public {
        _bootstrapPlataforma();

        address fornecedorSemAprovacao = makeAddr("fornecedorSemAprovacao");

        vm.prank(instituicao1);
        vm.expectRevert(abi.encodeWithSelector(
            SupplierRegistry.SupplierRegistry__NotWhitelisted.selector, fornecedorSemAprovacao));
        purchaseManager.openPurchase(
            fornecedorSemAprovacao,
            1 ether,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("compra invalida")
        );
    }

    // -------------------------------------------------------------------------
    // C3 — Triste: saldo insuficiente → revert Treasury__InsufficientBalance
    // -------------------------------------------------------------------------

    function test_C3_Triste_SaldoInsuficiente_RevertTreasury__InsufficientBalance() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        // inst1 tem 10 ether de saldo (da doação no bootstrap)
        // tenta comprar mais do que tem
        vm.prank(instituicao1);
        vm.expectRevert(abi.encodeWithSelector(
            Treasury.Treasury__InsufficientBalance.selector,
            instituicao1,
            10 ether,
            50 ether
        ));
        purchaseManager.openPurchase(
            fornecedor,
            50 ether,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("compra cara demais")
        );
    }

    // -------------------------------------------------------------------------
    // C4 — Triste: PoI vazio → revert PurchaseManager__EmptyProofHash
    // -------------------------------------------------------------------------

    function test_C4_Triste_PoIVazio_RevertPurchaseManager__EmptyProofHash() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            fornecedor,
            1 ether,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("compra de alimentos")
        );

        vm.prank(fornecedor);
        purchaseManager.confirmDelivery(pedidoId);

        vm.prank(instituicao1);
        purchaseManager.confirmReceipt(pedidoId);

        vm.prank(instituicao1);
        vm.expectRevert(PurchaseManager.PurchaseManager__EmptyProofHash.selector);
        purchaseManager.submitImpactProof(pedidoId, bytes32(0));
    }

    // -------------------------------------------------------------------------
    // C5 — Triste: instituição pausada tenta openPurchase → revert InstitutionNotActive
    // -------------------------------------------------------------------------

    function test_C5_Triste_InstituicaoPausada_RevertPurchaseManager__InstitutionNotActive() public {
        _aprovarInstituicao2();
        _aprovarFornecedor();

        // pausa inst2
        vm.prank(operator);
        uint256 propPausa = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            instituicao2,
            "",
            ""
        );
        vm.prank(doador1);
        governance.vote(propPausa, true);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        governance.finalize(propPausa, "", "");

        assertEq(
            uint256(registry.statusOf(instituicao2)),
            uint256(InstitutionRegistry.Status.Paused)
        );

        vm.prank(instituicao2);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__InstitutionNotActive.selector, instituicao2));
        purchaseManager.openPurchase(
            fornecedor,
            1 ether,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("compra bloqueada")
        );
    }

    // -------------------------------------------------------------------------
    // C6 — Triste: outro endereço tenta confirmDelivery → revert OnlySupplier
    // -------------------------------------------------------------------------

    function test_C6_Triste_FornecedorErradoConfirmaEntrega_RevertPurchaseManager__OnlySupplier() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            fornecedor,
            1 ether,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("compra")
        );

        address impostor = makeAddr("impostor");
        vm.prank(impostor);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__OnlySupplier.selector, pedidoId, fornecedor));
        purchaseManager.confirmDelivery(pedidoId);
    }

    // -------------------------------------------------------------------------
    // C7 — Triste: outro endereço tenta confirmReceipt → revert OnlyInstitution
    // -------------------------------------------------------------------------

    function test_C7_Triste_InstituicaoErradaConfirmaRecebimento_RevertPurchaseManager__OnlyInstitution() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            fornecedor,
            1 ether,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("compra")
        );

        vm.prank(fornecedor);
        purchaseManager.confirmDelivery(pedidoId);

        address impostor = makeAddr("impostor");
        vm.prank(impostor);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__OnlyInstitution.selector, pedidoId, instituicao1));
        purchaseManager.confirmReceipt(pedidoId);
    }

    // -------------------------------------------------------------------------
    // C8 — Triste: submeter PoI duas vezes → revert InvalidStatus (status já é Paid)
    // -------------------------------------------------------------------------

    function test_C8_Triste_PoIJaSubmetido_RevertPurchaseManager__InvalidStatus() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            fornecedor,
            1 ether,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("compra")
        );

        vm.prank(fornecedor);
        purchaseManager.confirmDelivery(pedidoId);

        vm.prank(instituicao1);
        purchaseManager.confirmReceipt(pedidoId);

        // primeiro PoI — pagamento executado
        vm.prank(instituicao1);
        purchaseManager.submitImpactProof(pedidoId, keccak256("prova.jpg"));

        // segundo PoI — status agora é Paid, não Confirmed
        vm.prank(instituicao1);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__InvalidStatus.selector,
            pedidoId,
            PurchaseManager.PurchaseStatus.Paid,
            PurchaseManager.PurchaseStatus.Confirmed
        ));
        purchaseManager.submitImpactProof(pedidoId, keccak256("prova2.jpg"));
    }

    // -------------------------------------------------------------------------
    // C9 — Triste: deadline no passado → revert PurchaseManager__InvalidDeadline
    // -------------------------------------------------------------------------

    function test_C9_Triste_DeadlineNoPassado_RevertPurchaseManager__InvalidDeadline() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        vm.prank(instituicao1);
        vm.expectRevert(PurchaseManager.PurchaseManager__InvalidDeadline.selector);
        purchaseManager.openPurchase(
            fornecedor,
            1 ether,
            block.timestamp, // igual ao timestamp atual — não é futuro
            keccak256("compra invalida")
        );
    }

    // =========================================================================
    // D — Disputa
    // =========================================================================

    // -------------------------------------------------------------------------
    // D1 — Caminho feliz: fornecedor não entregou → openDispute → doadores votam pela inst → inst reembolsada
    // -------------------------------------------------------------------------

    function test_D1_CaminhoFeliz_FornNaoEntregou_InstituicaoReembolsada() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        uint256 prazo = block.timestamp + PRAZO_ENTREGA;
        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            fornecedor,
            3 ether,
            prazo,
            keccak256("compra de medicamentos")
        );

        uint256 saldoDisponivelAntes = treasury.availableBalance(instituicao1);

        // prazo de entrega expira sem o fornecedor confirmar
        vm.warp(prazo + 1);
        vm.prank(instituicao1);
        purchaseManager.openDispute(pedidoId);

        assertEq(
            uint256(purchaseManager.getPurchase(pedidoId).status),
            uint256(PurchaseManager.PurchaseStatus.Disputed)
        );

        // doadores votam pela instituição (false = contra o fornecedor)
        vm.prank(doador1);
        purchaseManager.voteOnDispute(pedidoId, false);

        // finaliza disputa — instituição vence
        purchaseManager.finalizeDispute(pedidoId);

        assertEq(treasury.availableBalance(instituicao1), saldoDisponivelAntes + 3 ether);
        assertEq(
            uint256(purchaseManager.getPurchase(pedidoId).status),
            uint256(PurchaseManager.PurchaseStatus.Refunded)
        );
    }

    // -------------------------------------------------------------------------
    // D2 — Caminho feliz: fornecedor confirmou, inst não confirmou → openDispute → forn vota → forn pago
    // -------------------------------------------------------------------------

    function test_D2_CaminhoFeliz_InstNaoConfirmou_FornecedorGanhaDisputa() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            fornecedor,
            2 ether,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("servico de limpeza")
        );

        // fornecedor confirma entrega
        vm.prank(fornecedor);
        purchaseManager.confirmDelivery(pedidoId);

        uint256 saldoFornecedorAntes = fornecedor.balance;

        // prazo de confirmação expira sem a instituição confirmar
        PurchaseManager.Purchase memory p = purchaseManager.getPurchase(pedidoId);
        vm.warp(p.confirmDeadline + 1);
        vm.prank(fornecedor);
        purchaseManager.openDispute(pedidoId);

        // doadores votam pelo fornecedor
        vm.prank(doador1);
        purchaseManager.voteOnDispute(pedidoId, true);

        purchaseManager.finalizeDispute(pedidoId);

        assertEq(fornecedor.balance, saldoFornecedorAntes + 2 ether);
        assertEq(
            uint256(purchaseManager.getPurchase(pedidoId).status),
            uint256(PurchaseManager.PurchaseStatus.Paid)
        );
    }

    // -------------------------------------------------------------------------
    // D3 — Caminho feliz: disputa aberta → doador vota pelo forn → forn ganha → forn pago
    // -------------------------------------------------------------------------

    function test_D3_CaminhoFeliz_FornGanhaDisputa_FornecedorRecebePagamento() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            fornecedor,
            4 ether,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("compra de equipamentos")
        );

        vm.prank(fornecedor);
        purchaseManager.confirmDelivery(pedidoId);

        PurchaseManager.Purchase memory p = purchaseManager.getPurchase(pedidoId);
        vm.warp(p.confirmDeadline + 1);
        vm.prank(fornecedor);
        purchaseManager.openDispute(pedidoId);

        uint256 saldoAntes = fornecedor.balance;

        // doador1 vota a favor do fornecedor
        vm.prank(doador1);
        purchaseManager.voteOnDispute(pedidoId, true);

        purchaseManager.finalizeDispute(pedidoId);

        assertEq(fornecedor.balance, saldoAntes + 4 ether);
        assertEq(
            uint256(purchaseManager.getPurchase(pedidoId).status),
            uint256(PurchaseManager.PurchaseStatus.Paid)
        );
    }

    // -------------------------------------------------------------------------
    // D4 — Caminho feliz: sem quórum → prazo encerra → finalizeDispute → inst reembolsada por padrão
    // -------------------------------------------------------------------------

    function test_D4_CaminhoFeliz_SemQuorum_InstGanhaPorPadrao_FundosProtegidos() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        uint256 prazo = block.timestamp + PRAZO_ENTREGA;
        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            fornecedor,
            5 ether,
            prazo,
            keccak256("compra para abrigo")
        );

        uint256 saldoDisponivelAntes = treasury.availableBalance(instituicao1);

        // prazo expira — ninguém confirma entrega
        vm.warp(prazo + 1);
        vm.prank(instituicao1);
        purchaseManager.openDispute(pedidoId);

        // janela de disputa encerra — ninguém votou
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        // instituição vence por padrão — protege fundos
        purchaseManager.finalizeDispute(pedidoId);

        assertEq(treasury.availableBalance(instituicao1), saldoDisponivelAntes + 5 ether);
        assertEq(
            uint256(purchaseManager.getPurchase(pedidoId).status),
            uint256(PurchaseManager.PurchaseStatus.Refunded)
        );
    }

    // -------------------------------------------------------------------------
    // D5 — Caminho feliz: disputa aberta → inst e forn submetem evidências → evidências visíveis
    // -------------------------------------------------------------------------

    function test_D5_CaminhoFeliz_EvidenciasSubmetidas_EvidenciasVisiveis() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        uint256 prazo = block.timestamp + PRAZO_ENTREGA;
        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            fornecedor,
            1 ether,
            prazo,
            keccak256("compra")
        );

        vm.warp(prazo + 1);
        vm.prank(instituicao1);
        purchaseManager.openDispute(pedidoId);

        bytes32 evidenciaInst = keccak256("nota_fiscal.pdf");
        bytes32 evidenciaForn = keccak256("comprovante_envio.pdf");

        vm.prank(instituicao1);
        purchaseManager.addDisputeEvidence(pedidoId, evidenciaInst);

        vm.prank(fornecedor);
        purchaseManager.addDisputeEvidence(pedidoId, evidenciaForn);

        bytes32[] memory evidencias = purchaseManager.getDisputeEvidences(pedidoId);
        assertEq(evidencias.length, 2);
        assertEq(evidencias[0], evidenciaInst);
        assertEq(evidencias[1], evidenciaForn);
    }

    // -------------------------------------------------------------------------
    // D6 — Triste: openDispute antes do prazo expirar → revert DeadlineNotExpired
    // -------------------------------------------------------------------------

    function test_D6_Triste_DisputaAntesDoDeadline_RevertPurchaseManager__DeadlineNotExpired() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            fornecedor,
            1 ether,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("compra")
        );

        // tenta abrir disputa antes do prazo vencer
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__DeadlineNotExpired.selector, pedidoId));
        purchaseManager.openDispute(pedidoId);
    }

    // -------------------------------------------------------------------------
    // D7 — Triste: voto na disputa após disputeDeadline → revert DisputeWindowClosed
    // -------------------------------------------------------------------------

    function test_D7_Triste_VotoForaDoJanelaDeDisputa_RevertPurchaseManager__DisputeWindowClosed() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        uint256 prazo = block.timestamp + PRAZO_ENTREGA;
        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            fornecedor,
            1 ether,
            prazo,
            keccak256("compra")
        );

        vm.warp(prazo + 1);
        vm.prank(instituicao1);
        purchaseManager.openDispute(pedidoId);

        // avança além da janela de disputa
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);

        vm.prank(doador1);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__DisputeWindowClosed.selector, pedidoId));
        purchaseManager.voteOnDispute(pedidoId, true);
    }

    // -------------------------------------------------------------------------
    // D8 — Triste: evidência vazia em disputa → revert EmptyProofHash
    // -------------------------------------------------------------------------

    function test_D8_Triste_EvidenciaVaziaEmDisputa_RevertPurchaseManager__EmptyProofHash() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        uint256 prazo = block.timestamp + PRAZO_ENTREGA;
        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            fornecedor,
            1 ether,
            prazo,
            keccak256("compra")
        );

        vm.warp(prazo + 1);
        vm.prank(instituicao1);
        purchaseManager.openDispute(pedidoId);

        vm.prank(instituicao1);
        vm.expectRevert(PurchaseManager.PurchaseManager__EmptyProofHash.selector);
        purchaseManager.addDisputeEvidence(pedidoId, bytes32(0));
    }

    // -------------------------------------------------------------------------
    // D9 — Triste: terceiro tenta addDisputeEvidence → revert OnlyParty
    // -------------------------------------------------------------------------

    function test_D9_Triste_TerceiroTentaAdicionarEvidencia_RevertPurchaseManager__OnlyParty() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        uint256 prazo = block.timestamp + PRAZO_ENTREGA;
        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            fornecedor,
            1 ether,
            prazo,
            keccak256("compra")
        );

        vm.warp(prazo + 1);
        vm.prank(instituicao1);
        purchaseManager.openDispute(pedidoId);

        address terceiro = makeAddr("terceiro");
        vm.prank(terceiro);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__OnlyParty.selector, pedidoId));
        purchaseManager.addDisputeEvidence(pedidoId, keccak256("evidencia_falsa.pdf"));
    }

    // =========================================================================
    // F — Doação
    // =========================================================================

    // -------------------------------------------------------------------------
    // F1 — Caminho feliz: peso quadrático acumula corretamente ao longo das doações
    // -------------------------------------------------------------------------

    function test_F1_CaminhoFeliz_PesoQuadraticoAcumula_SqrtDoTotalDoado() public {
        _bootstrapPlataforma();

        // doador2 ainda não doou — peso inicial = 0
        assertEq(treasury.currentVotingWeight(doador2), 0);

        // doador2 doa 1 ETH → peso = sqrt(1e18)
        vm.roll(block.number + 1);
        vm.prank(doador2);
        treasury.donate{ value: 1 ether }(instituicao1);

        uint256 pesoApos1Ether = treasury.currentVotingWeight(doador2);
        assertEq(pesoApos1Ether, uint256(1 ether).sqrt());

        // doador2 doa mais 3 ETH → total = 4 ETH → peso = sqrt(4e18) = 2 * sqrt(1e18)
        vm.roll(block.number + 1);
        vm.prank(doador2);
        treasury.donate{ value: 3 ether }(instituicao1);

        uint256 pesoApos4Ether = treasury.currentVotingWeight(doador2);
        assertEq(pesoApos4Ether, uint256(4 ether).sqrt());

        // sqrt(4 ether) = 2 * sqrt(1 ether)
        assertEq(pesoApos4Ether, 2 * pesoApos1Ether);
    }

    // -------------------------------------------------------------------------
    // F2 — Triste: doação para instituição pausada → revert Treasury__InstitutionNotActive
    // -------------------------------------------------------------------------

    function test_F2_Triste_DoacaoAInstituicaoPausada_RevertTreasury__InstitutionNotActive() public {
        _aprovarInstituicao2();

        // pausa inst2
        vm.prank(operator);
        uint256 propPausa = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            instituicao2,
            "",
            ""
        );
        vm.prank(doador1);
        governance.vote(propPausa, true);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        governance.finalize(propPausa, "", "");

        vm.prank(doador2);
        vm.expectRevert(abi.encodeWithSelector(
            Treasury.Treasury__InstitutionNotActive.selector, instituicao2));
        treasury.donate{ value: 1 ether }(instituicao2);
    }

    // -------------------------------------------------------------------------
    // F3 — Triste: doação com value=0 → revert Treasury__ZeroAmount
    // -------------------------------------------------------------------------

    function test_F3_Triste_DoacaoZero_RevertTreasury__ZeroAmount() public {
        _bootstrapPlataforma();

        vm.prank(doador2);
        vm.expectRevert(Treasury.Treasury__ZeroAmount.selector);
        treasury.donate{ value: 0 }(instituicao1);
    }

    // -------------------------------------------------------------------------
    // F4 — Triste: doação para instituição removida → revert Treasury__InstitutionNotActive
    // -------------------------------------------------------------------------

    function test_F4_Triste_DoacaoAInstituicaoRemovida_RevertTreasury__InstitutionNotActive() public {
        _aprovarInstituicao2();

        vm.prank(operator);
        uint256 propRemocao = governance.propose(
            GovernanceDAO.ProposalType.RemoveInstitution,
            instituicao2,
            "",
            ""
        );
        vm.prank(doador1);
        governance.vote(propRemocao, true);
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        governance.finalize(propRemocao, "", "");

        assertEq(
            uint256(registry.statusOf(instituicao2)),
            uint256(InstitutionRegistry.Status.Removed)
        );

        vm.prank(doador2);
        vm.expectRevert(abi.encodeWithSelector(
            Treasury.Treasury__InstitutionNotActive.selector, instituicao2));
        treasury.donate{ value: 1 ether }(instituicao2);
    }

    // =========================================================================
    // S — Segurança
    // =========================================================================

    // -------------------------------------------------------------------------
    // S1 — Saldo isolado entre instituições: inst1 não pode financiar pedido de inst2
    // -------------------------------------------------------------------------

    function test_S1_SaldoIsoladoEntreInstituicoes_InstNaoPodeUsarSaldoDaOutra() public {
        _aprovarInstituicao2();
        _aprovarFornecedor();

        // doador2 doa apenas para inst2
        vm.prank(doador2);
        treasury.donate{ value: 5 ether }(instituicao2);

        assertEq(treasury.availableBalance(instituicao1), 10 ether); // saldo do bootstrap
        assertEq(treasury.availableBalance(instituicao2), 5 ether);

        // inst1 abre pedido de 3 ether — deve usar apenas seu próprio saldo
        vm.prank(instituicao1);
        purchaseManager.openPurchase(
            fornecedor,
            3 ether,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("compra inst1")
        );

        // saldo de inst1 reduz; saldo de inst2 permanece intacto
        assertEq(treasury.availableBalance(instituicao1), 7 ether);
        assertEq(treasury.reservedBalance(instituicao1), 3 ether);
        assertEq(treasury.availableBalance(instituicao2), 5 ether);
        assertEq(treasury.reservedBalance(instituicao2), 0);

        // inst2 não pode abrir pedido maior que seu próprio saldo
        vm.prank(instituicao2);
        vm.expectRevert(abi.encodeWithSelector(
            Treasury.Treasury__InsufficientBalance.selector,
            instituicao2,
            5 ether,
            8 ether
        ));
        purchaseManager.openPurchase(
            fornecedor,
            8 ether,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("compra inst2 invalida")
        );
    }

    // -------------------------------------------------------------------------
    // S2 — Reentrância protegida: pagamento segue CEI — estado atualizado antes da transferência
    // -------------------------------------------------------------------------

    function test_S2_ReentranciaProtegida_PagamentoSegueCEI_EstadoAntesdaTransferencia() public {
        // Contrato atacante que tenta re-entrar em openDispute durante o recebimento de ETH
        FornecedorReentrante malicioso = new FornecedorReentrante(purchaseManager);

        vm.prank(address(governance));
        registry.register(instituicao1, "ONG Teste", "alimentos");
        vm.prank(address(governance));
        purchaseManager.approveSupplier(address(malicioso), "Malicioso Corp", "servicos");

        vm.prank(doador1);
        treasury.donate{ value: 10 ether }(instituicao1);

        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(
            address(malicioso),
            1 ether,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("servico")
        );
        malicioso.configurarPedido(pedidoId);

        vm.prank(address(malicioso));
        purchaseManager.confirmDelivery(pedidoId);

        PurchaseManager.Purchase memory p = purchaseManager.getPurchase(pedidoId);
        vm.warp(p.confirmDeadline + 1);
        vm.prank(address(malicioso));
        purchaseManager.openDispute(pedidoId);

        // doador1 vota pelo malicioso para acionar pagamento
        vm.prank(doador1);
        purchaseManager.voteOnDispute(pedidoId, true);

        uint256 saldoAntes = address(malicioso).balance;
        purchaseManager.finalizeDispute(pedidoId); // malicioso.receive() tenta re-entrada

        // apenas um pagamento — re-entrada bloqueada pelo CEI
        assertEq(address(malicioso).balance, saldoAntes + 1 ether);
        assertEq(treasury.reservedBalance(instituicao1), 0);
        assertEq(malicioso.tentativasDeReentrada(), 1);
    }

    // -------------------------------------------------------------------------
    // S3 — Snapshot impede flash loan: doação após snapshot não afeta peso de voto na proposta
    // -------------------------------------------------------------------------

    function test_S3_SnapshotImpedeFlashLoan_DoacaoAposSnapshotNaoAfetaPesoDeVoto() public {
        _bootstrapPlataforma();

        // operador cria proposta — snapshot no bloco atual
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            instituicao1,
            "",
            ""
        );

        GovernanceDAO.Proposal memory prop = governance.getProposal(propId);
        uint256 blocoDoSnapshot = prop.snapshotBlock;

        // doador2 não tinha doado antes do snapshot — tenta votar com doação posterior
        vm.roll(block.number + 1);
        vm.prank(doador2);
        treasury.donate{ value: 50 ether }(instituicao1);

        // doador2 tenta votar — não tinha peso no bloco do snapshot
        vm.prank(doador2);
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__NoVotingPower.selector, doador2));
        governance.vote(propId, true);

        // confirmação: doador2 tem peso atual mas zero no snapshot
        assertGt(treasury.currentVotingWeight(doador2), 0);
        assertEq(treasury.votingWeightAtBlock(doador2, blocoDoSnapshot), 0);
    }

    // -------------------------------------------------------------------------
    // S4 — Fornecedor removido da whitelist não recebe novos pedidos
    // -------------------------------------------------------------------------

    function test_S4_FornecedorRemovidoNaoRecebeNovasPedidos_RevertNotWhitelisted() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        assertTrue(purchaseManager.approvedSuppliers(fornecedor));

        // governança revoga fornecedor
        vm.prank(address(governance));
        purchaseManager.revokeSupplier(fornecedor);

        assertFalse(purchaseManager.approvedSuppliers(fornecedor));

        // tentativa de abrir novo pedido para fornecedor revogado
        vm.prank(instituicao1);
        vm.expectRevert(abi.encodeWithSelector(
            SupplierRegistry.SupplierRegistry__NotWhitelisted.selector, fornecedor));
        purchaseManager.openPurchase(
            fornecedor,
            1 ether,
            block.timestamp + PRAZO_ENTREGA,
            keccak256("compra bloqueada")
        );
    }

    // =========================================================================
    // M — Mapa do Bem
    // =========================================================================

    // -------------------------------------------------------------------------
    // M1 — Compra completa emite todos os eventos esperados
    // -------------------------------------------------------------------------

    function test_M1_EventosGravadosNaCompraCompleta_TodosEventosEmitidos() public {
        _bootstrapPlataforma();
        _aprovarFornecedor();

        uint256 prazo = block.timestamp + PRAZO_ENTREGA;
        bytes32 descHash = keccak256("distribuicao de cestas basicas");
        bytes32 ipfsHash = keccak256("foto_evidencia_georreferenciada.jpg");
        uint256 valor    = 2 ether;

        // ---- PurchaseOpened ----
        vm.expectEmit(true, true, true, true);
        emit PurchaseManager.PurchaseOpened(1, instituicao1, fornecedor, valor, prazo, descHash);

        vm.prank(instituicao1);
        uint256 pedidoId = purchaseManager.openPurchase(fornecedor, valor, prazo, descHash);

        // ---- DeliveryConfirmed ----
        vm.expectEmit(true, false, false, false);
        emit PurchaseManager.DeliveryConfirmed(pedidoId, 0); // confirmDeadline verificado via estado

        vm.prank(fornecedor);
        purchaseManager.confirmDelivery(pedidoId);

        // ---- ReceiptConfirmed ----
        vm.expectEmit(true, false, false, false);
        emit PurchaseManager.ReceiptConfirmed(pedidoId);

        vm.prank(instituicao1);
        purchaseManager.confirmReceipt(pedidoId);

        // ---- ImpactProofSubmitted + ImmutableReceipt + PaymentReleased ----
        vm.expectEmit(true, false, false, true);
        emit PurchaseManager.ImpactProofSubmitted(pedidoId, ipfsHash);

        vm.expectEmit(true, true, true, true);
        emit PurchaseManager.ImmutableReceipt(pedidoId, instituicao1, fornecedor, valor, ipfsHash);

        vm.expectEmit(true, true, false, true);
        emit PurchaseManager.PaymentReleased(pedidoId, fornecedor, valor);

        vm.prank(instituicao1);
        purchaseManager.submitImpactProof(pedidoId, ipfsHash);

        // verificação final de estado
        assertEq(
            uint256(purchaseManager.getPurchase(pedidoId).status),
            uint256(PurchaseManager.PurchaseStatus.Paid)
        );
    }

    // -------------------------------------------------------------------------
    // M2 — Proposta → voto → execução emite eventos de governança
    // -------------------------------------------------------------------------

    function test_M2_EventosDeGovernancaGravados_PropostaVotoExecucao() public {
        _bootstrapPlataforma();

        // ---- ProposalCreated ----
        vm.expectEmit(false, false, false, false); // apenas verifica que evento é emitido
        emit GovernanceDAO.ProposalCreated(
            1,
            GovernanceDAO.ProposalType.ApproveInstitution,
            instituicao2,
            block.number,
            block.timestamp + VOTING_PERIOD,
            MIN_QUORUM,
            "ONG Saude",
            "saude"
        );

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.ApproveInstitution,
            instituicao2,
            "ONG Saude",
            "saude"
        );

        GovernanceDAO.Proposal memory prop = governance.getProposal(propId);
        uint256 pesoEsperado = treasury.votingWeightAtBlock(doador1, prop.snapshotBlock);

        // ---- VoteCast ----
        vm.expectEmit(true, true, false, true);
        emit GovernanceDAO.VoteCast(propId, doador1, true, pesoEsperado);

        vm.prank(doador1);
        governance.vote(propId, true);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        // ---- ProposalExecuted ----
        vm.expectEmit(true, false, false, false);
        emit GovernanceDAO.ProposalExecuted(propId);

        governance.finalize(propId, "ONG Saude", "saude");

        assertEq(
            uint256(registry.statusOf(instituicao2)),
            uint256(InstitutionRegistry.Status.Active)
        );
    }

    // -------------------------------------------------------------------------
    // M3 — Doação emite DonationReceived e VotingWeightUpdated
    // -------------------------------------------------------------------------

    function test_M3_EventosDeDoacaoGravados_DonationReceivedEVotingWeightUpdated() public {
        _bootstrapPlataforma();

        uint256 valorDoacao = 9 ether;
        uint256 totalEsperado = treasury.totalDonated(doador2) + valorDoacao;
        uint256 pesoEsperado = totalEsperado.sqrt();

        // ---- DonationReceived ----
        vm.expectEmit(true, true, false, true);
        emit Treasury.DonationReceived(doador2, instituicao1, valorDoacao);

        // ---- VotingWeightUpdated ----
        vm.expectEmit(true, false, false, true);
        emit Treasury.VotingWeightUpdated(doador2, totalEsperado, pesoEsperado);

        vm.prank(doador2);
        treasury.donate{ value: valorDoacao }(instituicao1);

        assertEq(treasury.currentVotingWeight(doador2), pesoEsperado);
        assertEq(treasury.totalDonated(doador2), totalEsperado);
    }
}

// =============================================================================
// Contrato auxiliar — ataque de reentrância
// =============================================================================

/// @dev Fornecedor malicioso que tenta re-entrar em openDispute durante o recebimento de ETH.
///      O padrão CEI garante que o status já está atualizado para Paid antes da transferência,
///      bloqueando a re-entrada silenciosamente (try/catch no receive).
contract FornecedorReentrante {
    PurchaseManager public immutable purchaseManager;
    uint256 public tentativasDeReentrada;
    uint256 public pedidoArmazenado;

    constructor(PurchaseManager _pm) {
        purchaseManager = _pm;
    }

    function configurarPedido(uint256 pid) external {
        pedidoArmazenado = pid;
    }

    receive() external payable {
        tentativasDeReentrada++;
        try purchaseManager.openDispute(pedidoArmazenado) {} catch {}
    }
}
