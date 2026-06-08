import { describe, expect, it } from 'vitest'
import { render, screen } from '@test/utils/render'
import MinhasDoacoesPage from '@/app/(pages)/minhas-doacoes/page'

describe('MinhasDoacoesPage', () => {
  it('renderiza sem erros', () => {
    expect(() => render(<MinhasDoacoesPage />)).not.toThrow()
  })

})
