// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { InstitutionRegistry } from "../contracts/InstitutionRegistry.sol";
import { Treasury }            from "../contracts/Treasury.sol";
import { PurchaseManager }     from "../contracts/PurchaseManager.sol";
import { GovernanceDAO }       from "../contracts/GovernanceDAO.sol";

contract InstitutionRegistryTest is Test {
    address operator    = makeAddr("operator");
    address institution = makeAddr("institution");

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
    }

    // =========================================================================
    // Controle de acesso — somente governança pode alterar estados
    // =========================================================================

    function test_SomenteGovernancaPodeRegistrarInstituicao() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(InstitutionRegistry.InstitutionRegistry__OnlyGovernance.selector);
        registry.register(institution, "ONG", "alimentos");
    }

    function test_SomenteGovernancaPodePausarInstituicao() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(makeAddr("random"));
        vm.expectRevert(InstitutionRegistry.InstitutionRegistry__OnlyGovernance.selector);
        registry.pause(institution);
    }

    function test_SomenteGovernancaPodeReativarInstituicao() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        registry.pause(institution);

        vm.prank(makeAddr("random"));
        vm.expectRevert(InstitutionRegistry.InstitutionRegistry__OnlyGovernance.selector);
        registry.unpause(institution);
    }

    function test_SomenteGovernancaPodeRemoverInstituicao() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(makeAddr("random"));
        vm.expectRevert(InstitutionRegistry.InstitutionRegistry__OnlyGovernance.selector);
        registry.remove(institution);
    }

    // =========================================================================
    // Cadastro de instituição
    // =========================================================================

    function test_InstituicaoAprovadaPelaGovernancaFicaAtiva() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        assertEq(uint256(registry.statusOf(institution)),
            uint256(InstitutionRegistry.Status.Active));
        assertTrue(registry.isActive(institution));
    }

    function test_NaoPodeRegistrarInstituicaoJaCadastrada() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(address(governance));
        vm.expectRevert(abi.encodeWithSelector(
            InstitutionRegistry.InstitutionRegistry__AlreadyRegistered.selector, institution));
        registry.register(institution, "ONG", "alimentos");
    }

    function test_NaoPodeRegistrarEnderecoZeroComoInstituicao() public {
        vm.prank(address(governance));
        vm.expectRevert(InstitutionRegistry.InstitutionRegistry__ZeroAddress.selector);
        registry.register(address(0), "ONG", "alimentos");
    }

    // =========================================================================
    // Pausa de instituição
    // =========================================================================

    function test_InstituicaoPausadaParaDeAceitarDoacoes() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        registry.pause(institution);

        assertEq(uint256(registry.statusOf(institution)),
            uint256(InstitutionRegistry.Status.Paused));
        assertFalse(registry.isActive(institution));
    }

    function test_NaoPodePausarInstituicaoNaoCadastrada() public {
        vm.prank(address(governance));
        vm.expectRevert(abi.encodeWithSelector(
            InstitutionRegistry.InstitutionRegistry__InvalidTransition.selector,
            InstitutionRegistry.Status.Inactive,
            InstitutionRegistry.Status.Paused));
        registry.pause(institution);
    }

    function test_NaoPodePausarInstituicaoJaPausada() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        registry.pause(institution);

        vm.prank(address(governance));
        vm.expectRevert(abi.encodeWithSelector(
            InstitutionRegistry.InstitutionRegistry__InvalidTransition.selector,
            InstitutionRegistry.Status.Paused,
            InstitutionRegistry.Status.Paused));
        registry.pause(institution);
    }

    // =========================================================================
    // Reativação de instituição
    // =========================================================================

    function test_InstituicaoPausadaVoltaAFuncionarAposReativacao() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        registry.pause(institution);
        vm.prank(address(governance));
        registry.unpause(institution);

        assertEq(uint256(registry.statusOf(institution)),
            uint256(InstitutionRegistry.Status.Active));
        assertTrue(registry.isActive(institution));
    }

    function test_NaoPodeReativarInstituicaoQueJaEstaAtiva() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(address(governance));
        vm.expectRevert(abi.encodeWithSelector(
            InstitutionRegistry.InstitutionRegistry__InvalidTransition.selector,
            InstitutionRegistry.Status.Active,
            InstitutionRegistry.Status.Active));
        registry.unpause(institution);
    }

    // =========================================================================
    // Remoção de instituição
    // =========================================================================

    function test_InstituicaoAtivaRemovidaParaDeOperar() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        registry.remove(institution);

        assertEq(uint256(registry.statusOf(institution)),
            uint256(InstitutionRegistry.Status.Removed));
        assertFalse(registry.isActive(institution));
    }

    function test_InstituicaoPausadaTambemPodeSerRemovida() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        registry.pause(institution);
        vm.prank(address(governance));
        registry.remove(institution);

        assertEq(uint256(registry.statusOf(institution)),
            uint256(InstitutionRegistry.Status.Removed));
    }

    function test_NaoPodeRemoverInstituicaoNaoCadastrada() public {
        vm.prank(address(governance));
        vm.expectRevert(abi.encodeWithSelector(
            InstitutionRegistry.InstitutionRegistry__InvalidTransition.selector,
            InstitutionRegistry.Status.Inactive,
            InstitutionRegistry.Status.Removed));
        registry.remove(institution);
    }

    function test_NaoPodeRemoverInstituicaoJaRemovida() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        registry.remove(institution);

        vm.prank(address(governance));
        vm.expectRevert(abi.encodeWithSelector(
            InstitutionRegistry.InstitutionRegistry__InvalidTransition.selector,
            InstitutionRegistry.Status.Removed,
            InstitutionRegistry.Status.Removed));
        registry.remove(institution);
    }

    // =========================================================================
    // Consulta de status
    // =========================================================================

    function test_InstituicaoNaoCadastradaNaoAparececomoAtiva() public view {
        assertFalse(registry.isActive(institution));
    }

    function test_InstituicaoRemovidaNaoAparececomoAtiva() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        registry.remove(institution);

        assertFalse(registry.isActive(institution));
    }

    // =========================================================================
    // isInstitution — detecção de papel para o frontend
    // =========================================================================

    function test_IsInstitution_RetornaTrueParaInstituicaoAtiva() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        assertTrue(registry.isInstitution(institution));
    }

    function test_IsInstitution_RetornaTrueParaInstituicaoPausada() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        registry.pause(institution);

        assertTrue(registry.isInstitution(institution));
    }

    function test_IsInstitution_RetornaFalseParaInstituicaoRemovida() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        registry.remove(institution);

        assertFalse(registry.isInstitution(institution));
    }

    function test_IsInstitution_RetornaFalseParaEnderecoNaoCadastrado() public view {
        assertFalse(registry.isInstitution(institution));
    }

    // =========================================================================
    // Construtor — validação de endereço de governança
    // =========================================================================

    function test_ContratoNaoInicializaComGovernancaEnderecoZero() public {
        vm.expectRevert(InstitutionRegistry.InstitutionRegistry__ZeroAddress.selector);
        new InstitutionRegistry(address(0));
    }
}
