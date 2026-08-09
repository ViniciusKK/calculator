import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calculate, calculateUnary } from './api'
import type { BinaryNode, Node } from './expression'
import {
  currentSegment,
  evaluate,
  format,
  openGroups,
  parse,
  tokenize,
} from './expression'

vi.mock('./api', () => ({ calculate: vi.fn(), calculateUnary: vi.fn() }))

const mockCalculate = vi.mocked(calculate)
const mockCalculateUnary = vi.mocked(calculateUnary)

// Stand-in for the Go API, so these tests cover ordering rather than arithmetic.
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

beforeEach(() => {
  mockCalculate.mockReset()
  mockCalculateUnary.mockReset()
  mockCalculate.mockImplementation(async (op, a, b) => backend[op](a, b))
  mockCalculateUnary.mockImplementation(async (op, a) => {
    if (op !== 'sqrt') throw new Error(`unexpected unary op ${op}`)
    if (a < 0) throw new Error('square root of a negative number')
    return Math.sqrt(a)
  })
})

describe('tokenize', () => {
  it('splits numbers from everything else', () => {
    expect(tokenize('12,5×3')).toEqual([
      { type: 'number', text: '12,5' },
      { type: 'operator', value: '×' },
      { type: 'number', text: '3' },
    ])
  })

  it('recognises the new symbols', () => {
    expect(tokenize('√(2^3)%')).toEqual([
      { type: 'sqrt' },
      { type: 'open' },
      { type: 'number', text: '2' },
      { type: 'operator', value: '^' },
      { type: 'number', text: '3' },
      { type: 'close' },
      { type: 'percent' },
    ])
  })

  it('rejects a character it does not know', () => {
    expect(() => tokenize('2&3')).toThrow('unexpected character "&"')
  })
})

describe('parse', () => {
  const ast = (text: string): Node => parse(tokenize(text))

  // Narrows a Node to a binary one, failing loudly if the shape is wrong.
  const asBinary = (node: Node): BinaryNode => {
    if (node.type !== 'binary') {
      throw new Error(`expected a binary node, got "${node.type}"`)
    }
    return node
  }

  it('nests by precedence', () => {
    expect(ast('2+3×4')).toEqual({
      type: 'binary',
      op: '+',
      left: { type: 'number', text: '2' },
      right: {
        type: 'binary',
        op: '×',
        left: { type: 'number', text: '3' },
        right: { type: 'number', text: '4' },
      },
    })
  })

  it('treats ^ as right-associative', () => {
    const tree = asBinary(ast('2^3^2'))
    expect(asBinary(tree.right).op).toBe('^')
    expect(tree.left).toEqual({ type: 'number', text: '2' })
  })

  it('lets parentheses override precedence', () => {
    expect(asBinary(ast('(2+3)×4')).op).toBe('×')
  })

  it('rejects malformed input', () => {
    expect(() => ast('')).toThrow('incomplete expression')
    expect(() => ast('7+')).toThrow('incomplete expression')
    expect(() => ast('(1+2')).toThrow('missing closing parenthesis')
    expect(() => ast('1+2)')).toThrow('unmatched closing parenthesis')
    expect(() => ast('()')).toThrow('empty parentheses')
    expect(() => ast('√')).toThrow('incomplete expression')
    expect(() => ast('%')).toThrow('incomplete expression')
  })
})

describe('openGroups', () => {
  it('counts unclosed parentheses', () => {
    expect(openGroups('')).toBe(0)
    expect(openGroups('(1+2')).toBe(1)
    expect(openGroups('((1')).toBe(2)
    expect(openGroups('(1+2)')).toBe(0)
  })
})

describe('currentSegment', () => {
  it('returns the operand being typed', () => {
    expect(currentSegment('12+34')).toBe('34')
    expect(currentSegment('12+')).toBe('')
    expect(currentSegment('(12')).toBe('12')
    expect(currentSegment('√')).toBe('')
    expect(currentSegment('(1+2)')).toBe('')
  })
})

describe('format', () => {
  it('uses a comma as the decimal separator', () => {
    expect(format(1.5)).toBe('1,5')
    expect(format(-4)).toBe('-4')
  })

  it('trims binary floating-point noise', () => {
    expect(format(0.1 + 0.2)).toBe('0,3')
  })
})

describe('evaluate', () => {
  it('handles chains and precedence', async () => {
    await expect(evaluate('2+2+2')).resolves.toBe(6)
    await expect(evaluate('2+3×4')).resolves.toBe(14)
    await expect(evaluate('100−10÷2')).resolves.toBe(95)
  })

  it('applies parentheses', async () => {
    await expect(evaluate('(2+3)×4')).resolves.toBe(20)
    await expect(evaluate('2×(3+(4−1))')).resolves.toBe(12)
    await expect(evaluate('((((5))))')).resolves.toBe(5)
    await expect(evaluate('(2+3)×(4+6)')).resolves.toBe(50)
  })

  it('raises to a power, binding tighter than × and ÷', async () => {
    await expect(evaluate('2^10')).resolves.toBe(1024)
    await expect(evaluate('2×3^2')).resolves.toBe(18)
    await expect(evaluate('(2×3)^2')).resolves.toBe(36)
  })

  it('treats ^ as right-associative', async () => {
    await expect(evaluate('2^3^2')).resolves.toBe(512)
  })

  it('takes square roots', async () => {
    await expect(evaluate('√9')).resolves.toBe(3)
    await expect(evaluate('√9+16')).resolves.toBe(19)
    await expect(evaluate('√(9+16)')).resolves.toBe(5)
    await expect(evaluate('√√16')).resolves.toBe(2)
    await expect(evaluate('√9×√4')).resolves.toBe(6)
  })

  it('reads percent as "of" after + and −', async () => {
    await expect(evaluate('50+10%')).resolves.toBe(55)
    await expect(evaluate('50−10%')).resolves.toBe(45)
    await expect(evaluate('200+15%')).resolves.toBe(230)
  })

  it('reads percent as a plain fraction after × and ÷', async () => {
    await expect(evaluate('200×15%')).resolves.toBe(30)
    await expect(evaluate('30÷50%')).resolves.toBe(60)
  })

  it('reads a standalone percent as a division by 100', async () => {
    await expect(evaluate('50%')).resolves.toBe(0.5)
    await expect(evaluate('(20%)×10')).resolves.toBe(2)
  })

  it('keeps percent contextual inside parentheses', async () => {
    await expect(evaluate('(50+10%)')).resolves.toBe(55)
    await expect(evaluate('2×(50+10%)')).resolves.toBe(110)
  })

  it('delegates every step to the API, in precedence order', async () => {
    await evaluate('1+2+3×4')
    expect(mockCalculate.mock.calls).toEqual([
      ['add', 1, 2],
      ['multiply', 3, 4],
      ['add', 3, 12],
    ])
  })

  it('calls the unary endpoint for square roots', async () => {
    await evaluate('√16')
    expect(mockCalculateUnary.mock.calls).toEqual([['sqrt', 16]])
    expect(mockCalculate).not.toHaveBeenCalled()
  })

  it('builds a contextual percent out of divide and multiply', async () => {
    await evaluate('50+10%')
    expect(mockCalculate.mock.calls).toEqual([
      ['divide', 10, 100],
      ['multiply', 50, 0.1],
      ['add', 50, 5],
    ])
  })

  it('returns a lone number without calling the API', async () => {
    await expect(evaluate('42')).resolves.toBe(42)
    expect(mockCalculate).not.toHaveBeenCalled()
    expect(mockCalculateUnary).not.toHaveBeenCalled()
  })

  it('rejects malformed input before calling the API', async () => {
    for (const bad of ['7+', '(1+2', '1+2)', '()', '√', '']) {
      mockCalculate.mockClear()
      mockCalculateUnary.mockClear()
      await expect(evaluate(bad), `expression ${bad}`).rejects.toThrow()
      expect(mockCalculate, `expression ${bad}`).not.toHaveBeenCalled()
      expect(mockCalculateUnary, `expression ${bad}`).not.toHaveBeenCalled()
    }
  })

  it('propagates API errors', async () => {
    await expect(evaluate('8÷0')).rejects.toThrow('division by zero')
    await expect(evaluate('√(0−4)')).rejects.toThrow('square root of a negative number')
  })
})
