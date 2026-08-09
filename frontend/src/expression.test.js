import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calculate } from './api'
import { currentSegment, evaluate, format, tokenize } from './expression'

vi.mock('./api', () => ({ calculate: vi.fn() }))

// Stand-in for the Go API, so these tests cover ordering rather than arithmetic.
const backend = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => {
    if (b === 0) throw new Error('division by zero')
    return a / b
  },
}

beforeEach(() => {
  calculate.mockReset()
  calculate.mockImplementation(async (op, a, b) => backend[op](a, b))
})

describe('tokenize', () => {
  it('splits numbers from operators', () => {
    expect(tokenize('12,5×3+4')).toEqual({
      numbers: ['12,5', '3', '4'],
      operators: ['×', '+'],
    })
  })

  it('reports a trailing operator as an empty operand', () => {
    expect(tokenize('7+')).toEqual({ numbers: ['7', ''], operators: ['+'] })
  })

  it('handles a bare number', () => {
    expect(tokenize('42')).toEqual({ numbers: ['42'], operators: [] })
  })
})

describe('currentSegment', () => {
  it('returns the operand being typed', () => {
    expect(currentSegment('12+34')).toBe('34')
    expect(currentSegment('12+')).toBe('')
    expect(currentSegment('12')).toBe('12')
    expect(currentSegment('')).toBe('')
  })
})

describe('format', () => {
  it('uses a comma as the decimal separator', () => {
    expect(format(1.5)).toBe('1,5')
    expect(format(-4)).toBe('-4')
    expect(format(72)).toBe('72')
  })

  it('trims binary floating-point noise', () => {
    expect(format(0.1 + 0.2)).toBe('0,3')
    expect(format(0.1 * 0.2)).toBe('0,02')
  })
})

describe('evaluate', () => {
  it('adds a chain left to right', async () => {
    await expect(evaluate('2+2+2')).resolves.toBe(6)
    await expect(evaluate('1+2+3+4+5')).resolves.toBe(15)
  })

  it('applies × and ÷ before + and −', async () => {
    await expect(evaluate('2+3×4')).resolves.toBe(14)
    await expect(evaluate('2×3+4×5')).resolves.toBe(26)
    await expect(evaluate('100−10÷2')).resolves.toBe(95)
  })

  it('reads commas as decimal points', async () => {
    await expect(evaluate('12,5×4')).resolves.toBe(50)
  })

  it('returns a lone number without calling the API', async () => {
    await expect(evaluate('42')).resolves.toBe(42)
    expect(calculate).not.toHaveBeenCalled()
  })

  it('delegates every step to the API, in precedence order', async () => {
    await evaluate('1+2+3×4')
    expect(calculate.mock.calls).toEqual([
      ['multiply', 3, 4],
      ['add', 1, 2],
      ['add', 3, 12],
    ])
  })

  it('rejects an incomplete expression before calling the API', async () => {
    await expect(evaluate('7+')).rejects.toThrow('incomplete expression')
    expect(calculate).not.toHaveBeenCalled()
  })

  it('propagates an API error', async () => {
    await expect(evaluate('8÷0')).rejects.toThrow('division by zero')
  })
})
