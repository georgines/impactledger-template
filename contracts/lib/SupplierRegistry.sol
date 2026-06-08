// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SupplierRegistry
/// @notice Library que gerencia a whitelist de fornecedores aprovados pela DAO.
///         Implementada como library (não contrato separado) para eliminar o overhead
///         de CALL cross-contract (~2.100 gas) na verificação de whitelist, que ocorre
///         em toda solicitação de compra.
///
///         O storage da whitelist fica no contrato que usa esta library (PurchaseManager).
///         Apenas o GovernanceDAO pode escrever — verificado pelo PurchaseManager
///         antes de delegar para cá.
library SupplierRegistry {
    // -------------------------------------------------------------------------
    // Tipo de storage
    // -------------------------------------------------------------------------

    struct Registry {
        mapping(address => bool) isWhitelisted;
    }

    // -------------------------------------------------------------------------
    // Erros
    // -------------------------------------------------------------------------

    error SupplierRegistry__NotWhitelisted(address supplier);
    error SupplierRegistry__AlreadyWhitelisted(address supplier);
    error SupplierRegistry__ZeroAddress();

    // -------------------------------------------------------------------------
    // Eventos
    // -------------------------------------------------------------------------

    // name e serviceType emitidos apenas em evento — fora do storage para reduzir gas
    event SupplierApproved(address indexed supplier, string name, string serviceType);
    event SupplierRevoked(address indexed supplier);

    // -------------------------------------------------------------------------
    // Mutações
    // -------------------------------------------------------------------------

    /// @notice Aprova um fornecedor e o adiciona à whitelist.
    /// @param  self        Storage da registry.
    /// @param  supplier    Endereço do fornecedor.
    /// @param  name        Nome (apenas evento).
    /// @param  serviceType Tipo de serviço (apenas evento).
    function approve(
        Registry storage self,
        address supplier,
        string calldata name,
        string calldata serviceType
    ) internal {
        if (supplier == address(0)) revert SupplierRegistry__ZeroAddress();
        if (self.isWhitelisted[supplier]) revert SupplierRegistry__AlreadyWhitelisted(supplier);

        self.isWhitelisted[supplier] = true;
        emit SupplierApproved(supplier, name, serviceType);
    }

    /// @notice Remove um fornecedor da whitelist.
    function revoke(Registry storage self, address supplier) internal {
        if (!self.isWhitelisted[supplier]) revert SupplierRegistry__NotWhitelisted(supplier);
        self.isWhitelisted[supplier] = false;
        emit SupplierRevoked(supplier);
    }

    // -------------------------------------------------------------------------
    // Leitura + modificador equivalente
    // -------------------------------------------------------------------------

    /// @notice Reverte se o fornecedor não estiver na whitelist.
    ///         Chamado como guard no PurchaseManager antes de abrir solicitação.
    function requireWhitelisted(Registry storage self, address supplier) internal view {
        if (!self.isWhitelisted[supplier]) revert SupplierRegistry__NotWhitelisted(supplier);
    }
}
