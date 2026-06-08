'use client'

import { Badge, Text, Timeline } from '@mantine/core'
import { IconBuildingCommunity, IconFile, IconTruck } from '@tabler/icons-react'
import type { Provider } from 'ethers'
import { useDisputeEvidences } from '@/hooks/useDisputeEvidences'
import { truncateAddress } from '@/lib/format'

interface DisputeTimelineProps {
  provider: Provider | null
  purchaseId: bigint
  institution: string
  supplier: string
  institutionName?: string
  supplierName?: string
}

function truncateHash(hash: string): string {
  return hash.slice(0, 10) + '...' + hash.slice(-6)
}

function formatTimestamp(ts: number): string {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DisputeTimeline({
  provider,
  purchaseId,
  institution,
  supplier,
  institutionName,
  supplierName,
}: DisputeTimelineProps) {
  const { evidences } = useDisputeEvidences(provider, purchaseId)

  const institutionLabel = institutionName ?? truncateAddress(institution)
  const supplierLabel = supplierName ?? truncateAddress(supplier)

  return (
    <div data-testid={`dispute-timeline-${purchaseId}`}>
      <Timeline bulletSize={20} lineWidth={2}>
        <Timeline.Item
          title={`Instituição: ${institutionLabel}`}
          bullet={<IconBuildingCommunity size={12} />}
        >
          <Text size="xs" c="dimmed">
            {truncateAddress(institution)}
          </Text>
        </Timeline.Item>

        <Timeline.Item title={`Fornecedor: ${supplierLabel}`} bullet={<IconTruck size={12} />}>
          <Text size="xs" c="dimmed">
            {truncateAddress(supplier)}
          </Text>
        </Timeline.Item>

        {evidences.map((ev, i) => {
          const isInstitution = ev.submittedBy.toLowerCase() === institution.toLowerCase()
          const senderLabel = isInstitution ? institutionLabel : supplierLabel
          const senderColor = isInstitution ? 'teal' : 'blue'
          const dateLabel = formatTimestamp(ev.timestamp)
          return (
            <Timeline.Item key={i} title="Evidência" bullet={<IconFile size={12} />}>
              <Badge size="xs" color={senderColor}>
                {senderLabel}
              </Badge>
              {dateLabel && (
                <Text size="xs" c="dimmed" mt={2}>
                  {dateLabel}
                </Text>
              )}
              <Text
                size="xs"
                c="dimmed"
                ff="monospace"
                data-testid={`timeline-evidence-${purchaseId}-${i}`}
              >
                {truncateHash(ev.ipfsHash)}
              </Text>
            </Timeline.Item>
          )
        })}
      </Timeline>
    </div>
  )
}
