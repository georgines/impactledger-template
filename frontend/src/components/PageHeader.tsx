'use client'

import { Button, Group, Title } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'

interface PageHeaderProps {
  title: string
  onRefresh?: () => void
  loading?: boolean
}

export function PageHeader({ title, onRefresh, loading }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="center">
      <Title order={2}>{title}</Title>
      {onRefresh && (
        <Button
          variant="light"
          size="sm"
          leftSection={<IconRefresh size={16} />}
          onClick={onRefresh}
          loading={loading}
        >
          Atualizar
        </Button>
      )}
    </Group>
  )
}
