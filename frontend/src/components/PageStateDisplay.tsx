'use client'

import { Alert, Group, Loader, Text } from '@mantine/core'

interface PageStateDisplayProps {
  loading: boolean
  error?: string | null
  empty: boolean
  emptyMessage: string
  emptyTestId?: string
}

export function PageStateDisplay({
  loading,
  error,
  empty,
  emptyMessage,
  emptyTestId,
}: PageStateDisplayProps) {
  if (!loading && !error && !empty) return null

  return (
    <>
      {loading && (
        <Group justify="center" py="xl">
          <Loader data-testid="page-loading" />
        </Group>
      )}
      {error && (
        <Alert color="red">
          <Text>{error}</Text>
        </Alert>
      )}
      {empty && (
        <Alert color="gray" data-testid={emptyTestId}>
          <Text>{emptyMessage}</Text>
        </Alert>
      )}
    </>
  )
}
