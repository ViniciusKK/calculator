// Expression parsing and evaluation. Every arithmetic step is delegated to the
// Go API — this module only decides the order the steps run in.

import { calculate } from './api'

// Display symbol -> backend endpoint name.
export const OPERATIONS = {
  '+': 'add',
  '−': 'subtract',
  '×': 'multiply',
  '÷': 'divide',
}

// Higher binds tighter.
export const PRECEDENCE = {
  '×': 2,
  '÷': 2,
  '+': 1,
  '−': 1,
}

export const isOperator = (char) => char in PRECEDENCE

// The number currently being typed, i.e. everything after the last operator.
export const currentSegment = (expression) =>
  expression.split(/[+−×÷]/).at(-1)

// The UI uses a comma as the decimal separator; JS numbers use a dot.
export const toNumber = (text) => Number(text.replace(',', '.'))

export const format = (value) => {
  // Trim binary floating-point noise (0.1 + 0.2) before showing the number.
  const trimmed = Number(value.toPrecision(12))
  return String(trimmed).replace('.', ',')
}

// "12,5×3+4" -> { numbers: ['12,5', '3', '4'], operators: ['×', '+'] }
export function tokenize(expression) {
  const numbers = []
  const operators = []
  let current = ''

  for (const char of expression) {
    if (isOperator(char)) {
      numbers.push(current)
      operators.push(char)
      current = ''
    } else {
      current += char
    }
  }
  numbers.push(current)

  return { numbers, operators }
}

// Collapses the token list one operator at a time, highest precedence first,
// left to right within a precedence level.
export async function evaluate(expression) {
  const { numbers, operators } = tokenize(expression)

  if (numbers.some((n) => n === '')) {
    throw new Error('incomplete expression')
  }

  const values = numbers.map(toNumber)
  const pending = [...operators]

  for (const level of [2, 1]) {
    let i = 0
    while (i < pending.length) {
      if (PRECEDENCE[pending[i]] !== level) {
        i++
        continue
      }
      const result = await calculate(
        OPERATIONS[pending[i]],
        values[i],
        values[i + 1],
      )
      values.splice(i, 2, result)
      pending.splice(i, 1)
    }
  }

  return values[0]
}
