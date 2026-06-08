'use client'

import {
  AppShell,
  Badge,
  Burger,
  Button,
  Divider,
  Group,
  NavLink,
  ScrollArea,
  Text,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useEffect, useRef } from 'react'
import {
  IconAlertTriangle,
  IconBuildingCommunity,
  IconBuildingStore,
  IconChecklist,
  IconCoin,
  IconFileCheck,
  IconGift,
  IconHistory,
  IconLayoutDashboard,
  IconLogout,
  IconPackage,
  IconPlus,
  IconScale,
  IconTruck,
  IconWallet,
} from '@tabler/icons-react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useWalletContext } from '@/components/providers/WalletProvider'
import type { Role } from '@/hooks/useActorRole'
import { truncateAddress } from '@/lib/format'
import { ROUTE_ROLES } from '@/lib/routeRoles'

type NavItem = {
  label: string
  href: Route
  Icon: React.ElementType
}

type NavSection = {
  label?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ label: 'Início', href: '/inicio' as Route, Icon: IconLayoutDashboard }],
  },
  {
    label: 'Votações',
    items: [
      { label: 'Propostas em Votação', href: '/em-votacao' as Route, Icon: IconChecklist },
      {
        label: 'Histórico de Votações',
        href: '/historico-de-votacoes' as Route,
        Icon: IconHistory,
      },
    ],
  },
  {
    label: 'Doações',
    items: [
      { label: 'Fazer Doação', href: '/fazer-doacao' as Route, Icon: IconGift },
      { label: 'Minhas Doações', href: '/minhas-doacoes' as Route, Icon: IconHistory },
    ],
  },
  {
    label: 'Pedidos',
    items: [
      {
        label: 'Meus Pedidos de Compra',
        href: '/pedidos-de-compra' as Route,
        Icon: IconBuildingStore,
      },
      { label: 'Novo Pedido', href: '/novo-pedido' as Route, Icon: IconPlus },
      { label: 'Pedidos Recebidos', href: '/pedidos-recebidos' as Route, Icon: IconTruck },
      { label: 'Meus Recebimentos', href: '/meus-recebimentos' as Route, Icon: IconFileCheck },
    ],
  },
  {
    label: 'Disputas',
    items: [
      { label: 'Disputas Ativas', href: '/disputas-ativas' as Route, Icon: IconAlertTriangle },
      { label: 'Minhas Disputas', href: '/minhas-disputas' as Route, Icon: IconScale },
      { label: 'Histórico de Disputas', href: '/historico-disputas' as Route, Icon: IconHistory },
    ],
  },
  {
    label: 'Caixa',
    items: [{ label: 'Saldo', href: '/saldo' as Route, Icon: IconCoin }],
  },
  {
    label: 'Instituições',
    items: [
      { label: 'Cadastrar Instituição', href: '/cadastro/instituicoes' as Route, Icon: IconPlus },
      { label: 'Listar Instituições', href: '/instituicoes' as Route, Icon: IconBuildingCommunity },
    ],
  },
  {
    label: 'Fornecedores',
    items: [
      { label: 'Cadastrar Fornecedor', href: '/cadastro/fornecedores' as Route, Icon: IconPlus },
      { label: 'Listar Fornecedores', href: '/fornecedores' as Route, Icon: IconPackage },
    ],
  },
]

function walletButtonLabel(address: string | null): string {
  if (!address) return 'Conectar Carteira'
  return truncateAddress(address)
}

const ROLE_LABELS: Record<string, string> = {
  operador: 'Você é o operador!',
  instituicao: 'Você é uma instituição!',
  fornecedor: 'Você é um fornecedor!',
  doador: 'Você é um doador!',
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure()
  const pathname = usePathname()
  const router = useRouter()
  const { role, address, connect, disconnect } = useWalletContext()
  const prevAddressRef = useRef<string | null>(null)

  useEffect(() => {
    const prev = prevAddressRef.current
    prevAddressRef.current = address
    if (prev !== null && address !== prev) {
      router.push('/')
    }
  }, [address, router])

  function handleLogout() {
    disconnect()
    router.push('/')
  }

  return (
    <AppShell
      layout="alt"
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700} size="lg" c="blue">
              EloSolidário
            </Text>
          </Group>
          <Group gap="xs">
            {role && (
              <Badge variant="light" color="blue" data-testid="role-badge">
                {ROLE_LABELS[role] ?? role}
              </Badge>
            )}
            <Button
              variant="light"
              size="sm"
              leftSection={<IconWallet size={16} />}
              onClick={address ? undefined : connect}
              data-testid="connect-wallet"
            >
              {walletButtonLabel(address)}
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea}>
          {NAV_SECTIONS.map((section, i) => {
            const visibleItems = section.items.filter(
              (item) => role && (ROUTE_ROLES[item.href as string]?.includes(role) ?? false),
            )
            if (visibleItems.length === 0) return null

            return (
              <div key={i}>
                {i > 0 && <Divider my="sm" />}
                {section.label && (
                  <Text size="xs" fw={600} c="dimmed" px="sm" mb={4} tt="uppercase">
                    {section.label}
                  </Text>
                )}
                {visibleItems.map(({ label, href, Icon }) => (
                  <NavLink
                    key={href}
                    label={label}
                    leftSection={<Icon size={16} />}
                    component={Link}
                    href={href}
                    active={pathname === href}
                  />
                ))}
              </div>
            )
          })}
        </AppShell.Section>

        {address && (
          <AppShell.Section>
            <Button
              variant="filled"
              color="red"
              size="sm"
              fullWidth
              leftSection={<IconLogout size={16} />}
              onClick={handleLogout}
              data-testid="logout-button"
            >
              Sair
            </Button>
          </AppShell.Section>
        )}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
