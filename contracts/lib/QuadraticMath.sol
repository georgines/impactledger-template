// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title QuadraticMath
/// @notice Biblioteca stateless para cálculo de raiz quadrada inteira (floor sqrt).
///         Usada pelo Treasury ao recalcular cachedVotingWeight a cada doação,
///         e pelo GovernanceDAO para verificar quórum.
/// @dev    Implementação via método babilônico (Newton). Resultado é sempre floor(sqrt(x)).
library QuadraticMath {
    /// @notice Calcula floor(sqrt(x)) usando o método babilônico.
    /// @param  x Valor de entrada (totalDonated do doador, em wei).
    /// @return y Raiz quadrada inteira de x.
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        // x in [1,3] → floor(sqrt) = 1. Guard evita overflow: (x>>1)+1=2 para x=2,
        // mas enquanto y=2 o loop travaria sem convergir para 1.
        if (x < 4) return 1;
        y = x;
        uint256 z = (x >> 1) + 1; // seguro: x >= 4, então x>>1 < x, sem overflow
        while (z < y) {
            y = z;
            z = (x / z + z) >> 1;
        }
    }
}
