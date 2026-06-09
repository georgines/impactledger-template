// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ImpactNFT {

    struct ImpactRecord {
        string action;
        string participant;
        uint256 timestamp;
    }

    ImpactRecord[] public records;

    // Registra um novo impacto com ação, participante e timestamp do bloco atual.
    function registerImpact(
        string memory _action,
        string memory _participant
    ) public {

        records.push(
            ImpactRecord(
                _action,
                _participant,
                block.timestamp
            )
        );
    }

    // Retorna o total de registros de impacto armazenados no contrato.
    function totalRecords() public view returns(uint256) {
        return records.length;
    }
}
