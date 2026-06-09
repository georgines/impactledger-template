'use client'

import type { Signer } from 'ethers'
import { useOrderCreation } from '@/hooks/useOrderCreation'
import { useOrderConfirmation } from '@/hooks/useOrderConfirmation'
import { useDisputeActions } from '@/hooks/useDisputeActions'

// Hook agregador que combina criação, confirmação e disputas de pedidos de compra.
export function usePurchaseManager(signer: Signer | null) {
  const creation = useOrderCreation(signer)
  const confirmation = useOrderConfirmation(signer)
  const disputes = useDisputeActions(signer)

  return {
    createOrder: creation.createOrder,
    confirmDelivery: confirmation.confirmDelivery,
    confirmReceipt: confirmation.confirmReceipt,
    submitImpactProof: confirmation.submitImpactProof,
    confirmReceiptAndSubmitProof: confirmation.confirmReceiptAndSubmitProof,
    openDispute: disputes.openDispute,
    addDisputeEvidence: disputes.addDisputeEvidence,
    voteOnDispute: disputes.voteOnDispute,
    finalizeDispute: disputes.finalizeDispute,
    loading: creation.loading || confirmation.loading || disputes.loading,
    error: creation.error ?? confirmation.error ?? disputes.error,
  }
}
