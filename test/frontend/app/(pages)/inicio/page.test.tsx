import { describe, expect, it } from 'vitest'
import { render } from '@test/utils/render'
import InicioPage from '@/app/(pages)/inicio/page'

describe('InicioPage', () => {
  it('renderiza sem erros', () => {
    expect(() => render(<InicioPage />)).not.toThrow()
  })
})
