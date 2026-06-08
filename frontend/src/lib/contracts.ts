import deploy from '@deploy-atual'

export const CONTRACT_ADDRESSES = {
  GovernanceDAO: deploy.contracts.GovernanceDAO,
  InstitutionRegistry: deploy.contracts.InstitutionRegistry,
  Treasury: deploy.contracts.Treasury,
  PurchaseManager: deploy.contracts.PurchaseManager,
} as const

export const NETWORK = deploy.network
