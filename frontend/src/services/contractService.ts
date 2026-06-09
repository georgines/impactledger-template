import { ethers } from 'ethers'
import { CONTRACT_ADDRESSES } from '@/lib/contracts'
import TreasuryABI from '@/abis/Treasury.json'
import GovernanceDAOABI from '@/abis/GovernanceDAO.json'
import InstitutionRegistryABI from '@/abis/InstitutionRegistry.json'
import PurchaseManagerABI from '@/abis/PurchaseManager.json'

// Retorna instância tipada do contrato Treasury conectada ao signer/provider.
export const getTreasuryContract = (s: ethers.Signer | ethers.Provider) =>
  new ethers.Contract(CONTRACT_ADDRESSES.Treasury, TreasuryABI, s)

// Retorna instância tipada do contrato GovernanceDAO conectada ao signer/provider.
export const getGovernanceDAOContract = (s: ethers.Signer | ethers.Provider) =>
  new ethers.Contract(CONTRACT_ADDRESSES.GovernanceDAO, GovernanceDAOABI, s)

// Retorna instância tipada do contrato InstitutionRegistry conectada ao signer/provider.
export const getInstitutionRegistryContract = (s: ethers.Signer | ethers.Provider) =>
  new ethers.Contract(CONTRACT_ADDRESSES.InstitutionRegistry, InstitutionRegistryABI, s)

// Retorna instância tipada do contrato PurchaseManager conectada ao signer/provider.
export const getPurchaseManagerContract = (s: ethers.Signer | ethers.Provider) =>
  new ethers.Contract(CONTRACT_ADDRESSES.PurchaseManager, PurchaseManagerABI, s)
