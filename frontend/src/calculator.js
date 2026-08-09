// Pure state machine for the calculator. Everything here is synchronous and
// side-effect free; the async "=" evaluation lives in App and feeds its outcome
// back in as a `result` or `failed` action.

import { currentSegment, format, isOperator, PRECEDENCE } from './expression'

export const MAX_DIGITS = 15

export const initialState = {
  expression: '',
  result: null, // set once "=" has run
  evaluated: '', // the expression that produced `result`
  error: null,
}

const isDigit = (value) => typeof value === 'string' && /^[0-9]$/.test(value)

// A finished result or an error is not editable — typing a value starts over.
const startOver = (expression) => ({ ...initialState, expression })

export function reduce(state, action) {
  switch (action?.type) {
    case 'digit': {
      if (!isDigit(action.value)) return state
      if (state.error || state.result !== null) return startOver(action.value)

      const segment = currentSegment(state.expression)
      if (segment.replace(',', '').length >= MAX_DIGITS) return state
      // Don't build up leading zeros: "0" then "5" is 5, not 05.
      const expression =
        segment === '0'
          ? state.expression.slice(0, -1) + action.value
          : state.expression + action.value
      return { ...state, expression }
    }

    case 'comma': {
      if (state.error || state.result !== null) return startOver('0,')

      const segment = currentSegment(state.expression)
      if (segment.includes(',')) return state
      return {
        ...state,
        expression: state.expression + (segment === '' ? '0,' : ','),
      }
    }

    case 'operator': {
      if (!(action.value in PRECEDENCE)) return state
      if (state.error) return state
      // Keep going from the result: "6 =" then "+" continues as "6+".
      if (state.result !== null) {
        return startOver(format(state.result) + action.value)
      }
      if (state.expression === '') return state // no leading operator

      const last = state.expression.at(-1)
      // Two operators in a row swap; a dangling comma is dropped.
      const expression =
        isOperator(last) || last === ','
          ? state.expression.slice(0, -1) + action.value
          : state.expression + action.value
      return { ...state, expression }
    }

    case 'backspace': {
      if (state.error || state.result !== null) return startOver('')
      return { ...state, expression: state.expression.slice(0, -1) }
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
export const displayValue = (state) => {
  if (state.error) return state.error
  if (state.result !== null) return format(state.result)
  return state.expression || '0'
}
