// Pure state machine for the calculator. Everything here is synchronous and
// side-effect free; the async "=" evaluation lives in App and feeds its outcome
// back in as a `result` or `failed` action.

import { currentSegment, endsValue, format, isOperator, openGroups } from './expression'

export const MAX_DIGITS = 15

export type State = {
  expression: string
  result: number | null // set once "=" has run
  evaluated: string // the expression that produced `result`
  error: string | null
}

// Actions carrying no payload. "equals" is handled by App, not the reducer.
export type SimpleActionType =
  | 'comma'
  | 'openParen'
  | 'closeParen'
  | 'sqrt'
  | 'percent'
  | 'backspace'
  | 'clear'
  | 'equals'

// `digit` and `operator` carry a plain string rather than a narrow union: they
// come from raw keyboard input, so the reducer validates them at runtime.
export type Action =
  | { type: 'digit'; value: string }
  | { type: 'operator'; value: string }
  | { type: 'result'; expression: string; value: number }
  | { type: 'failed'; message: string }
  | { type: SimpleActionType }

export const initialState: State = {
  expression: '',
  result: null,
  evaluated: '',
  error: null,
}

const isDigit = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9]$/.test(value)

// A finished result or an error is not editable — typing a value starts over.
const startOver = (expression: string): State => ({ ...initialState, expression })

const withExpression = (state: State, expression: string): State => ({
  ...state,
  expression,
})

// "2" then "(" means 2×(...); the × is inserted rather than swallowing the key.
const glue = (expression: string): string => (endsValue(expression.at(-1)) ? '×' : '')

export function reduce(state: State, action: Action): State {
  switch (action?.type) {
    case 'digit': {
      if (!isDigit(action.value)) return state
      if (state.error || state.result !== null) return startOver(action.value)

      const segment = currentSegment(state.expression)
      if (segment.replace(',', '').length >= MAX_DIGITS) return state
      // A digit cannot follow ")" or "%" without an operator between them.
      if (segment === '' && endsValue(state.expression.at(-1))) {
        return withExpression(state, `${state.expression}×${action.value}`)
      }
      // Don't build up leading zeros: "0" then "5" is 5, not 05.
      if (segment === '0') {
        return withExpression(state, state.expression.slice(0, -1) + action.value)
      }
      return withExpression(state, state.expression + action.value)
    }

    case 'comma': {
      if (state.error || state.result !== null) return startOver('0,')

      const segment = currentSegment(state.expression)
      if (segment.includes(',')) return state
      if (segment === '') {
        return withExpression(state, `${state.expression + glue(state.expression)}0,`)
      }
      return withExpression(state, `${state.expression},`)
    }

    case 'operator': {
      if (typeof action.value !== 'string' || !isOperator(action.value)) return state
      if (state.error) return state
      // Keep going from the result: "6 =" then "+" continues as "6+".
      if (state.result !== null) {
        return startOver(format(state.result) + action.value)
      }
      if (state.expression === '') return state // no leading operator

      const last = state.expression.at(-1) ?? ''
      if (last === '(' || last === '√') return state // nothing to operate on
      // Two operators in a row swap; a dangling comma is dropped.
      if (isOperator(last) || last === ',') {
        return withExpression(state, state.expression.slice(0, -1) + action.value)
      }
      return withExpression(state, state.expression + action.value)
    }

    case 'openParen': {
      if (state.error || state.result !== null) return startOver('(')
      return withExpression(state, `${state.expression + glue(state.expression)}(`)
    }

    case 'closeParen': {
      if (state.error || state.result !== null) return state
      if (openGroups(state.expression) <= 0) return state
      // Refuse to close an empty or half-written group: "(", "(2+".
      if (!endsValue(state.expression.at(-1))) return state
      return withExpression(state, `${state.expression})`)
    }

    case 'sqrt': {
      if (state.error || state.result !== null) return startOver('√')
      return withExpression(state, `${state.expression + glue(state.expression)}√`)
    }

    case 'percent': {
      if (state.error) return state
      if (state.result !== null) return startOver(`${format(state.result)}%`)
      // Percent needs something to apply to.
      if (!endsValue(state.expression.at(-1))) return state
      return withExpression(state, `${state.expression}%`)
    }

    case 'backspace': {
      if (state.error || state.result !== null) return startOver('')
      return withExpression(state, state.expression.slice(0, -1))
    }

    case 'clear':
      return initialState

    case 'result':
      return {
        expression: action.expression,
        result: action.value,
        evaluated: action.expression,
        error: null,
      }

    case 'failed':
      return { ...state, error: action.message }

    default:
      return state
  }
}

// What the big line on screen should show.
export const displayValue = (state: State): string => {
  if (state.error) return state.error
  if (state.result !== null) return format(state.result)
  return state.expression || '0'
}
