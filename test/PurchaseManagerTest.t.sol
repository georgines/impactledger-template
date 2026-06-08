// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { SupplierRegistry }    from "../contracts/lib/SupplierRegistry.sol";
import { InstitutionRegistry } from "../contracts/InstitutionRegistry.sol";
import { Treasury }            from "../contracts/Treasury.sol";
import { PurchaseManager }     from "../contracts/PurchaseManager.sol";
import { GovernanceDAO }       from "../contracts/GovernanceDAO.sol";

// Contrato atacante para teste de reentrância: tenta re-entrar em openDispute
// durante o recebimento de ETH. O padrão CEI garante que o status já está
// atualizado para Paid antes da transferência, bloqueando a re-entrada.
contract FornecedorMalicioso {
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

contract PurchaseManagerTest is Test {
    address operator    = makeAddr("operator");
    address institution = makeAddr("institution");
    address supplier    = makeAddr("supplier");
    address donor1      = makeAddr("donor1");

    GovernanceDAO       governance;
    InstitutionRegistry registry;
    Treasury            treasury;
    PurchaseManager     purchaseManager;

    uint256 constant PRAZO_ENTREGA       = 14 days;
    uint256 constant JANELA_CONFIRMACAO  = 7 days;

    function setUp() public {
        uint256 nonce = vm.getNonce(address(this));

        address govAddr = vm.computeCreateAddress(address(this), nonce);
        address regAddr = vm.computeCreateAddress(address(this), nonce + 1);
        address trsAddr = vm.computeCreateAddress(address(this), nonce + 2);
        address pmAddr  = vm.computeCreateAddress(address(this), nonce + 3);

        governance      = new GovernanceDAO(operator, regAddr, pmAddr, trsAddr, 0, 7 days);
        registry        = new InstitutionRegistry(govAddr);
        treasury        = new Treasury(govAddr, pmAddr, regAddr);
        purchaseManager = new PurchaseManager(govAddr, regAddr, trsAddr, 0, 7 days, 7 days);

        vm.deal(donor1, 100 ether);
    }

    function _prepararInstituicaoEFornecedor() internal {
        vm.prank(address(governance));
        registry.register(institution, "ONG Teste", "alimentos");
        vm.prank(address(governance));
        purchaseManager.approveSupplier(supplier, "Fornecedor Teste", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 10 ether }(institution);
    }

    function _prazoDeEntregaPadrao() internal view returns (uint256) {
        return block.timestamp + PRAZO_ENTREGA;
    }

    // Abre disputa contra fornecedor (Open + deliveryDeadline expirado).
    // Apenas a instituição pode acionar — helper centraliza o vm.prank.
    function _abrirDisputaEntregaExpirada(uint256 pid) internal {
        vm.prank(institution);
        purchaseManager.openDispute(pid);
    }

    // Abre disputa contra instituição (Delivered + confirmDeadline expirado).
    // Apenas o fornecedor pode acionar — helper centraliza o vm.prank.
    function _abrirDisputaConfirmacaoExpirada(uint256 pid) internal {
        vm.prank(supplier);
        purchaseManager.openDispute(pid);
    }

    // =========================================================================
    // UC-04 — Abertura de pedido de compra
    // =========================================================================

    function test_PedidoArmazenaPrazoDeEntregaDefinidoPelaInstituicao() public {
        _prepararInstituicaoEFornecedor();

        uint256 prazo = _prazoDeEntregaPadrao();
        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, prazo, keccak256("compra teste"));

        assertEq(purchaseManager.getPurchase(pid).deliveryDeadline, prazo);
    }

    function test_PedidoComPrazoDeEntregaNoPassadoERejeitado() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        vm.expectRevert(PurchaseManager.PurchaseManager__InvalidDeadline.selector);
        purchaseManager.openPurchase(supplier, 1 ether, block.timestamp, keccak256("compra invalida"));
    }

    function test_InstituicaoNaoCadastradaNaoPodeFazerPedido() public {
        vm.prank(address(governance));
        purchaseManager.approveSupplier(supplier, "Fornecedor", "alimentos");

        vm.prank(institution); // não registrada
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__InstitutionNotActive.selector, institution));
        purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
    }

    function test_InstituicaoPausadaNaoPodeFazerPedido() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        registry.pause(institution);
        vm.prank(address(governance));
        purchaseManager.approveSupplier(supplier, "Fornecedor", "alimentos");

        vm.prank(institution);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__InstitutionNotActive.selector, institution));
        purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
    }

    function test_PedidoComValorZeroERejeitado() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        vm.expectRevert(PurchaseManager.PurchaseManager__ZeroAmount.selector);
        purchaseManager.openPurchase(supplier, 0, _prazoDeEntregaPadrao(), keccak256("compra"));
    }

    function test_PedidoComFornecedorNaoAprovadoERejeitado() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(donor1);
        treasury.donate{ value: 5 ether }(institution);

        address fornecedorSemAprovacao = makeAddr("fornecedorSemAprovacao");

        vm.prank(institution);
        vm.expectRevert(abi.encodeWithSelector(
            SupplierRegistry.SupplierRegistry__NotWhitelisted.selector, fornecedorSemAprovacao));
        purchaseManager.openPurchase(fornecedorSemAprovacao, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra invalida"));
    }

    function test_PedidoArmazestaDescricaoDaCompra() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("Compra de cestas basicas"));

        PurchaseManager.Purchase memory p = purchaseManager.getPurchase(pid);
        assertEq(p.descriptionHash, keccak256("Compra de cestas basicas"));
    }

    // =========================================================================
    // UC-05 — Confirmação de entrega pelo fornecedor
    // =========================================================================

    function test_ConfirmacaoDeEntregaDefineJanelaParaInstituicaoConfirmar() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra teste"));

        uint256 momento = block.timestamp;
        vm.prank(supplier);
        purchaseManager.confirmDelivery(pid);

        assertEq(purchaseManager.getPurchase(pid).confirmDeadline,
            momento + purchaseManager.confirmationWindow());
    }

    function test_SomenteFornecedorDosPedidoPodeConfirmarEntrega() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));

        address impostorr = makeAddr("impostor");
        vm.prank(impostorr);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__OnlySupplier.selector, pid, supplier));
        purchaseManager.confirmDelivery(pid);
    }

    // =========================================================================
    // UC-06 — Confirmação de recebimento e Proof of Impact
    // =========================================================================

    function test_SomenteInstituicaoDoPedidoPodeConfirmarRecebimento() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier); purchaseManager.confirmDelivery(pid);

        address impostorr = makeAddr("impostor");
        vm.prank(impostorr);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__OnlyInstitution.selector, pid, institution));
        purchaseManager.confirmReceipt(pid);
    }

    function test_ComprovanteDImpactoVazioERejeitado() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier); purchaseManager.confirmDelivery(pid);
        vm.prank(institution); purchaseManager.confirmReceipt(pid);

        vm.prank(institution);
        vm.expectRevert(PurchaseManager.PurchaseManager__EmptyProofHash.selector);
        purchaseManager.submitImpactProof(pid, bytes32(0));
    }

    function test_ComprovanteDImpactoSemConfirmacaoDeRecebimentoERejeitado() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier); purchaseManager.confirmDelivery(pid);
        // instituição não confirmou o recebimento — status ainda é Delivered

        vm.prank(institution);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__InvalidStatus.selector,
            pid,
            PurchaseManager.PurchaseStatus.Delivered,
            PurchaseManager.PurchaseStatus.Confirmed));
        purchaseManager.submitImpactProof(pid, keccak256("prova.jpg"));
    }

    function test_EnvioDeComprovanteDImpactoGeraReciboImutavel() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("Distribuicao de alimentos"));
        vm.prank(supplier); purchaseManager.confirmDelivery(pid);
        vm.prank(institution); purchaseManager.confirmReceipt(pid);

        bytes32 hash = keccak256("foto.jpg");

        vm.expectEmit(true, true, true, true);
        emit PurchaseManager.ImmutableReceipt(pid, institution, supplier, 1 ether, hash);

        vm.prank(institution);
        purchaseManager.submitImpactProof(pid, hash);
    }

    // =========================================================================
    // Fluxo completo — caminho feliz
    // =========================================================================

    function test_FluxoCompletoDeCompraPedidoEntregaConfirmacaoPagamento() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("Reforma do abrigo"));

        assertEq(treasury.reservedBalance(institution), 1 ether);
        assertEq(treasury.availableBalance(institution), 9 ether);

        vm.prank(supplier); purchaseManager.confirmDelivery(pid);
        vm.prank(institution); purchaseManager.confirmReceipt(pid);

        uint256 saldoAntesDoPagamento = supplier.balance;
        vm.prank(institution);
        purchaseManager.submitImpactProof(pid, keccak256("prova.jpg"));

        assertEq(supplier.balance, saldoAntesDoPagamento + 1 ether);
        assertEq(treasury.reservedBalance(institution), 0);
        assertEq(uint256(purchaseManager.getPurchase(pid).status),
            uint256(PurchaseManager.PurchaseStatus.Paid));
    }

    // =========================================================================
    // UC-07 — Disputa automática por prazo de entrega expirado
    // =========================================================================

    function test_DisputaAbertaAutomaticamenteAposVencimentoDoPrazoDeEntrega() public {
        _prepararInstituicaoEFornecedor();

        uint256 prazo = _prazoDeEntregaPadrao();
        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, prazo, keccak256("compra teste"));

        vm.warp(prazo + 1);

        vm.prank(institution);
        purchaseManager.openDispute(pid);

        assertEq(uint256(purchaseManager.getPurchase(pid).status),
            uint256(PurchaseManager.PurchaseStatus.Disputed));
    }

    function test_RevertWhen_NaoInstituicaoTentaAbrirDisputaContraFornecedor() public {
        _prepararInstituicaoEFornecedor();

        uint256 prazo = _prazoDeEntregaPadrao();
        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, prazo, keccak256("compra teste"));

        vm.warp(prazo + 1);

        address terceiro = makeAddr("terceiro");
        vm.prank(terceiro);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__OnlyInstitution.selector, pid, institution));
        purchaseManager.openDispute(pid);
    }

    function test_RevertWhen_FornecedorTentaAbrirDisputaContraEleProprioNoStatusOpen() public {
        _prepararInstituicaoEFornecedor();

        uint256 prazo = _prazoDeEntregaPadrao();
        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, prazo, keccak256("compra teste"));

        vm.warp(prazo + 1);

        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__OnlyInstitution.selector, pid, institution));
        purchaseManager.openDispute(pid);
    }

    function test_NaoPodeAbrirDisputaAntesDoPrazoDeEntregaVencer() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra teste"));

        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__DeadlineNotExpired.selector, pid));
        purchaseManager.openDispute(pid);
    }

    // =========================================================================
    // UC-08 — Disputa automática por prazo de confirmação expirado
    // =========================================================================

    function test_DisputaAbertaAutomaticamenteAposVencimentoDaPrazoDeConfirmacao() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra teste"));

        vm.prank(supplier);
        purchaseManager.confirmDelivery(pid);

        vm.warp(block.timestamp + JANELA_CONFIRMACAO + 1);

        vm.prank(supplier);
        purchaseManager.openDispute(pid);

        assertEq(uint256(purchaseManager.getPurchase(pid).status),
            uint256(PurchaseManager.PurchaseStatus.Disputed));
    }

    function test_RevertWhen_NaoFornecedorTentaAbrirDisputaContraInstituicao() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra teste"));

        vm.prank(supplier);
        purchaseManager.confirmDelivery(pid);

        vm.warp(block.timestamp + JANELA_CONFIRMACAO + 1);

        address terceiro = makeAddr("terceiro");
        vm.prank(terceiro);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__OnlySupplier.selector, pid, supplier));
        purchaseManager.openDispute(pid);
    }

    function test_RevertWhen_InstituicaoTentaAbrirDisputaContraElaPropriaNoStatusDelivered() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra teste"));

        vm.prank(supplier);
        purchaseManager.confirmDelivery(pid);

        vm.warp(block.timestamp + JANELA_CONFIRMACAO + 1);

        vm.prank(institution);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__OnlySupplier.selector, pid, supplier));
        purchaseManager.openDispute(pid);
    }

    function test_NaoPodeAbrirDisputaAntesDoPrazoDeConfirmacaoVencer() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra teste"));

        vm.prank(supplier);
        purchaseManager.confirmDelivery(pid);

        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__DeadlineNotExpired.selector, pid));
        purchaseManager.openDispute(pid);
    }

    function test_NaoPodeAbrirDisputaAposReceberConfirmacaoDeRecebimento() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra teste"));
        vm.prank(supplier); purchaseManager.confirmDelivery(pid);
        vm.prank(institution); purchaseManager.confirmReceipt(pid);

        vm.expectRevert();
        purchaseManager.openDispute(pid);
    }

    // =========================================================================
    // UC-07/08 — Resolução de disputa por votação de doadores
    // =========================================================================

    function test_FornecedorVenceDisputaQuandoDoadorVotaAFavor() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("Servico de limpeza"));

        vm.prank(supplier);
        purchaseManager.confirmDelivery(pid);

        vm.warp(block.timestamp + JANELA_CONFIRMACAO + 1);
        _abrirDisputaConfirmacaoExpirada(pid);

        vm.prank(supplier);
        purchaseManager.addDisputeEvidence(pid, keccak256("nf.pdf"));

        uint256 saldoAntes = supplier.balance;
        vm.prank(donor1);
        purchaseManager.voteOnDispute(pid, true); // vota a favor do fornecedor
        purchaseManager.finalizeDispute(pid);

        assertEq(supplier.balance, saldoAntes + 1 ether);
        assertEq(uint256(purchaseManager.getPurchase(pid).status),
            uint256(PurchaseManager.PurchaseStatus.Paid));
    }

    function test_InstituicaoVenceDisputaQuandoDoadorVotaAFavor() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("Compra de medicamentos"));

        vm.prank(supplier);
        purchaseManager.confirmDelivery(pid);

        vm.warp(block.timestamp + JANELA_CONFIRMACAO + 1);
        _abrirDisputaConfirmacaoExpirada(pid);

        uint256 saldoAntes = treasury.availableBalance(institution);
        vm.prank(donor1);
        purchaseManager.voteOnDispute(pid, false); // vota a favor da instituição
        purchaseManager.finalizeDispute(pid);

        assertEq(treasury.availableBalance(institution), saldoAntes + 1 ether);
        assertEq(uint256(purchaseManager.getPurchase(pid).status),
            uint256(PurchaseManager.PurchaseStatus.Refunded));
    }

    function test_SemVotosInstituicaoVenceDisputaPorPadraoProtegendoFundos() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.warp(_prazoDeEntregaPadrao() + 1);
        _abrirDisputaEntregaExpirada(pid);

        uint256 saldoAntes = treasury.availableBalance(institution);
        purchaseManager.finalizeDispute(pid);

        assertEq(treasury.availableBalance(institution), saldoAntes + 1 ether);
        assertEq(uint256(purchaseManager.getPurchase(pid).status),
            uint256(PurchaseManager.PurchaseStatus.Refunded));
    }

    function test_DoadorNaoPodeVotarDuasVezesNaMesmaDisputa() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier); purchaseManager.confirmDelivery(pid);
        vm.warp(block.timestamp + JANELA_CONFIRMACAO + 1);
        _abrirDisputaConfirmacaoExpirada(pid);

        vm.prank(donor1);
        purchaseManager.voteOnDispute(pid, true);

        vm.prank(donor1);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__AlreadyVoted.selector, pid, donor1));
        purchaseManager.voteOnDispute(pid, true);
    }

    function test_DoadorSemHistoricoDeDoacoesNaoPodeVotarEmDisputa() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier); purchaseManager.confirmDelivery(pid);
        vm.warp(block.timestamp + JANELA_CONFIRMACAO + 1);
        _abrirDisputaConfirmacaoExpirada(pid);

        address semDoacao = makeAddr("semDoacao");
        vm.prank(semDoacao);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__NoVotingPower.selector, semDoacao));
        purchaseManager.voteOnDispute(pid, false);
    }

    function test_EvidenciaNaoPodeSerAdicionadaAposEncerramentoDosPrazoDeDisputa() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier); purchaseManager.confirmDelivery(pid);
        vm.warp(block.timestamp + JANELA_CONFIRMACAO + 1);
        _abrirDisputaConfirmacaoExpirada(pid);

        vm.warp(block.timestamp + 7 days + 1); // janela de disputa encerrada

        vm.prank(institution);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__DisputeWindowClosed.selector, pid));
        purchaseManager.addDisputeEvidence(pid, keccak256("evidence.pdf"));
    }

    function test_VotoNaoEAceitoAposEncerramentoDosPrazoDeDisputa() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier); purchaseManager.confirmDelivery(pid);
        vm.warp(block.timestamp + JANELA_CONFIRMACAO + 1);
        _abrirDisputaConfirmacaoExpirada(pid);

        vm.warp(block.timestamp + 7 days + 1); // janela encerrada

        vm.prank(donor1);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__DisputeWindowClosed.selector, pid));
        purchaseManager.voteOnDispute(pid, true);
    }

    // =========================================================================
    // Janela de confirmação configurável no deploy
    // =========================================================================

    function test_JanelaDeConfirmacaoConfiguravelNoConstructor() public {
        PurchaseManager pm2 = new PurchaseManager(
            address(governance), address(registry), address(treasury), 0, 7 days, 3 days
        );
        assertEq(pm2.confirmationWindow(), 3 days);
    }

    function test_PrazoDeConfirmacaoRefletJanelaDefinidaNoDeploy() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));

        uint256 momento = block.timestamp;
        vm.prank(supplier);
        purchaseManager.confirmDelivery(pid);

        assertEq(purchaseManager.getPurchase(pid).confirmDeadline, momento + 7 days);
    }

    // =========================================================================
    // Janela de disputa configurável no deploy
    // =========================================================================

    function test_JanelaDeDisputaConfiguravelNoConstructor() public {
        PurchaseManager pm2 = new PurchaseManager(
            address(governance), address(registry), address(treasury), 0, 3 days, 7 days
        );
        assertEq(pm2.disputeWindow(), 3 days);
    }

    function test_PrazoDeDisputaRefletJanelaDefinidaNoDeploy() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));

        vm.warp(_prazoDeEntregaPadrao() + 1);
        uint256 momento = block.timestamp;
        _abrirDisputaEntregaExpirada(pid);

        assertEq(purchaseManager.getPurchase(pid).disputeDeadline, momento + 7 days);
    }

    // =========================================================================
    // Gestão de fornecedores aprovados
    // =========================================================================

    function test_FornecedorRemovidoDaWhitelistNaoPodeReceberPedidos() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(address(governance));
        purchaseManager.revokeSupplier(supplier);

        assertFalse(purchaseManager.approvedSuppliers(supplier));

        vm.prank(institution);
        vm.expectRevert(abi.encodeWithSelector(
            SupplierRegistry.SupplierRegistry__NotWhitelisted.selector, supplier));
        purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
    }

    // =========================================================================
    // Isolamento de saldo entre instituições (UC-03)
    // =========================================================================

    function test_SaldoDeCadaInstituicaoECompleamenteIsolado() public {
        address institution2 = makeAddr("institution2");

        vm.prank(address(governance));
        registry.register(institution, "ONG A", "alimentos");
        vm.prank(address(governance));
        registry.register(institution2, "ONG B", "educacao");

        vm.prank(donor1);
        treasury.donate{ value: 10 ether }(institution);

        address donor2 = makeAddr("donor2");
        vm.deal(donor2, 100 ether);
        vm.prank(donor2);
        treasury.donate{ value: 5 ether }(institution2);

        assertEq(treasury.availableBalance(institution), 10 ether);
        assertEq(treasury.availableBalance(institution2), 5 ether);

        vm.prank(address(governance));
        purchaseManager.approveSupplier(supplier, "Fornecedor", "alimentos");

        vm.prank(institution);
        purchaseManager.openPurchase(supplier, 3 ether, _prazoDeEntregaPadrao(), keccak256("compra institution1"));

        assertEq(treasury.availableBalance(institution), 7 ether);
        assertEq(treasury.reservedBalance(institution), 3 ether);
        assertEq(treasury.availableBalance(institution2), 5 ether);
        assertEq(treasury.reservedBalance(institution2), 0);
    }

    // =========================================================================
    // Consulta de evidências e votos
    // =========================================================================

    function test_EvidenciasDeDisputaSaoArmazenadasEConsultaveis() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier); purchaseManager.confirmDelivery(pid);
        vm.warp(block.timestamp + JANELA_CONFIRMACAO + 1);
        _abrirDisputaConfirmacaoExpirada(pid);

        bytes32 h1 = keccak256("evidencia1.pdf");
        bytes32 h2 = keccak256("evidencia2.pdf");

        vm.prank(institution);
        purchaseManager.addDisputeEvidence(pid, h1);
        vm.prank(supplier);
        purchaseManager.addDisputeEvidence(pid, h2);

        bytes32[] memory evidencias = purchaseManager.getDisputeEvidences(pid);
        assertEq(evidencias.length, 2);
        assertEq(evidencias[0], h1);
        assertEq(evidencias[1], h2);
    }

    function test_VotosDeDoadorEmDisputaSaoRastreados() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier); purchaseManager.confirmDelivery(pid);
        vm.warp(block.timestamp + JANELA_CONFIRMACAO + 1);
        _abrirDisputaConfirmacaoExpirada(pid);

        assertFalse(purchaseManager.hasVotedOnDispute(pid, donor1));

        vm.prank(donor1);
        purchaseManager.voteOnDispute(pid, true);

        assertTrue(purchaseManager.hasVotedOnDispute(pid, donor1));
    }

    // =========================================================================
    // Construtor — validação de endereços
    // =========================================================================

    function test_ContratoNaoInicializaComGovernancaEnderecoZero() public {
        vm.expectRevert(PurchaseManager.PurchaseManager__ZeroAddress.selector);
        new PurchaseManager(address(0), address(registry), address(treasury), 0, 7 days, 7 days);
    }

    function test_ContratoNaoInicializaComRegistroEnderecoZero() public {
        vm.expectRevert(PurchaseManager.PurchaseManager__ZeroAddress.selector);
        new PurchaseManager(address(governance), address(0), address(treasury), 0, 7 days, 7 days);
    }

    function test_ContratoNaoInicializaComTesourariaEnderecoZero() public {
        vm.expectRevert(PurchaseManager.PurchaseManager__ZeroAddress.selector);
        new PurchaseManager(address(governance), address(registry), address(0), 0, 7 days, 7 days);
    }

    // =========================================================================
    // Permissões — onlyGovernance para gestão de fornecedores
    // =========================================================================

    function test_SomenteGovernancaPodeAprovarFornecedor() public {
        address estranho = makeAddr("estranho");
        vm.prank(estranho);
        vm.expectRevert(PurchaseManager.PurchaseManager__OnlyGovernance.selector);
        purchaseManager.approveSupplier(supplier, "Fornecedor", "servicos");
    }

    function test_SomenteGovernancaPodeRemoverFornecedor() public {
        _prepararInstituicaoEFornecedor();

        address estranho = makeAddr("estranho");
        vm.prank(estranho);
        vm.expectRevert(PurchaseManager.PurchaseManager__OnlyGovernance.selector);
        purchaseManager.revokeSupplier(supplier);
    }

    // =========================================================================
    // Status — confirmações com estado inválido
    // =========================================================================

    function test_FornecedorNaoPodeConfirmarEntregaDeCompraJaEntregue() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier);
        purchaseManager.confirmDelivery(pid); // primeira confirmação — muda para Delivered

        vm.prank(supplier);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__InvalidStatus.selector,
            pid,
            PurchaseManager.PurchaseStatus.Delivered,
            PurchaseManager.PurchaseStatus.Open));
        purchaseManager.confirmDelivery(pid); // segunda tentativa deve falhar
    }

    function test_InstituicaoNaoPodeConfirmarRecebimentoDeCompraAindaAberta() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        // fornecedor ainda não confirmou entrega — status é Open

        vm.prank(institution);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__InvalidStatus.selector,
            pid,
            PurchaseManager.PurchaseStatus.Open,
            PurchaseManager.PurchaseStatus.Delivered));
        purchaseManager.confirmReceipt(pid);
    }

    // =========================================================================
    // submitImpactProof — caminhos de erro adicionais
    // =========================================================================

    function test_SomenteInstituicaoDoProjetoPodeEnviarComprovante() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier); purchaseManager.confirmDelivery(pid);
        vm.prank(institution); purchaseManager.confirmReceipt(pid);

        address estranho = makeAddr("estranho");
        vm.prank(estranho);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__OnlyInstitution.selector, pid, institution));
        purchaseManager.submitImpactProof(pid, keccak256("prova.jpg"));
    }

    function test_ComprovanteDeImpactoNaoPodeSerEnviadoDuasVezes() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier); purchaseManager.confirmDelivery(pid);
        vm.prank(institution); purchaseManager.confirmReceipt(pid);
        vm.prank(institution); purchaseManager.submitImpactProof(pid, keccak256("prova.jpg"));

        // status agora é Paid — o erro será InvalidStatus, não ProofAlreadySubmitted,
        // porque a função checa o status antes do hash
        vm.prank(institution);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__InvalidStatus.selector,
            pid,
            PurchaseManager.PurchaseStatus.Paid,
            PurchaseManager.PurchaseStatus.Confirmed));
        purchaseManager.submitImpactProof(pid, keccak256("prova2.jpg"));
    }

    // =========================================================================
    // openDispute — status inválido (nem Open nem Delivered)
    // =========================================================================

    function test_NaoPodeAbrirDisputaDeCompraNaoExistente() public {
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__PurchaseNotFound.selector, 999));
        purchaseManager.openDispute(999);
    }

    // =========================================================================
    // addDisputeEvidence — caminhos de erro
    // =========================================================================

    function test_EvidenciaDeDisputaNaoPodeSerAdicionadaEmCompraNaoEmDisputa() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        // status é Open, não Disputed

        vm.prank(institution);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__InvalidStatus.selector,
            pid,
            PurchaseManager.PurchaseStatus.Open,
            PurchaseManager.PurchaseStatus.Disputed));
        purchaseManager.addDisputeEvidence(pid, keccak256("ev.pdf"));
    }

    function test_EvidenciaVaziaNaoPodeSerAdicionadaADisputa() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.warp(_prazoDeEntregaPadrao() + 1);
        _abrirDisputaEntregaExpirada(pid);

        vm.prank(institution);
        vm.expectRevert(PurchaseManager.PurchaseManager__EmptyProofHash.selector);
        purchaseManager.addDisputeEvidence(pid, bytes32(0));
    }

    function test_EvidenciaDeDisputaNaoPodeSerAdicionadaPorTerceiros() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.warp(_prazoDeEntregaPadrao() + 1);
        _abrirDisputaEntregaExpirada(pid);

        address terceiro = makeAddr("terceiro");
        vm.prank(terceiro);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__OnlyParty.selector, pid));
        purchaseManager.addDisputeEvidence(pid, keccak256("ev.pdf"));
    }

    // =========================================================================
    // voteOnDispute e finalizeDispute — status inválido
    // =========================================================================

    function test_VotoDeDisputaNaoPodeSerfeitoEmCompraNaoEmDisputa() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));

        vm.prank(donor1);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__InvalidStatus.selector,
            pid,
            PurchaseManager.PurchaseStatus.Open,
            PurchaseManager.PurchaseStatus.Disputed));
        purchaseManager.voteOnDispute(pid, true);
    }

    function test_DisputaNaoPodeSerFinalizadaEmCompraNaoEmDisputa() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));

        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__InvalidStatus.selector,
            pid,
            PurchaseManager.PurchaseStatus.Open,
            PurchaseManager.PurchaseStatus.Disputed));
        purchaseManager.finalizeDispute(pid);
    }

    // =========================================================================
    // finalizeDispute — NotFinalizable antes de quórum e antes de prazo
    // =========================================================================

    function test_FinalizarDisputaAntesDeQuorumEAntesDeDeadlineEhRejeitado() public {
        // Novo conjunto de contratos com quórum de disputa alto
        // (com quórum=0 do setUp, totalVotes>=0 sempre true → nunca NotFinalizable)
        uint256 nonce2 = vm.getNonce(address(this));
        address govAddr2 = vm.computeCreateAddress(address(this), nonce2);
        address regAddr2 = vm.computeCreateAddress(address(this), nonce2 + 1);
        address trsAddr2 = vm.computeCreateAddress(address(this), nonce2 + 2);
        address pmAddr2  = vm.computeCreateAddress(address(this), nonce2 + 3);

        GovernanceDAO gov2       = new GovernanceDAO(operator, regAddr2, pmAddr2, trsAddr2, 0, 7 days);
        InstitutionRegistry reg2 = new InstitutionRegistry(govAddr2);
        Treasury trs2            = new Treasury(govAddr2, pmAddr2, regAddr2);
        PurchaseManager pm2      = new PurchaseManager(
            govAddr2, regAddr2, trsAddr2,
            999 ether, // quórum de disputa inalcançável
            7 days, 7 days
        );

        // registrar instituição e fornecedor via governance2
        vm.prank(address(gov2));
        reg2.register(institution, "ONG", "alimentos");
        vm.prank(address(gov2));
        pm2.approveSupplier(supplier, "Fornecedor", "servicos");

        // donor1 doa para ter poder de voto (só para preencher saldo)
        vm.prank(donor1);
        trs2.donate{ value: 10 ether }(institution);

        // institution abre compra
        vm.prank(institution);
        uint256 pid = pm2.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));

        // supplier confirma entrega, prazo de confirmação expira, disputa abre
        vm.prank(supplier);
        pm2.confirmDelivery(pid);
        vm.warp(block.timestamp + JANELA_CONFIRMACAO + 1);
        vm.prank(supplier);
        pm2.openDispute(pid);

        // nenhum voto → quórum (999 ETH) não atingido
        // prazo da disputa não encerrou (warpou só JANELA_CONFIRMACAO, não JANELA_DISPUTA)
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__NotFinalizable.selector, pid));
        pm2.finalizeDispute(pid);
    }

    // =========================================================================
    // Consulta — pedido inexistente
    // =========================================================================

    function test_ConsultaDePedidoInexistenteERejeitada() public {
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__PurchaseNotFound.selector, 999));
        purchaseManager.getPurchase(999);
    }

    // =========================================================================
    // Segurança — CEI impede pagamento duplo por reentrância
    // =========================================================================

    function test_ContratoBlockeaPagamentoDuploMesmoDuranteAtaqueDeReentrada() public {
        FornecedorMalicioso malicioso = new FornecedorMalicioso(purchaseManager);

        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        purchaseManager.approveSupplier(address(malicioso), "Evil Corp", "servicos");

        vm.prank(donor1);
        treasury.donate{ value: 10 ether }(institution);

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(address(malicioso), 1 ether, _prazoDeEntregaPadrao(), keccak256("servico"));
        malicioso.configurarPedido(pid);

        vm.prank(address(malicioso));
        purchaseManager.confirmDelivery(pid);

        vm.warp(block.timestamp + JANELA_CONFIRMACAO + 1);
        vm.prank(address(malicioso));
        purchaseManager.openDispute(pid);

        vm.prank(donor1);
        purchaseManager.voteOnDispute(pid, true); // vota pelo malicioso para acionar pagamento

        uint256 saldoAntes = address(malicioso).balance;
        purchaseManager.finalizeDispute(pid); // malicioso.receive() tenta re-entrada

        assertEq(address(malicioso).balance, saldoAntes + 1 ether); // apenas um pagamento
        assertEq(treasury.reservedBalance(institution), 0);
        assertEq(malicioso.tentativasDeReentrada(), 1); // re-entrada bloqueada pelo CEI
    }

    // =========================================================================
    // confirmReceiptAndSubmitProof — confirmação + prova em uma única transação
    // =========================================================================

    function test_ConfirmacaoEProvaEmUmaTransacaoLiberaPagamento() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier);
        purchaseManager.confirmDelivery(pid);

        bytes32 hash = keccak256("prova.jpg");
        uint256 saldoAntes = supplier.balance;

        vm.prank(institution);
        purchaseManager.confirmReceiptAndSubmitProof(pid, hash);

        assertEq(supplier.balance, saldoAntes + 1 ether);
        assertEq(uint256(purchaseManager.getPurchase(pid).status), uint256(PurchaseManager.PurchaseStatus.Paid));
        assertEq(purchaseManager.getPurchase(pid).impactProofHash, hash);
    }

    function test_ConfirmacaoEProvaEmiteTodosOsEventos() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier);
        purchaseManager.confirmDelivery(pid);

        bytes32 hash = keccak256("prova.jpg");

        vm.expectEmit(true, false, false, false);
        emit PurchaseManager.ReceiptConfirmed(pid);

        vm.expectEmit(true, true, false, false);
        emit PurchaseManager.ImpactProofSubmitted(pid, hash);

        vm.expectEmit(true, true, true, true);
        emit PurchaseManager.ImmutableReceipt(pid, institution, supplier, 1 ether, hash);

        vm.prank(institution);
        purchaseManager.confirmReceiptAndSubmitProof(pid, hash);
    }

    function test_RevertWhen_SomenteInstituicaoPodeChamarConfirmacaoEProva() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier);
        purchaseManager.confirmDelivery(pid);

        address impostor = makeAddr("impostor");
        vm.prank(impostor);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__OnlyInstitution.selector, pid, institution));
        purchaseManager.confirmReceiptAndSubmitProof(pid, keccak256("prova.jpg"));
    }

    function test_RevertWhen_ConfirmacaoEProvaRequerStatusDelivered() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        // fornecedor NÃO confirmou entrega — status é Open

        vm.prank(institution);
        vm.expectRevert(abi.encodeWithSelector(
            PurchaseManager.PurchaseManager__InvalidStatus.selector,
            pid,
            PurchaseManager.PurchaseStatus.Open,
            PurchaseManager.PurchaseStatus.Delivered));
        purchaseManager.confirmReceiptAndSubmitProof(pid, keccak256("prova.jpg"));
    }

    function test_RevertWhen_ConfirmacaoEProvaRejestaHashVazio() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier);
        purchaseManager.confirmDelivery(pid);

        vm.prank(institution);
        vm.expectRevert(PurchaseManager.PurchaseManager__EmptyProofHash.selector);
        purchaseManager.confirmReceiptAndSubmitProof(pid, bytes32(0));
    }

    function test_ConfirmacaoEProvaLiberaSaldoBloqueadoDaTesouraria() public {
        _prepararInstituicaoEFornecedor();

        vm.prank(institution);
        uint256 pid = purchaseManager.openPurchase(supplier, 1 ether, _prazoDeEntregaPadrao(), keccak256("compra"));
        vm.prank(supplier);
        purchaseManager.confirmDelivery(pid);

        assertEq(treasury.reservedBalance(institution), 1 ether);

        vm.prank(institution);
        purchaseManager.confirmReceiptAndSubmitProof(pid, keccak256("prova.jpg"));

        assertEq(treasury.reservedBalance(institution), 0);
    }
}
