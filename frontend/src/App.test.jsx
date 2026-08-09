import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { calculate } from './api'

vi.mock('./api', () => ({ calculate: vi.fn() }))

const backend = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => {
    if (b === 0) throw new Error('division by zero')
    return a / b
  },
}

const display = () => document.querySelector('.screen .value').textContent
const expressionLine = () =>
  document.querySelector('.screen .expression').textContent.trim()

beforeEach(() => {
  calculate.mockReset()
  calculate.mockImplementation(async (op, a, b) => backend[op](a, b))
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
    expect(calculate).not.toHaveBeenCalled()
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
      '+', '×', '÷', '=', 'C',
      'backspace', 'decimal comma', 'minus',
    ]
    for (const name of labels) {
      expect(screen.getAllByRole('button', { name }).length).toBeGreaterThan(0)
    }
  })
})
