import { describe, expect, it } from 'vitest'
import { displayValue, initialState, MAX_DIGITS, reduce } from './calculator'

// Applies a sequence of actions, starting from a clean state.
const run = (actions, from = initialState) => actions.reduce(reduce, from)

const digits = (text) =>
  [...text].map((value) =>
    value === ',' ? { type: 'comma' } : { type: 'digit', value },
  )

const op = (value) => ({ type: 'operator', value })

describe('digits', () => {
  it('builds up a number', () => {
    expect(run(digits('123')).expression).toBe('123')
  })

  it('does not keep a leading zero', () => {
    expect(run(digits('053')).expression).toBe('53')
    expect(run(digits('0')).expression).toBe('0')
  })

  it('keeps the zero when it is a decimal', () => {
    expect(run([...digits('0'), { type: 'comma' }, ...digits('5')]).expression).toBe('0,5')
  })

  it('stops accepting digits past the limit', () => {
    const many = run(digits('1'.repeat(MAX_DIGITS + 5)))
    expect(many.expression).toHaveLength(MAX_DIGITS)
  })

  it('applies the limit per operand, not per expression', () => {
    const state = run([...digits('123456789'), op('+'), ...digits('987654321')])
    expect(state.expression).toBe('123456789+987654321')
  })

  it('rejects anything that is not a single digit', () => {
    for (const value of ['a', 'Z', '12', '', ' ', '-1', '٣', null, undefined, 5]) {
      const state = reduce(initialState, { type: 'digit', value })
      expect(state.expression, `value ${String(value)}`).toBe('')
    }
  })
})

describe('comma', () => {
  it('starts a decimal from nothing as 0,', () => {
    expect(run([{ type: 'comma' }]).expression).toBe('0,')
  })

  it('ignores a second comma in the same operand', () => {
    expect(run(digits('1,2,3')).expression).toBe('1,23')
  })

  it('allows a comma in each operand', () => {
    const state = run([...digits('1,5'), op('+'), ...digits('2,5')])
    expect(state.expression).toBe('1,5+2,5')
  })
})

describe('operators', () => {
  it('appends after a number', () => {
    expect(run([...digits('12'), op('+')]).expression).toBe('12+')
  })

  it('refuses to lead an expression', () => {
    expect(run([op('+')]).expression).toBe('')
    expect(run([op('−')]).expression).toBe('')
  })

  it('swaps when pressed twice', () => {
    expect(run([...digits('5'), op('+'), op('×')]).expression).toBe('5×')
  })

  it('drops a dangling comma', () => {
    expect(run([...digits('5,'), op('+')]).expression).toBe('5+')
  })

  it('accepts the exponent operator', () => {
    expect(run([...digits('2'), op('^'), ...digits('10')]).expression).toBe('2^10')
  })

  it('rejects symbols that are not operators', () => {
    for (const value of ['%', 'x', '=', '(', '√', '', null]) {
      expect(run([...digits('5'), op(value)]).expression, `value ${String(value)}`).toBe('5')
    }
  })

  it('continues from a result', () => {
    const done = { expression: '2+2', result: 4, evaluated: '2+2', error: null }
    const state = reduce(done, op('×'))
    expect(state.expression).toBe('4×')
    expect(state.result).toBeNull()
  })
})

describe('backspace and clear', () => {
  it('removes one character at a time', () => {
    const state = run([...digits('99'), op('+'), ...digits('8'), { type: 'backspace' }])
    expect(state.expression).toBe('99+')
    expect(reduce(state, { type: 'backspace' }).expression).toBe('99')
  })

  it('is harmless on an empty expression', () => {
    expect(run([{ type: 'backspace' }]).expression).toBe('')
  })

  it('discards a finished result', () => {
    const done = { expression: '2+2', result: 4, evaluated: '2+2', error: null }
    expect(reduce(done, { type: 'backspace' })).toEqual(initialState)
  })

  it('resets everything', () => {
    const messy = { expression: '1+2', result: 3, evaluated: '1+2', error: 'boom' }
    expect(reduce(messy, { type: 'clear' })).toEqual(initialState)
  })
})

describe('results and errors', () => {
  it('records the expression that produced the result', () => {
    const state = reduce(run(digits('2')), {
      type: 'result',
      expression: '1+1',
      value: 2,
    })
    expect(state).toEqual({ expression: '1+1', result: 2, evaluated: '1+1', error: null })
  })

  it('starts a fresh expression when a digit follows a result', () => {
    const done = { expression: '2+2', result: 4, evaluated: '2+2', error: null }
    expect(reduce(done, { type: 'digit', value: '9' }).expression).toBe('9')
  })

  it('blocks operators while an error is showing', () => {
    const failed = { ...initialState, expression: '8÷0', error: 'division by zero' }
    expect(reduce(failed, op('+'))).toEqual(failed)
  })

  it('lets a digit clear the error and start over', () => {
    const failed = { ...initialState, expression: '8÷0', error: 'division by zero' }
    const state = reduce(failed, { type: 'digit', value: '7' })
    expect(state).toEqual({ ...initialState, expression: '7' })
  })

  it('ignores unknown actions', () => {
    expect(reduce(initialState, { type: 'nope' })).toBe(initialState)
    expect(reduce(initialState, undefined)).toBe(initialState)
  })
})

describe('displayValue', () => {
  it('shows a zero when empty', () => {
    expect(displayValue(initialState)).toBe('0')
  })

  it('shows the expression while typing', () => {
    expect(displayValue(run(digits('12,5')))).toBe('12,5')
  })

  it('shows the result once evaluated', () => {
    expect(displayValue({ ...initialState, result: 0.30000000000000004 })).toBe('0,3')
  })

  it('shows the error above everything else', () => {
    expect(
      displayValue({ ...initialState, expression: '8÷0', error: 'division by zero' }),
    ).toBe('division by zero')
  })
})

const paren = (side) => ({ type: side === '(' ? 'openParen' : 'closeParen' })
const sqrt = { type: 'sqrt' }
const percent = { type: 'percent' }

describe('parentheses', () => {
  it('opens a group anywhere a number could start', () => {
    expect(run([paren('(')]).expression).toBe('(')
    expect(run([...digits('2'), op('+'), paren('(')]).expression).toBe('2+(')
    expect(run([paren('('), paren('(')]).expression).toBe('((')
  })

  it('closes only what is open', () => {
    expect(run([paren(')')]).expression).toBe('')
    expect(run([...digits('2'), paren(')')]).expression).toBe('2')
    expect(run([paren('('), ...digits('2'), paren(')')]).expression).toBe('(2)')
  })

  it('refuses to close an empty or half-written group', () => {
    expect(run([paren('('), paren(')')]).expression).toBe('(')
    expect(run([paren('('), ...digits('2'), op('+'), paren(')')]).expression).toBe('(2+')
  })

  it('refuses to close more groups than are open', () => {
    const state = run([paren('('), ...digits('2'), paren(')'), paren(')')])
    expect(state.expression).toBe('(2)')
  })

  it('blocks a leading operator inside a group', () => {
    expect(run([paren('('), op('+')]).expression).toBe('(')
    expect(run([paren('('), op('×')]).expression).toBe('(')
  })
})

describe('implicit multiplication', () => {
  it('inserts × between a value and an opening group', () => {
    expect(run([...digits('2'), paren('(')]).expression).toBe('2×(')
    expect(run([paren('('), ...digits('2'), paren(')'), paren('(')]).expression).toBe('(2)×(')
  })

  it('inserts × between a value and a square root', () => {
    expect(run([...digits('2'), sqrt]).expression).toBe('2×√')
  })

  it('inserts × between a closed group and a digit', () => {
    const state = run([paren('('), ...digits('2'), paren(')'), ...digits('3')])
    expect(state.expression).toBe('(2)×3')
  })

  it('inserts × after a percent', () => {
    expect(run([...digits('50'), percent, ...digits('2')]).expression).toBe('50%×2')
  })

  it('does not insert × mid-number', () => {
    expect(run(digits('123')).expression).toBe('123')
  })
})

describe('square root', () => {
  it('starts an expression', () => {
    expect(run([sqrt, ...digits('9')]).expression).toBe('√9')
  })

  it('follows an operator directly', () => {
    expect(run([...digits('2'), op('+'), sqrt, ...digits('9')]).expression).toBe('2+√9')
  })

  it('stacks', () => {
    expect(run([sqrt, sqrt, ...digits('16')]).expression).toBe('√√16')
  })

  it('leaves nothing for an operator to work on', () => {
    expect(run([sqrt, op('+')]).expression).toBe('√')
  })
})

describe('percent', () => {
  it('follows a number', () => {
    expect(run([...digits('50'), percent]).expression).toBe('50%')
  })

  it('follows a closed group', () => {
    const state = run([paren('('), ...digits('2'), paren(')'), percent])
    expect(state.expression).toBe('(2)%')
  })

  it('needs something to apply to', () => {
    expect(run([percent]).expression).toBe('')
    expect(run([...digits('5'), op('+'), percent]).expression).toBe('5+')
    expect(run([paren('('), percent]).expression).toBe('(')
    expect(run([sqrt, percent]).expression).toBe('√')
  })

  it('continues from a result', () => {
    const done = { expression: '2+2', result: 4, evaluated: '2+2', error: null }
    expect(reduce(done, percent).expression).toBe('4%')
  })
})
