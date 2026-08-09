import { useCallback, useEffect, useReducer, useState } from 'react'
import { displayValue, initialState, reduce } from './calculator'
import { evaluate } from './expression'
import { keyToAction } from './keyboard'
import './App.css'

function App() {
  const [state, dispatch] = useReducer(reduce, initialState)
  const [busy, setBusy] = useState(false)

  const runEquals = useCallback(async () => {
    if (state.error || state.result !== null || state.expression === '') return

    setBusy(true)
    try {
      const value = await evaluate(state.expression)
      if (!Number.isFinite(value)) throw new Error('result is not a finite number')
      dispatch({ type: 'result', expression: state.expression, value })
    } catch (err) {
      dispatch({ type: 'failed', message: err.message })
    } finally {
      setBusy(false)
    }
  }, [state.error, state.result, state.expression])

  // Single entry point for both the keypad and the keyboard.
  const perform = useCallback(
    (action) => {
      if (busy || !action) return
      if (action.type === 'equals') {
        runEquals()
        return
      }
      dispatch(action)
    },
    [busy, runEquals],
  )

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const action = keyToAction(event.key)
      if (!action) return // letters and everything else fall through
      event.preventDefault()
      perform(action)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [perform])

  const digit = (value) => () => perform({ type: 'digit', value })
  const operator = (value) => () => perform({ type: 'operator', value })

  const shown = displayValue(state)

  return (
    <main className="calculator">
      <div className="screen" role="status" aria-live="polite">
        <div className="expression">
          {state.result !== null && !state.error ? `${state.evaluated} =` : ' '}
        </div>
        <div
          className={[
            'value',
            state.error && 'error',
            !state.error && shown.length > 11 && 'long',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {shown}
        </div>
      </div>

      <div className="keypad">
        <button className="span-2 function" onClick={() => perform({ type: 'clear' })}>
          C
        </button>
        <button
          className="function"
          aria-label="backspace"
          onClick={() => perform({ type: 'backspace' })}
        >
          ⌫
        </button>
        <button className="operator" onClick={operator('÷')}>
          ÷
        </button>

        {['7', '8', '9'].map((d) => (
          <button key={d} onClick={digit(d)}>
            {d}
          </button>
        ))}
        <button className="operator" onClick={operator('×')}>
          ×
        </button>

        {['4', '5', '6'].map((d) => (
          <button key={d} onClick={digit(d)}>
            {d}
          </button>
        ))}
        <button className="operator" aria-label="minus" onClick={operator('−')}>
          −
        </button>

        {['1', '2', '3'].map((d) => (
          <button key={d} onClick={digit(d)}>
            {d}
          </button>
        ))}
        <button className="operator" onClick={operator('+')}>
          +
        </button>

        <button className="span-2" onClick={digit('0')}>
          0
        </button>
        <button aria-label="decimal comma" onClick={() => perform({ type: 'comma' })}>
          ,
        </button>
        <button className="operator equals" onClick={() => perform({ type: 'equals' })}>
          =
        </button>
      </div>
    </main>
  )
}

export default App
