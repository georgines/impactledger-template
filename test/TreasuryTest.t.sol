// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { QuadraticMath }       from "../contracts/lib/QuadraticMath.sol";
import { InstitutionRegistry } from "../contracts/InstitutionRegistry.sol";
import { Treasury }            from "../contracts/Treasury.sol";
import { PurchaseManager }     from "../contracts/PurchaseManager.sol";
import { GovernanceDAO }       from "../contracts/GovernanceDAO.sol";

contract TreasuryTest is Test {
    using QuadraticMath for uint256;

    address operator    = makeAddr("operator");
    address institution = makeAddr("institution");
    address donor1      = makeAddr("donor1");
    address donor2      = makeAddr("donor2");

    GovernanceDAO       governance;
    InstitutionRegistry registry;
    Treasury            treasury;
    PurchaseManager     purchaseManager;

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
        vm.deal(donor2, 100 ether);
    }

    // =========================================================================
    // UC-03 — Doação aceita ou rejeitada conforme estado da instituição
    // =========================================================================

    function test_DoacaoParaInstituicaoAtivaEAceita() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);
        assertEq(treasury.availableBalance(institution), 1 ether);
    }

    function test_DoacaoParaInstituicaoPausadaERejeitada() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        registry.pause(institution);

        vm.prank(donor1);
        vm.expectRevert(abi.encodeWithSelector(
            Treasury.Treasury__InstitutionNotActive.selector, institution));
        treasury.donate{ value: 1 ether }(institution);
    }

    function test_DoacaoParaInstituicaoRemovidaERejeitada() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        registry.remove(institution);

        vm.prank(donor1);
        vm.expectRevert(abi.encodeWithSelector(
            Treasury.Treasury__InstitutionNotActive.selector, institution));
        treasury.donate{ value: 1 ether }(institution);
    }

    function test_DoacaoParaInstituicaoNaoCadastradaERejeitada() public {
        vm.prank(donor1);
        vm.expectRevert(abi.encodeWithSelector(
            Treasury.Treasury__InstitutionNotActive.selector, institution));
        treasury.donate{ value: 1 ether }(institution);
    }

    function test_DoacaoComValorZeroERejeitada() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(donor1);
        vm.expectRevert(Treasury.Treasury__ZeroAmount.selector);
        treasury.donate{ value: 0 }(institution);
    }

    // =========================================================================
    // Peso de voto — registrado por bloco para proteger contra manipulação
    // =========================================================================

    function test_PesoDeVotoRegistradoNoBlocoCorreto() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(donor1);
        treasury.donate{ value: 4 ether }(institution);
        uint256 blocoDoSnapshot = block.number;

        uint256 peso = treasury.votingWeightAtBlock(donor1, blocoDoSnapshot);
        assertEq(peso, uint256(4 ether).sqrt());
    }

    function test_PesoDeVotoAnteriorAoSnapshotERetornado() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.roll(10);
        vm.prank(donor1);
        treasury.donate{ value: 9 ether }(institution);

        uint256 peso = treasury.votingWeightAtBlock(donor1, 50);
        assertEq(peso, uint256(9 ether).sqrt());
    }

    function test_DoacaoAposSnapshotNaoAlteraHistoricoDeVotos() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.roll(10);
        vm.prank(donor1);
        treasury.donate{ value: 4 ether }(institution);

        uint256 blocoDoSnapshot = 10;

        vm.roll(20);
        vm.prank(donor1);
        treasury.donate{ value: 96 ether }(institution); // doação posterior não vale retroativamente

        uint256 pesoNoSnapshot = treasury.votingWeightAtBlock(donor1, blocoDoSnapshot);
        assertEq(pesoNoSnapshot, uint256(4 ether).sqrt());

        uint256 pesoAtual = treasury.currentVotingWeight(donor1);
        assertGt(pesoAtual, pesoNoSnapshot);
    }

    function test_DoadorSemDoacoesTemPesoDeVotoZero() public view {
        uint256 peso = treasury.votingWeightAtBlock(donor1, block.number);
        assertEq(peso, 0);
    }

    function test_PesoDeVotoAcumulaComMultiplasDoacoes() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);
        uint256 pesoInicial = treasury.currentVotingWeight(donor1);

        vm.prank(donor1);
        treasury.donate{ value: 3 ether }(institution); // total = 4 ether
        uint256 pesoFinal = treasury.currentVotingWeight(donor1);

        assertGt(pesoFinal, pesoInicial);
        assertEq(pesoFinal, uint256(4 ether).sqrt());
    }

    // =========================================================================
    // Votação quadrática — peso acumulado em múltiplas doações
    // =========================================================================

    function test_DoadorComMultiplasDoacoesTemPesoBaseadoNoTotalAcumulado() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        // primeira doação: 1 ETH → totalDonated = 1e18 → peso = sqrt(1e18) = 1e9
        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);
        assertEq(treasury.currentVotingWeight(donor1), uint256(1 ether).sqrt());

        // segunda doação: 3 ETH → totalDonated = 4e18 → peso = sqrt(4e18) = 2e9
        vm.prank(donor1);
        treasury.donate{ value: 3 ether }(institution);
        assertEq(treasury.currentVotingWeight(donor1), uint256(4 ether).sqrt());

        // peso = sqrt(total acumulado) — MENOR que somar sqrt de cada doação isolada
        // isso é a propriedade anti-baleia da votação quadrática
        assertLt(
            treasury.currentVotingWeight(donor1),
            uint256(1 ether).sqrt() + uint256(3 ether).sqrt()
        );
    }

    // =========================================================================
    // UC-13 — seize captura availableBalance + reservedBalance simultaneamente
    // =========================================================================

    function test_SeizeCapturaSaldoDisponivelEReservadoAoMesmoTempo() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(donor1);
        treasury.donate{ value: 10 ether }(institution);

        // simular reserva de purchase aberta (3 ETH reservados)
        vm.prank(address(purchaseManager));
        treasury.reserve(institution, 1, 3 ether);

        assertEq(treasury.availableBalance(institution), 7 ether);
        assertEq(treasury.reservedBalance(institution), 3 ether);

        // seize deve capturar available + reserved
        vm.prank(address(governance));
        treasury.seizeToVault(institution);

        assertEq(treasury.availableBalance(institution), 0);
        assertEq(treasury.reservedBalance(institution), 0);
        assertEq(treasury.centralVault(), 10 ether);
    }

    // =========================================================================
    // UC-13 — Saldo apreendido para o Cofre Central ao remover instituição
    // =========================================================================

    function test_SaldoDaInstituicaoRemovidaVaiParaCofreCentral() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 5 ether }(institution);

        vm.prank(address(governance));
        treasury.seizeToVault(institution);

        assertEq(treasury.availableBalance(institution), 0);
        assertEq(treasury.centralVault(), 5 ether);
    }

    // =========================================================================
    // Pagamento — validações de transferência
    // =========================================================================

    function test_PagamentoParaEnderecoZeroERejeitado() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 5 ether }(institution);

        vm.prank(address(purchaseManager));
        treasury.reserve(institution, 1, 1 ether);

        vm.prank(address(purchaseManager));
        vm.expectRevert(Treasury.Treasury__ZeroAddress.selector);
        treasury.release(institution, address(0), 1, 1 ether);
    }

    function test_FalhaDeTransferenciaEtherERejeitada() public {
        ReceptorQueRecusa rejeitor = new ReceptorQueRecusa();

        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 5 ether }(institution);

        vm.prank(address(purchaseManager));
        treasury.reserve(institution, 1, 1 ether);

        vm.prank(address(purchaseManager));
        vm.expectRevert(Treasury.Treasury__TransferFailed.selector);
        treasury.release(institution, address(rejeitor), 1, 1 ether);
    }

    // =========================================================================
    // Construtor — validação de endereços
    // =========================================================================

    function test_ContratoNaoInicializaComGovernancaEnderecoZero() public {
        vm.expectRevert(Treasury.Treasury__ZeroAddress.selector);
        new Treasury(address(0), address(purchaseManager), address(registry));
    }

    function test_ContratoNaoInicializaComGerenciadorDeComprasEnderecoZero() public {
        vm.expectRevert(Treasury.Treasury__ZeroAddress.selector);
        new Treasury(address(governance), address(0), address(registry));
    }

    function test_ContratoNaoInicializaComRegistroEnderecoZero() public {
        vm.expectRevert(Treasury.Treasury__ZeroAddress.selector);
        new Treasury(address(governance), address(purchaseManager), address(0));
    }

    // =========================================================================
    // Permissões — modificadores onlyGovernance e onlyPurchaseManager
    // =========================================================================

    function test_SomentePurchaseManagerPodeReservarSaldo() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 5 ether }(institution);

        vm.expectRevert(Treasury.Treasury__OnlyPurchaseManager.selector);
        treasury.reserve(institution, 1, 1 ether);
    }

    function test_SomentePurchaseManagerPodeLiberarPagamento() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 5 ether }(institution);
        vm.prank(address(purchaseManager));
        treasury.reserve(institution, 1, 1 ether);

        vm.expectRevert(Treasury.Treasury__OnlyPurchaseManager.selector);
        treasury.release(institution, donor2, 1, 1 ether);
    }

    function test_SomentePurchaseManagerPodeDevolverVerbas() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 5 ether }(institution);
        vm.prank(address(purchaseManager));
        treasury.reserve(institution, 1, 1 ether);

        vm.expectRevert(Treasury.Treasury__OnlyPurchaseManager.selector);
        treasury.returnFunds(institution, 1, 1 ether);
    }

    function test_SomenteGovernancaPodeApreenderSaldo() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 5 ether }(institution);

        vm.expectRevert(Treasury.Treasury__OnlyGovernance.selector);
        treasury.seizeToVault(institution);
    }

    // =========================================================================
    // Doação — validação de endereço da instituição
    // =========================================================================

    function test_DoacaoParaEnderecoZeroERejeitada() public {
        vm.prank(donor1);
        vm.expectRevert(Treasury.Treasury__ZeroAddress.selector);
        treasury.donate{ value: 1 ether }(address(0));
    }

    // =========================================================================
    // Reserve — caminhos de erro
    // =========================================================================

    function test_ReservaComValorZeroERejeitada() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 5 ether }(institution);

        vm.prank(address(purchaseManager));
        vm.expectRevert(Treasury.Treasury__ZeroAmount.selector);
        treasury.reserve(institution, 1, 0);
    }

    function test_ReservaComSaldoInsuficienteERejeitada() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);

        vm.prank(address(purchaseManager));
        vm.expectRevert(abi.encodeWithSelector(
            Treasury.Treasury__InsufficientBalance.selector, institution, 1 ether, 5 ether));
        treasury.reserve(institution, 1, 5 ether);
    }

    // =========================================================================
    // Release — caminhos de erro
    // =========================================================================

    function test_LiberacaoComValorZeroERejeitada() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 5 ether }(institution);
        vm.prank(address(purchaseManager));
        treasury.reserve(institution, 1, 1 ether);

        vm.prank(address(purchaseManager));
        vm.expectRevert(Treasury.Treasury__ZeroAmount.selector);
        treasury.release(institution, donor2, 1, 0);
    }

    function test_LiberacaoComReservadoInsuficienteERejeitada() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 5 ether }(institution);
        vm.prank(address(purchaseManager));
        treasury.reserve(institution, 1, 1 ether);

        vm.prank(address(purchaseManager));
        vm.expectRevert(abi.encodeWithSelector(
            Treasury.Treasury__InsufficientReserved.selector, institution, 1 ether, 3 ether));
        treasury.release(institution, donor2, 1, 3 ether);
    }

    // =========================================================================
    // ReturnFunds — caminhos de erro
    // =========================================================================

    function test_DevolucaoComValorZeroERejeitada() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 5 ether }(institution);
        vm.prank(address(purchaseManager));
        treasury.reserve(institution, 1, 1 ether);

        vm.prank(address(purchaseManager));
        vm.expectRevert(Treasury.Treasury__ZeroAmount.selector);
        treasury.returnFunds(institution, 1, 0);
    }

    function test_DevolucaoComReservadoInsuficienteERejeitada() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 5 ether }(institution);
        vm.prank(address(purchaseManager));
        treasury.reserve(institution, 1, 1 ether);

        vm.prank(address(purchaseManager));
        vm.expectRevert(abi.encodeWithSelector(
            Treasury.Treasury__InsufficientReserved.selector, institution, 1 ether, 3 ether));
        treasury.returnFunds(institution, 1, 3 ether);
    }
}

/// @dev Contrato que rejeita qualquer transferência de ETH.
contract ReceptorQueRecusa {
    receive() external payable {
        revert();
    }
}
