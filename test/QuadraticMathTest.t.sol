// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { QuadraticMath } from "../contracts/lib/QuadraticMath.sol";

contract QuadraticMathTest is Test {
    using QuadraticMath for uint256;

    function test_RaizDeZeroEZero() public pure { assertEq(uint256(0).sqrt(), 0); }
    function test_RaizDeQuatroEDois() public pure { assertEq(uint256(4).sqrt(), 2); }
    function test_RaizDeDezArredondaParaBaixoParaTres() public pure { assertEq(uint256(10).sqrt(), 3); }

    function testFuzz_PesoDeVotoNuncaUltrapassaRaizQuadratica(uint256 x) public pure {
        uint256 s = x.sqrt();
        assertLe(s * s, x);
        if (s < type(uint128).max) assertGt((s + 1) * (s + 1), x);
    }
}
