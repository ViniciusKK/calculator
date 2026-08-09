import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { calculate, calculateUnary } from './api'

vi.mock('./api', () => ({ calculate: vi.fn(), calculateUnary: vi.fn() }))

const mockCalculate = vi.mocked(calculate)
const mockCalculateUnary = vi.mocked(calculateUnary)

const backend: Record<string, (a: number, b: number) => number> = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  power: (a, b) => a ** b,
  divide: (a, b) => {
    if (b === 0) throw new Error('division by zero')
    return a / b
  },
}

// Reading the screen straight from the DOM, so the assertions match what the
// user sees rather than component internals.
const screenText = (selector: string): string => {
  const node = document.querySelector(`.screen ${selector}`)
  if (!node) throw new Error(`no .screen ${selector} on the page`)
  return node.textContent ?? ''
}

const display = () => screenText('.value')
const expressionLine = () => screenText('.expression').trim()

beforeEach(() => {
  mockCalculate.mockReset()
  mockCalculateUnary.mockReset()
  mockCalculate.mockImplementation(async (op, a, b) => backend[op](a, b))
  mockCalculateUnary.mockImplementation(async (_op, a) => {
    if (a < 0) throw new Error('square root of a negative number')
    return Math.sqrt(a)
  })
})

const setup = () => {
  const user = userEvent.setup()
  render(<App />)
  return user
}

describe('keyboard input', () => {
  it('types an expression with more than two operands', async () => {
    const user = setup()
    await user.keyboard('2+2+2')
    expect(display()).toBe('2+2+2')

    await user.keyboard('{Enter}')
    await waitFor(() => expect(display()).toBe('6'))
    expect(expressionLine()).toBe('2+2+2 =')
  })

  it('maps * and / to × and ÷', async () => {
    const user = setup()
    await user.keyboard('2*3/6')
    expect(display()).toBe('2×3÷6')

    await user.keyboard('{Enter}')
    await waitFor(() => expect(display()).toBe('1'))
  })

  it('accepts = as well as Enter', async () => {
    const user = setup()
    await user.keyboard('9*8=')
    await waitFor(() => expect(display()).toBe('72'))
  })

  it('accepts both . and , as the decimal separator', async () => {
    const user = setup()
    await user.keyboard('1.5+2,5{Enter}')
    await waitFor(() => expect(display()).toBe('4'))
  })

  it('deletes with Backspace and clears with Escape', async () => {
    const user = setup()
    await user.keyboard('99+8')
    await user.keyboard('{Backspace}')
    expect(display()).toBe('99+')

    await user.keyboard('7{Enter}')
    await waitFor(() => expect(display()).toBe('106'))

    await user.keyboard('{Escape}')
    expect(display()).toBe('0')
    expect(expressionLine()).toBe('')
  })

  it('surfaces a backend error', async () => {
    const user = setup()
    await user.keyboard('8/0{Enter}')
    await waitFor(() => expect(display()).toBe('division by zero'))
    expect(document.querySelector('.screen .value')).toHaveClass('error')
  })

  it('does not call the API for an incomplete expression', async () => {
    const user = setup()
    await user.keyboard('7+{Enter}')
    await waitFor(() => expect(display()).toBe('incomplete expression'))
    expect(mockCalculate).not.toHaveBeenCalled()
  })
})

describe('rejecting invalid input', () => {
  it('ignores letters entirely', async () => {
    const user = setup()
    await user.keyboard('abcdefghijklmnopqrstuvwxyz')
    await user.keyboard('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    expect(display()).toBe('0')
  })

  it('ignores letters mixed into a real expression', async () => {
    const user = setup()
    await user.keyboard('1a2b+c3d')
    expect(display()).toBe('12+3')

    await user.keyboard('{Enter}')
    await waitFor(() => expect(display()).toBe('15'))
  })

  it('ignores x as a multiplication key', async () => {
    const user = setup()
    await user.keyboard('2x3')
    expect(display()).toBe('23')
  })

  it('ignores punctuation and whitespace', async () => {
    const user = setup()
    await user.keyboard('1 2;3:4!5?6')
    expect(display()).toBe('123456')
  })

  it('never lets an expression start with an operator', async () => {
    const user = setup()
    await user.keyboard('+++')
    expect(display()).toBe('0')
    await user.keyboard('***')
    expect(display()).toBe('0')
  })

  it('leaves shortcut combinations to the browser', async () => {
    const user = setup()
    await user.keyboard('{Control>}5{/Control}')
    await user.keyboard('{Meta>}9{/Meta}')
    expect(display()).toBe('0')
  })
})

describe('keypad', () => {
  it('still works alongside the keyboard', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: '1' }))
    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: '+' }))
    await user.keyboard('30')
    await user.click(screen.getByRole('button', { name: '=' }))
    await waitFor(() => expect(display()).toBe('42'))
  })

  it('exposes every key the calculator needs', () => {
    setup()
    // "minus" and "decimal comma" are the aria-labels for − and ,
    const labels = [
      ...'0123456789',
      '+',
      '×',
      '÷',
      '=',
      'C',
      'backspace',
      'decimal comma',
      'minus',
      'square root',
      'exponent',
      'percent',
      'open parenthesis',
      'close parenthesis',
    ]
    for (const name of labels) {
      expect(screen.getAllByRole('button', { name }).length).toBeGreaterThan(0)
    }
  })
})

describe('exponentiation, roots, percent and parentheses', () => {
  it('raises to a power from the keyboard', async () => {
    const user = setup()
    await user.keyboard('2^10{Enter}')
    await waitFor(() => expect(display()).toBe('1024'))
  })

  it('binds ^ tighter than × and lets parentheses override it', async () => {
    const user = setup()
    await user.keyboard('2*3^2{Enter}')
    await waitFor(() => expect(display()).toBe('18'))

    await user.keyboard('{Escape}(2*3)^2{Enter}')
    await waitFor(() => expect(display()).toBe('36'))
  })

  it('takes a square root from the keypad', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'square root' }))
    await user.keyboard('9{Enter}')
    await waitFor(() => expect(display()).toBe('3'))
  })

  it('roots a parenthesised group', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'square root' }))
    await user.keyboard('(9+16){Enter}')
    await waitFor(() => expect(display()).toBe('5'))
  })

  it('reports a negative square root', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'square root' }))
    await user.keyboard('(0-4){Enter}')
    await waitFor(() => expect(display()).toBe('square root of a negative number'))
  })

  it('treats percent as "of" after + and −', async () => {
    const user = setup()
    await user.keyboard('50+10%{Enter}')
    await waitFor(() => expect(display()).toBe('55'))
  })

  it('treats percent as a fraction after ×', async () => {
    const user = setup()
    await user.keyboard('200*15%{Enter}')
    await waitFor(() => expect(display()).toBe('30'))
  })

  it('evaluates nested parentheses', async () => {
    const user = setup()
    await user.keyboard('2*(3+(4-1)){Enter}')
    await waitFor(() => expect(display()).toBe('12'))
  })

  it('reports an unclosed parenthesis instead of guessing', async () => {
    const user = setup()
    await user.keyboard('(1+2{Enter}')
    await waitFor(() => expect(display()).toBe('missing closing parenthesis'))
  })

  it('inserts × when a group follows a value', async () => {
    const user = setup()
    await user.keyboard('2(3+4)')
    expect(display()).toBe('2×(3+4)')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(display()).toBe('14'))
  })

  it('never lets a stray ) into the expression', async () => {
    const user = setup()
    await user.keyboard('))))')
    expect(display()).toBe('0')
    await user.keyboard('1+2))))')
    expect(display()).toBe('1+2')
  })
})

describe('while a calculation is in flight', () => {
  // Holds the API call open so the busy window can be inspected.
  const deferred = () => {
    let release!: (value: number) => void
    let fail!: (reason: Error) => void
    const promise = new Promise<number>((resolve, reject) => {
      release = resolve
      fail = reject
    })
    return { promise, release, fail }
  }

  it('shows a busy indicator and clears it when the result lands', async () => {
    const pending = deferred()
    mockCalculate.mockReturnValue(pending.promise)

    const user = setup()
    await user.keyboard('1+2{Enter}')

    expect(await screen.findByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')

    await act(async () => {
      pending.release(3)
    })

    await waitFor(() => expect(display()).toBe('3'))
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'false')
  })

  it('ignores digits and operators', async () => {
    const pending = deferred()
    mockCalculate.mockReturnValue(pending.promise)

    const user = setup()
    await user.keyboard('1+2{Enter}')
    await screen.findByRole('progressbar')

    await user.keyboard('9+7')
    expect(display()).toBe('1+2')

    await act(async () => {
      pending.release(3)
    })
    await waitFor(() => expect(display()).toBe('3'))
  })

  it('lets Escape through and drops the in-flight result', async () => {
    const pending = deferred()
    mockCalculate.mockReturnValue(pending.promise)

    const user = setup()
    await user.keyboard('1+2{Enter}')
    await screen.findByRole('progressbar')

    await user.keyboard('{Escape}')
    expect(display()).toBe('0')
    expect(screen.queryByRole('progressbar')).toBeNull()

    // The abandoned request finishing must not resurrect the old result.
    await act(async () => {
      pending.release(3)
    })
    expect(display()).toBe('0')
  })

  it('lets the C key through and drops the in-flight result', async () => {
    const pending = deferred()
    mockCalculate.mockReturnValue(pending.promise)

    const user = setup()
    await user.keyboard('1+2{Enter}')
    await screen.findByRole('progressbar')

    await user.click(screen.getByRole('button', { name: 'C' }))
    expect(display()).toBe('0')

    await act(async () => {
      pending.release(3)
    })
    expect(display()).toBe('0')
  })

  it('does not show a stale error from an abandoned request', async () => {
    const pending = deferred()
    mockCalculate.mockReturnValue(pending.promise)

    const user = setup()
    await user.keyboard('1+2{Enter}')
    await screen.findByRole('progressbar')
    await user.keyboard('{Escape}')

    await act(async () => {
      pending.fail(new Error('the server took too long to respond'))
      await Promise.resolve()
    })
    expect(display()).toBe('0')
  })

  it('can start a fresh calculation after clearing a stuck one', async () => {
    const stuck = deferred()
    mockCalculate.mockReturnValueOnce(stuck.promise)

    const user = setup()
    await user.keyboard('1+2{Enter}')
    await screen.findByRole('progressbar')
    await user.keyboard('{Escape}')

    await user.keyboard('4+5{Enter}')
    await waitFor(() => expect(display()).toBe('9'))
  })
})
