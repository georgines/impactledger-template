import { DashboardShell } from '@/components/layout/DashboardShell'
import { RouteGuard } from '@/components/layout/RouteGuard'

export default function PagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <RouteGuard>{children}</RouteGuard>
    </DashboardShell>
  )
}
