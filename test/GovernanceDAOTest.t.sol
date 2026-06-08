// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { QuadraticMath }       from "../contracts/lib/QuadraticMath.sol";
import { InstitutionRegistry } from "../contracts/InstitutionRegistry.sol";
import { Treasury }            from "../contracts/Treasury.sol";
import { PurchaseManager }     from "../contracts/PurchaseManager.sol";
import { GovernanceDAO }       from "../contracts/GovernanceDAO.sol";

contract GovernanceDAOTest is Test {
    using QuadraticMath for uint256;

    address operator    = makeAddr("operator");
    address institution = makeAddr("institution");
    address donor1      = makeAddr("donor1");

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
    }

    // =========================================================================
    // UC-01 + UC-02 — Ciclo completo: proposta → voto → execução automática
    // =========================================================================

    function test_CicloCompletoDeGovernanca_PropostaVotoExecucao() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.roll(5);
        vm.prank(donor1);
        treasury.donate{ value: 9 ether }(institution);

        vm.roll(10);
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        GovernanceDAO.Proposal memory p = governance.getProposal(propId);
        uint256 pesoDeVoto = treasury.votingWeightAtBlock(donor1, p.snapshotBlock);
        assertEq(pesoDeVoto, uint256(9 ether).sqrt());

        vm.prank(donor1);
        governance.vote(propId, true);

        // prazo obrigatório → avança no tempo
        vm.warp(block.timestamp + 7 days + 1);

        // prazo expirou + yesWeight > noWeight + quórum → executa
        governance.finalize(propId, "", "");

        assertEq(uint256(registry.statusOf(institution)),
            uint256(InstitutionRegistry.Status.Paused));
        assertEq(uint256(governance.getProposal(propId).status),
            uint256(GovernanceDAO.ProposalStatus.Executed));
    }

    // =========================================================================
    // UC-02 — Proposta rejeitada quando quórum não é atingido no prazo
    // =========================================================================

    function test_PropostaRejeitadaQuandoQuorumNaoAtingidoNoPrazo() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);

        GovernanceDAO govAltoQuorum = new GovernanceDAO(
            operator, address(registry), address(purchaseManager), address(treasury), 999999 ether, 7 days
        );

        vm.prank(operator);
        uint256 propId = govAltoQuorum.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.warp(block.timestamp + 7 days + 1);
        govAltoQuorum.finalize(propId, "", "");

        assertEq(uint256(govAltoQuorum.getProposal(propId).status),
            uint256(GovernanceDAO.ProposalStatus.Rejected));
    }

    // =========================================================================
    // UC-09 — Governança aprova nova instituição com verificação de nome
    // =========================================================================

    function test_NomeDaInstituicaoSalvoApenasNoEventoNaoNoContrato() public {
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.ApproveInstitution,
            institution,
            "ONG Solar",
            "educacao"
        );

        GovernanceDAO.Proposal memory p = governance.getProposal(propId);
        assertNotEq(p.nameMetadataHash, bytes32(0));
    }

    function test_AprovacaoDeInstituicaoComNomeCorretoRegistraNaPlataforma() public {
        // registra uma instituição bootstrap para donor1 obter peso de voto
        address bootstrapInst = makeAddr("bootstrapInst");
        vm.prank(operator);
        governance.bootstrapRegister(bootstrapInst, "Bootstrap", "bootstrap");

        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(bootstrapInst);

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.ApproveInstitution,
            institution,
            "ONG Solar",
            "educacao"
        );

        vm.prank(donor1);
        governance.vote(propId, true);

        vm.warp(block.timestamp + 7 days + 1);
        governance.finalize(propId, "ONG Solar", "educacao");

        assertEq(uint256(registry.statusOf(institution)),
            uint256(InstitutionRegistry.Status.Active));
    }

    function test_ExecucaoDeAprovacaoComNomeTrocadoERejeitada() public {
        // registra uma instituição bootstrap para donor1 obter peso de voto
        address bootstrapInst = makeAddr("bootstrapInst");
        vm.prank(operator);
        governance.bootstrapRegister(bootstrapInst, "Bootstrap", "bootstrap");

        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(bootstrapInst);

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.ApproveInstitution,
            institution,
            "ONG Solar",
            "educacao"
        );

        vm.prank(donor1);
        governance.vote(propId, true);

        vm.warp(block.timestamp + 7 days + 1);

        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__InvalidNameMetadata.selector, propId));
        governance.finalize(propId, "Nome Errado", "area_errada");
    }

    function test_PropostaDePausaNaoExigeNomeDaInstituicao() public {
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        GovernanceDAO.Proposal memory p = governance.getProposal(propId);
        assertEq(p.nameMetadataHash, bytes32(0));
    }

    // =========================================================================
    // Período de votação configurável no deploy
    // =========================================================================

    function test_PeriodoDeVotacaoConfiguravelNoConstructor() public {
        GovernanceDAO gov2 = new GovernanceDAO(
            operator, address(registry), address(purchaseManager), address(treasury), 0, 5 days
        );
        assertEq(gov2.votingPeriod(), 5 days);
    }

    function test_PrazoDaPropostaRefletePeriodoDeVotacaoDefinidoNoDeploy() public {
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );
        GovernanceDAO.Proposal memory p = governance.getProposal(propId);
        assertEq(p.deadline, block.timestamp + 7 days);
    }

    // =========================================================================
    // Quórum mínimo configurado no contrato
    // =========================================================================

    function test_QuorumMinimoDefinidoNoDeployEstaAcessivel() public {
        GovernanceDAO gov2 = new GovernanceDAO(
            operator, address(registry), address(purchaseManager), address(treasury), 100 ether, 7 days
        );
        assertEq(gov2.minQuorum(), 100 ether);
    }

    function test_PropostaUsaMinQuorumDoContratoSemReceberQuorumComoParametro() public {
        GovernanceDAO gov2 = new GovernanceDAO(
            operator, address(registry), address(purchaseManager), address(treasury), 42 ether, 7 days
        );
        vm.prank(operator);
        uint256 propId = gov2.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );
        assertEq(gov2.getProposal(propId).quorum, 42 ether);
    }

    // =========================================================================
    // Erros de permissão e estado
    // =========================================================================

    function test_ConsultaDePropostaInexistenteERejeitada() public {
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__ProposalNotFound.selector, 999));
        governance.getProposal(999);
    }

    function test_SomenteOperadorPodeCriarProposta() public {
        vm.prank(donor1);
        vm.expectRevert(GovernanceDAO.GovernanceDAO__OnlyOperator.selector);
        governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );
    }

    function test_DoadorNaoPodeVotarDuasVezesNaMesmaProposta() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1);
        governance.vote(propId, true);

        vm.prank(donor1);
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__AlreadyVoted.selector, propId, donor1));
        governance.vote(propId, true);
    }

    function test_DoadorSemHistoricoDeDoacoesNaoPodeVotar() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1); // donor1 nunca doou
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__NoVotingPower.selector, donor1));
        governance.vote(propId, true);
    }

    function test_VotoAposEncerramentoDoPrazoERejeitado() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.warp(block.timestamp + 7 days + 1);

        vm.prank(donor1);
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__VotingEnded.selector, propId));
        governance.vote(propId, true);
    }

    function test_NaoPodeEncerrarPropostaSemQuorumEComPrazoAberto() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        GovernanceDAO govAltoQuorum = new GovernanceDAO(
            operator, address(registry), address(purchaseManager), address(treasury), 999 ether, 7 days
        );

        vm.prank(operator);
        uint256 propId = govAltoQuorum.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__NotFinalizable.selector, propId));
        govAltoQuorum.finalize(propId, "", "");
    }

    // =========================================================================
    // UC-10 — Governança aprova novo fornecedor
    // =========================================================================

    function test_GovernancaAdicionaFornecedorAprovadoNaWhitelist() public {
        address novoFornecedor = makeAddr("novoFornecedor");

        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.ApproveSupplier,
            novoFornecedor,
            "Fornecedor ABC",
            "logistica"
        );

        vm.prank(donor1);
        governance.vote(propId, true);

        vm.warp(block.timestamp + 7 days + 1);
        governance.finalize(propId, "Fornecedor ABC", "logistica");

        assertTrue(purchaseManager.approvedSuppliers(novoFornecedor));
    }

    // =========================================================================
    // UC-12 — Governança despausa instituição
    // =========================================================================

    function test_GovernancaReativaInstituicaoPausada() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        registry.pause(institution);

        assertEq(uint256(registry.statusOf(institution)),
            uint256(InstitutionRegistry.Status.Paused));

        // institution está pausada → treasury rejeita doação; usa bootstrap para dar poder de voto
        address bootstrapInst = makeAddr("bootstrapInst");
        vm.prank(operator);
        governance.bootstrapRegister(bootstrapInst, "Bootstrap", "bootstrap");

        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(bootstrapInst);

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.UnpauseInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1);
        governance.vote(propId, true);

        vm.warp(block.timestamp + 7 days + 1);
        governance.finalize(propId, "", "");

        assertEq(uint256(registry.statusOf(institution)),
            uint256(InstitutionRegistry.Status.Active));
    }

    // =========================================================================
    // Consulta de votos
    // =========================================================================

    function test_DoadorAparececomoNaoVotanteAntesDeVotar() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        assertFalse(governance.hasVoted(propId, donor1));
    }

    function test_DoadorAparececomoVotanteAposRegistrarVoto() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1);
        governance.vote(propId, true);

        assertTrue(governance.hasVoted(propId, donor1));
    }

    // =========================================================================
    // UC-13 — Governança remove instituição e transfere saldo ao cofre central
    // =========================================================================

    function test_GovernancaRemoveInstituicaoETransfereSaldoParaCofreCentral() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        address algumDoador = makeAddr("algumDoador");
        vm.deal(algumDoador, 10 ether);
        vm.prank(algumDoador);
        treasury.donate{ value: 5 ether }(institution);

        // donor1 vota para a proposta passar
        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.RemoveInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1);
        governance.vote(propId, true);

        vm.warp(block.timestamp + 7 days + 1);
        governance.finalize(propId, "", "");

        assertEq(uint256(registry.statusOf(institution)),
            uint256(InstitutionRegistry.Status.Removed));
        assertEq(treasury.availableBalance(institution), 0);
        assertEq(treasury.centralVault(), 6 ether); // 5 + 1 do donor1
    }

    // =========================================================================
    // UC-02 — vote(proposalId, bool support) — votar a favor ou contra
    // =========================================================================

    function test_VotoSuporte_AcumulaYesWeight() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 9 ether }(institution);

        vm.roll(10);
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1);
        governance.vote(propId, true);

        GovernanceDAO.Proposal memory p = governance.getProposal(propId);
        uint256 expectedWeight = uint256(9 ether).sqrt();
        assertEq(p.yesWeight, expectedWeight);
        assertEq(p.noWeight, 0);
    }

    function test_VotoContra_AcumulaNoWeight() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 9 ether }(institution);

        vm.roll(10);
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1);
        governance.vote(propId, false);

        GovernanceDAO.Proposal memory p = governance.getProposal(propId);
        uint256 expectedWeight = uint256(9 ether).sqrt();
        assertEq(p.noWeight, expectedWeight);
        assertEq(p.yesWeight, 0);
    }

    function test_VotoCast_EmiteEventoComSupport() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 4 ether }(institution);

        vm.roll(10);
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        uint256 expectedWeight = uint256(4 ether).sqrt();
        vm.expectEmit(true, true, false, true);
        emit GovernanceDAO.VoteCast(propId, donor1, true, expectedWeight);

        vm.prank(donor1);
        governance.vote(propId, true);
    }

    function test_QuorumEhSomaDePesosSIMeNAO() public {
        address donor2 = makeAddr("donor2");
        vm.deal(donor2, 100 ether);

        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(donor1);
        treasury.donate{ value: 4 ether }(institution);
        vm.prank(donor2);
        treasury.donate{ value: 9 ether }(institution);

        // quórum = sqrt(4e) + sqrt(9e) = 2 + 3 = 5
        GovernanceDAO govComQuorum = new GovernanceDAO(
            operator, address(registry), address(purchaseManager), address(treasury), 5, 7 days
        );

        vm.roll(10);
        vm.prank(operator);
        uint256 propId = govComQuorum.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1);
        govComQuorum.vote(propId, true); // yesWeight += sqrt(4e) = 2

        vm.prank(donor2);
        govComQuorum.vote(propId, false); // noWeight += sqrt(9e) = 3

        // quórum = yesWeight(2) + noWeight(3) = 5 → atingido
        // mas prazo não expirou → NotFinalizable ainda
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__NotFinalizable.selector, propId));
        govComQuorum.finalize(propId, "", "");
    }

    function test_AprovacaoSoDepoisDoPrazo_YesMaiorQueNo_ComQuorum() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 9 ether }(institution);

        vm.roll(10);
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1);
        governance.vote(propId, true);

        // prazo ainda não expirou → não deve finalizar antes
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__NotFinalizable.selector, propId));
        governance.finalize(propId, "", "");

        // agora expira o prazo
        vm.warp(block.timestamp + 7 days + 1);
        governance.finalize(propId, "", "");

        assertEq(uint256(governance.getProposal(propId).status),
            uint256(GovernanceDAO.ProposalStatus.Executed));
        assertEq(uint256(registry.statusOf(institution)),
            uint256(InstitutionRegistry.Status.Paused));
    }

    function test_RejeicaoQuandoNoPesoMaiorOuIgualYesPeso_MesmoComQuorum() public {
        address donor2 = makeAddr("donor2");
        vm.deal(donor2, 100 ether);

        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(donor1);
        treasury.donate{ value: 4 ether }(institution);
        vm.prank(donor2);
        treasury.donate{ value: 4 ether }(institution);

        // minQuorum = 0 → quórum sempre atingido com qualquer voto
        vm.roll(10);
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1);
        governance.vote(propId, false); // noWeight += sqrt(4e)

        vm.prank(donor2);
        governance.vote(propId, false); // noWeight += sqrt(4e) — noWeight > yesWeight

        vm.warp(block.timestamp + 7 days + 1);
        governance.finalize(propId, "", "");

        assertEq(uint256(governance.getProposal(propId).status),
            uint256(GovernanceDAO.ProposalStatus.Rejected));
    }

    function test_RejeicaoQuandoNoPesoIgualAoYesPeso() public {
        address donor2 = makeAddr("donor2");
        vm.deal(donor2, 100 ether);

        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(donor1);
        treasury.donate{ value: 4 ether }(institution);
        vm.prank(donor2);
        treasury.donate{ value: 4 ether }(institution);

        vm.roll(10);
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1);
        governance.vote(propId, true); // yesWeight = sqrt(4e)

        vm.prank(donor2);
        governance.vote(propId, false); // noWeight = sqrt(4e) — empate → rejeição

        vm.warp(block.timestamp + 7 days + 1);
        governance.finalize(propId, "", "");

        assertEq(uint256(governance.getProposal(propId).status),
            uint256(GovernanceDAO.ProposalStatus.Rejected));
    }

    function test_RejeicaoQuandoQuorumNaoAtingidoMesmoComYesMaior() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);

        // alto quórum
        GovernanceDAO govAltoQuorum = new GovernanceDAO(
            operator, address(registry), address(purchaseManager), address(treasury), 999999 ether, 7 days
        );

        vm.roll(10);
        vm.prank(operator);
        uint256 propId = govAltoQuorum.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1);
        govAltoQuorum.vote(propId, true); // yesWeight > noWeight mas quórum não atingido

        vm.warp(block.timestamp + 7 days + 1);
        govAltoQuorum.finalize(propId, "", "");

        assertEq(uint256(govAltoQuorum.getProposal(propId).status),
            uint256(GovernanceDAO.ProposalStatus.Rejected));
    }

    function test_SemFinalizacaoAntecipada_PrazoObrigatorio() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 9 ether }(institution);

        // minQuorum = 0 → qualquer peso já atingiria quórum, mas prazo é obrigatório
        vm.roll(10);
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1);
        governance.vote(propId, true);

        // mesmo com minQuorum=0, não pode finalizar antes do prazo
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__NotFinalizable.selector, propId));
        governance.finalize(propId, "", "");
    }

    function test_VotoDuplo_AindaRejeitado_MesmoComNovaAssinatura() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1);
        governance.vote(propId, true);

        vm.prank(donor1);
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__AlreadyVoted.selector, propId, donor1));
        governance.vote(propId, false);
    }

    function test_PropostaArmazenaNoWeight() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        GovernanceDAO.Proposal memory p = governance.getProposal(propId);
        // noWeight existe no struct e inicia em 0
        assertEq(p.noWeight, 0);
        assertEq(p.yesWeight, 0);
    }

    // =========================================================================
    // bootstrapRegister — UC-bootstrap: registro inicial sem votação
    // =========================================================================

    /// @dev bootstrapped() retorna false antes de qualquer chamada.
    function test_Bootstrapped_RetornaFalseAntesDoChamado() public view {
        assertFalse(governance.bootstrapped());
    }

    /// @dev bootstrapped() retorna true após bootstrapRegister bem-sucedido.
    function test_Bootstrapped_RetornaTrueAposRegistroInicial() public {
        vm.prank(operator);
        governance.bootstrapRegister(institution, "ONG Bootstrap", "saude");

        assertTrue(governance.bootstrapped());
    }

    /// @dev Operador chama bootstrapRegister → instituição fica ativa no registry.
    function test_BootstrapRegister_RegistraInstituicaoComSucesso() public {
        vm.prank(operator);
        governance.bootstrapRegister(institution, "ONG Bootstrap", "saude");

        assertEq(
            uint256(registry.statusOf(institution)),
            uint256(InstitutionRegistry.Status.Active)
        );
    }

    /// @dev Segunda chamada ao bootstrapRegister reverte com AlreadyBootstrapped.
    function test_RevertWhen_BootstrapChamadoSegundaVez() public {
        vm.prank(operator);
        governance.bootstrapRegister(institution, "ONG Bootstrap", "saude");

        address outraInstituicao = makeAddr("outraInstituicao");
        vm.prank(operator);
        vm.expectRevert(GovernanceDAO.GovernanceDAO__AlreadyBootstrapped.selector);
        governance.bootstrapRegister(outraInstituicao, "ONG 2", "educacao");
    }

    /// @dev Não-operador não pode chamar bootstrapRegister — reverte OnlyOperator.
    function test_RevertWhen_NaoOperadorChamaBootstrap() public {
        address naoOperador = makeAddr("naoOperador");
        vm.prank(naoOperador);
        vm.expectRevert(GovernanceDAO.GovernanceDAO__OnlyOperator.selector);
        governance.bootstrapRegister(institution, "ONG Bootstrap", "saude");
    }

    // =========================================================================
    // Construtor — validação de endereços (branches não operador)
    // =========================================================================

    function test_RevertWhen_DeployGovernanceComRegistryEnderecoZero() public {
        vm.expectRevert(GovernanceDAO.GovernanceDAO__ZeroAddress.selector);
        new GovernanceDAO(operator, address(0), address(purchaseManager), address(treasury), 0, 7 days);
    }

    function test_RevertWhen_DeployGovernanceComGerenciadorDeComprasEnderecoZero() public {
        vm.expectRevert(GovernanceDAO.GovernanceDAO__ZeroAddress.selector);
        new GovernanceDAO(operator, address(registry), address(0), address(treasury), 0, 7 days);
    }

    function test_RevertWhen_DeployGovernanceComTesourariaEnderecoZero() public {
        vm.expectRevert(GovernanceDAO.GovernanceDAO__ZeroAddress.selector);
        new GovernanceDAO(operator, address(registry), address(purchaseManager), address(0), 0, 7 days);
    }

    // =========================================================================
    // UC-02 — vote em proposta já finalizada reverte com NotActive
    // =========================================================================

    function test_VotoEmPropostaJaExecutadaEhRejeitadoComNotActive() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");

        // dois doadores obtêm poder de voto antes da proposta
        address donor2 = makeAddr("donor2");
        vm.deal(donor2, 10 ether);
        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);
        vm.prank(donor2);
        treasury.donate{ value: 1 ether }(institution);

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        // donor1 vota → quórum atingido com minQuorum=0
        vm.prank(donor1);
        governance.vote(propId, true);

        // prazo expira → proposta executada
        vm.warp(block.timestamp + 7 days + 1);
        governance.finalize(propId, "", "");

        assertEq(
            uint256(governance.getProposal(propId).status),
            uint256(GovernanceDAO.ProposalStatus.Executed)
        );

        // donor2 ainda não votou, mas proposta já foi executada
        vm.prank(donor2);
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__NotActive.selector, propId));
        governance.vote(propId, true);
    }

    function test_VotoEmPropostaJaRejeitadaEhRejeitadoComNotActive() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);

        // quórum impossível de atingir
        GovernanceDAO govAltoQuorum = new GovernanceDAO(
            operator, address(registry), address(purchaseManager), address(treasury), 999999 ether, 7 days
        );

        vm.prank(operator);
        uint256 propId = govAltoQuorum.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        // prazo expira sem quórum → Rejected
        vm.warp(block.timestamp + 7 days + 1);
        govAltoQuorum.finalize(propId, "", "");

        assertEq(
            uint256(govAltoQuorum.getProposal(propId).status),
            uint256(GovernanceDAO.ProposalStatus.Rejected)
        );

        // donor1 tenta votar em proposta já rejeitada
        vm.prank(donor1);
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__NotActive.selector, propId));
        govAltoQuorum.vote(propId, true);
    }

    // =========================================================================
    // finalize em proposta já finalizada reverte com NotActive
    // =========================================================================

    function test_FinalizarPropostaJaExecutadaDuasVezesEhRejeitado() public {
        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(donor1);
        treasury.donate{ value: 1 ether }(institution);

        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.PauseInstitution,
            institution,
            "",
            ""
        );

        vm.prank(donor1);
        governance.vote(propId, true);

        vm.warp(block.timestamp + 7 days + 1);
        governance.finalize(propId, "", ""); // primeira chamada → Executed

        // segunda chamada na mesma proposta
        vm.expectRevert(abi.encodeWithSelector(
            GovernanceDAO.GovernanceDAO__NotActive.selector, propId));
        governance.finalize(propId, "", "");
    }

    // =========================================================================
    // UC-13 — seize captura availableBalance + reservedBalance simultaneamente
    // =========================================================================

    function test_SeizeCapturaSaldoDisponivelEReservadoQuandoHaCompraAberta() public {
        address fornecedor = makeAddr("fornecedor");

        vm.prank(address(governance));
        registry.register(institution, "ONG", "alimentos");
        vm.prank(address(governance));
        purchaseManager.approveSupplier(fornecedor, "Fornecedor", "servicos");

        // donor1 doa 10 ETH → availableBalance = 10
        vm.prank(donor1);
        treasury.donate{ value: 10 ether }(institution);

        // institution abre compra de 3 ETH → reservedBalance = 3, availableBalance = 7
        vm.prank(institution);
        purchaseManager.openPurchase(
            fornecedor, 3 ether, block.timestamp + 14 days, keccak256("material")
        );

        assertEq(treasury.availableBalance(institution), 7 ether);
        assertEq(treasury.reservedBalance(institution), 3 ether);

        // governança remove a instituição → seize deve capturar 7 + 3 = 10
        vm.prank(address(governance));
        registry.remove(institution);
        vm.prank(address(governance));
        treasury.seizeToVault(institution);

        assertEq(treasury.availableBalance(institution), 0);
        assertEq(treasury.reservedBalance(institution), 0);
        assertEq(treasury.centralVault(), 10 ether);
    }

    // =========================================================================
    // UC-13 — cofre central acumula saldo de múltiplas remoções
    // =========================================================================

    function test_CofreCentralAcumulaDuasRemocoesSeparadas() public {
        address institution2 = makeAddr("institution2");
        address donor2 = makeAddr("donor2");
        vm.deal(donor2, 100 ether);

        // registrar duas instituições
        vm.prank(address(governance));
        registry.register(institution, "ONG A", "alimentos");
        vm.prank(address(governance));
        registry.register(institution2, "ONG B", "saude");

        // doações para cada uma
        vm.prank(donor1);
        treasury.donate{ value: 4 ether }(institution);
        vm.prank(donor2);
        treasury.donate{ value: 6 ether }(institution2);

        // remover primeira → cofre = 4
        vm.prank(address(governance));
        registry.remove(institution);
        vm.prank(address(governance));
        treasury.seizeToVault(institution);

        assertEq(treasury.centralVault(), 4 ether);

        // remover segunda → cofre = 4 + 6 = 10
        vm.prank(address(governance));
        registry.remove(institution2);
        vm.prank(address(governance));
        treasury.seizeToVault(institution2);

        assertEq(treasury.centralVault(), 10 ether);
        assertEq(treasury.availableBalance(institution), 0);
        assertEq(treasury.availableBalance(institution2), 0);
    }

    /// @dev Após bootstrap, o ciclo normal de governança ainda funciona corretamente.
    function test_BootstrapNaoInterfereCicloNormal() public {
        // 1. bootstrap registra a primeira instituição
        vm.prank(operator);
        governance.bootstrapRegister(institution, "ONG Bootstrap", "saude");

        // 2. donor1 doa para ter poder de voto
        vm.prank(donor1);
        treasury.donate{ value: 9 ether }(institution);

        // 3. operador abre proposta de governança normal
        address novaInstituicao = makeAddr("novaInstituicao");
        vm.prank(operator);
        uint256 propId = governance.propose(
            GovernanceDAO.ProposalType.ApproveInstitution,
            novaInstituicao,
            "ONG Normal",
            "educacao"
        );

        // 4. donor1 vota
        vm.prank(donor1);
        governance.vote(propId, true);

        // 5. prazo expira e proposta é executada
        vm.warp(block.timestamp + 7 days + 1);
        governance.finalize(propId, "ONG Normal", "educacao");

        assertEq(
            uint256(governance.getProposal(propId).status),
            uint256(GovernanceDAO.ProposalStatus.Executed)
        );
        assertEq(
            uint256(registry.statusOf(novaInstituicao)),
            uint256(InstitutionRegistry.Status.Active)
        );
    }
}
