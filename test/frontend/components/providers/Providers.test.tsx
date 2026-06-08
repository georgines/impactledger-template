import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Providers } from '@/components/providers/Providers'

describe('Providers', () => {
  it('renderiza os filhos passados', () => {
    render(
      <Providers>
        <span data-testid="child">conteúdo</span>
      </Providers>
    )
    expect(screen.getByTestId('child')).toBeDefined()
  })

  it('não lança erro ao renderizar sem filhos', () => {
    expect(() =>
      render(<Providers>{null}</Providers>)
    ).not.toThrow()
  })
})
