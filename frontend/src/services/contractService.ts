import { ethers } from 'ethers'
import { CONTRACT_ADDRESSES } from '@/lib/contracts'
import TreasuryABI from '@/abis/Treasury.json'
import GovernanceDAOABI from '@/abis/GovernanceDAO.json'
import InstitutionRegistryABI from '@/abis/InstitutionRegistry.json'
import PurchaseManagerABI from '@/abis/PurchaseManager.json'

export const getTreasuryContract = (s: ethers.Signer | ethers.Provider) =>
  new ethers.Contract(CONTRACT_ADDRESSES.Treasury, TreasuryABI, s)

export const getGovernanceDAOContract = (s: ethers.Signer | ethers.Provider) =>
  new ethers.Contract(CONTRACT_ADDRESSES.GovernanceDAO, GovernanceDAOABI, s)

export const getInstitutionRegistryContract = (s: ethers.Signer | ethers.Provider) =>
  new ethers.Contract(CONTRACT_ADDRESSES.InstitutionRegistry, InstitutionRegistryABI, s)

export const getPurchaseManagerContract = (s: ethers.Signer | ethers.Provider) =>
  new ethers.Contract(CONTRACT_ADDRESSES.PurchaseManager, PurchaseManagerABI, s)
