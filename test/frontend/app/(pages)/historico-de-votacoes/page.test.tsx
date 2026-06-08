import { describe, expect, it } from 'vitest'
import { render } from '@test/utils/render'
import HistoricoDeVotacoesPage from '@/app/(pages)/historico-de-votacoes/page'

describe('HistoricoDeVotacoesPage', () => {
  it('renderiza sem erros', () => {
    expect(() => render(<HistoricoDeVotacoesPage />)).not.toThrow()
  })
})
