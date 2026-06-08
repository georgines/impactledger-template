// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IInstitutionRegistry {
    function isActive(address institution) external view returns (bool);
}

/// @title InstitutionRegistry
/// @notice Fonte de verdade do estado de cada instituição na plataforma.
///         Apenas o GovernanceDAO pode alterar estados.
///         Dados informativos (name, areaOfWork) são emitidos apenas em evento —
///         sem custo de storage contínuo.
contract InstitutionRegistry is IInstitutionRegistry {
    enum Status {
        Inactive,
        Active,
        Paused,
        Removed
    }

    address public immutable governance;

    mapping(address => Status) private _status;

    error InstitutionRegistry__OnlyGovernance();
    error InstitutionRegistry__ZeroAddress();
    error InstitutionRegistry__AlreadyRegistered(address institution);
    error InstitutionRegistry__InvalidTransition(Status current, Status target);

    event InstitutionRegistered(
        address indexed institution,
        string name,
        string areaOfWork
    );
    event InstitutionPaused(address indexed institution);
    event InstitutionUnpaused(address indexed institution);
    event InstitutionRemoved(address indexed institution);

    modifier onlyGovernance() {
        if (msg.sender != governance)
            revert InstitutionRegistry__OnlyGovernance();
        _;
    }

    constructor(address _governance) {
        if (_governance == address(0))
            revert InstitutionRegistry__ZeroAddress();
        governance = _governance;
    }

    function register(
        address institution,
        string calldata name,
        string calldata areaOfWork
    ) external onlyGovernance {
        if (institution == address(0))
            revert InstitutionRegistry__ZeroAddress();
        if (_status[institution] != Status.Inactive)
            revert InstitutionRegistry__AlreadyRegistered(institution);

        _status[institution] = Status.Active;
        emit InstitutionRegistered(institution, name, areaOfWork);
    }

    function pause(address institution) external onlyGovernance {
        if (_status[institution] != Status.Active)
            revert InstitutionRegistry__InvalidTransition(
                _status[institution],
                Status.Paused
            );

        _status[institution] = Status.Paused;
        emit InstitutionPaused(institution);
    }

    function unpause(address institution) external onlyGovernance {
        if (_status[institution] != Status.Paused)
            revert InstitutionRegistry__InvalidTransition(
                _status[institution],
                Status.Active
            );

        _status[institution] = Status.Active;
        emit InstitutionUnpaused(institution);
    }

    function remove(address institution) external onlyGovernance {
        Status s = _status[institution];
        if (s == Status.Inactive || s == Status.Removed)
            revert InstitutionRegistry__InvalidTransition(s, Status.Removed);

        _status[institution] = Status.Removed;
        emit InstitutionRemoved(institution);
    }

    function isActive(address institution) external view returns (bool) {
        return _status[institution] == Status.Active;
    }

    /// @notice Retorna true se o endereço é uma instituição registrada e não removida.
    ///         Usado pelo frontend para detecção de papel — inclui estado Paused.
    function isInstitution(address institution) external view returns (bool) {
        Status s = _status[institution];
        return s == Status.Active || s == Status.Paused;
    }

    function statusOf(address institution) external view returns (Status) {
        return _status[institution];
    }
}
