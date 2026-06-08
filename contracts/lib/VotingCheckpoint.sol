// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title VotingCheckpoint
/// @notice Rastreio de peso de voto por bloco via checkpoints com busca binária.
///         Proteção anti-flash-loan: peso lido no bloco do snapshot, não no atual.
library VotingCheckpoint {

    struct Checkpoint {
        uint256 blockNumber;
        uint256 weight;
    }

    /// @notice Grava checkpoint do peso no bloco corrente.
    ///         Se já existe checkpoint no mesmo bloco, atualiza no lugar (O(1)).
    function push(Checkpoint[] storage ckpts, uint256 weight) internal {
        uint256 len = ckpts.length;
        if (len > 0 && ckpts[len - 1].blockNumber == block.number) {
            ckpts[len - 1].weight = weight;
        } else {
            ckpts.push(Checkpoint({ blockNumber: block.number, weight: weight }));
        }
    }

    /// @notice Retorna o peso no checkpoint mais recente com blockNumber <= `blockNum`.
    ///         Busca binária: O(log n).
    function weightAt(Checkpoint[] storage ckpts, uint256 blockNum)
        internal view returns (uint256)
    {
        uint256 len = ckpts.length;
        if (len == 0) return 0;
        if (ckpts[0].blockNumber > blockNum) return 0;
        if (ckpts[len - 1].blockNumber <= blockNum) return ckpts[len - 1].weight;

        uint256 low  = 0;
        uint256 high = len - 1;
        while (low < high) {
            uint256 mid = (low + high + 1) / 2;
            if (ckpts[mid].blockNumber <= blockNum) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        return ckpts[low].weight;
    }
}
