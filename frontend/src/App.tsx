import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { Action, SimpleActionType } from './calculator'
import { displayValue, initialState, reduce } from './calculator'
import type { BinaryOp } from './expression'
import { evaluate } from './expression'
import { keyToAction } from './keyboard'
import './App.css'

function App() {
  const [state, dispatch] = useReducer(reduce, initialState)
  const [busy, setBusy] = useState(false)
  // Bumped whenever an evaluation is superseded or cancelled, so a late reply
  // from a request the user has already cleared cannot land on screen.
  const evaluationId = useRef(0)

  const runEquals = useCallback(async () => {
    if (state.error || state.result !== null || state.expression === '') return

    const id = ++evaluationId.current
    const expression = state.expression
    setBusy(true)
    try {
      const value = await evaluate(expression)
      if (evaluationId.current !== id) return
      if (!Number.isFinite(value)) throw new Error('result is not a finite number')
      dispatch({ type: 'result', expression, value })
    } catch (err) {
      if (evaluationId.current !== id) return
      dispatch({ type: 'failed', message: (err as Error).message })
    } finally {
      if (evaluationId.current === id) setBusy(false)
    }
  }, [state.error, state.result, state.expression])

  // Single entry point for both the keypad and the keyboard.
  const perform = useCallback(
    (action: Action | null) => {
      if (!action) return
      // C and Escape are the way out of a request that is hanging, so they run
      // even while busy — and they abandon whatever is still in flight.
      if (action.type === 'clear') {
        evaluationId.current++
        setBusy(false)
        dispatch(action)
        return
      }
      if (busy) return
      if (action.type === 'equals') {
        runEquals()
        return
      }
      dispatch(action)
    },
    [busy, runEquals],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const action = keyToAction(event.key)
      if (!action) return // letters and everything else fall through
      event.preventDefault()
      perform(action)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [perform])

  const digit = (value: string) => () => perform({ type: 'digit', value })
  const operator = (value: BinaryOp) => () => perform({ type: 'operator', value })
  const send = (type: SimpleActionType) => () => perform({ type })

  const shown = displayValue(state)

  return (
    <main className={busy ? 'calculator busy' : 'calculator'} aria-busy={busy}>
      {busy && <div className="spinner" role="progressbar" aria-label="calculating" />}
      <div className="screen" role="status" aria-live="polite">
        <div className="expression">
          {state.result !== null && !state.error ? `${state.evaluated} =` : ' '}
        </div>
        <div
          className={[
            'value',
            state.error && 'error',
            !state.error && shown.length > 20 && 'longer',
            !state.error && shown.length > 12 && shown.length <= 20 && 'long',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {shown}
        </div>
      </div>

      <div className="keypad">
        <button type="button" className="function clear" onClick={send('clear')}>
          C
        </button>
        <button
          type="button"
          className="function"
          aria-label="backspace"
          onClick={send('backspace')}
        >
          ⌫
        </button>
        <button
          type="button"
          className="function"
          aria-label="open parenthesis"
          onClick={send('openParen')}
        >
          (
        </button>
        <button
          type="button"
          className="function"
          aria-label="close parenthesis"
          onClick={send('closeParen')}
        >
          )
        </button>
        <button type="button" className="operator" onClick={operator('÷')}>
          ÷
        </button>

        <button
          type="button"
          className="operator"
          aria-label="square root"
          onClick={send('sqrt')}
        >
          √
        </button>
        {['7', '8', '9'].map((d) => (
          <button type="button" key={d} onClick={digit(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="operator" onClick={operator('×')}>
          ×
        </button>

        <button
          type="button"
          className="operator"
          aria-label="exponent"
          onClick={operator('^')}
        >
          ^
        </button>
        {['4', '5', '6'].map((d) => (
          <button type="button" key={d} onClick={digit(d)}>
            {d}
          </button>
        ))}
        <button
          type="button"
          className="operator"
          aria-label="minus"
          onClick={operator('−')}
        >
          −
        </button>

        <button
          type="button"
          className="operator"
          aria-label="percent"
          onClick={send('percent')}
        >
          %
        </button>
        {['1', '2', '3'].map((d) => (
          <button type="button" key={d} onClick={digit(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="operator" onClick={operator('+')}>
          +
        </button>

        <button type="button" aria-label="decimal comma" onClick={send('comma')}>
          ,
        </button>
        <button type="button" className="span-2" onClick={digit('0')}>
          0
        </button>
        <button
          type="button"
          className="operator equals span-2"
          onClick={send('equals')}
        >
          =
        </button>
      </div>
    </main>
  )
}

export default App
