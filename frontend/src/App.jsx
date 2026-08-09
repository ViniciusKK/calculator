import { useState } from 'react'
import {
  currentSegment,
  evaluate,
  format,
  isOperator,
} from './expression'
import './App.css'

const MAX_DIGITS = 15

function App() {
  const [expression, setExpression] = useState('')
  const [result, setResult] = useState(null) // set once "=" has run
  const [evaluated, setEvaluated] = useState('') // expression that produced result
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const clear = () => {
    setExpression('')
    setResult(null)
    setEvaluated('')
    setError(null)
  }

  // A finished result or an error is not editable — typing a value starts over.
  const startOver = (text) => {
    setExpression(text)
    setResult(null)
    setEvaluated('')
    setError(null)
  }

  const inputDigit = (digit) => {
    if (busy) return
    if (error || result !== null) return startOver(digit)

    setExpression((current) => {
      const segment = currentSegment(current)
      if (segment.replace(',', '').length >= MAX_DIGITS) return current
      // Don't build up leading zeros: "0" then "5" is 5, not 05.
      if (segment === '0') return current.slice(0, -1) + digit
      return current + digit
    })
  }

  const inputComma = () => {
    if (busy) return
    if (error || result !== null) return startOver('0,')

    setExpression((current) => {
      const segment = currentSegment(current)
      if (segment.includes(',')) return current
      return segment === '' ? current + '0,' : current + ','
    })
  }

  const inputOperator = (symbol) => {
    if (busy || error) return

    // Keep going from the result: "6 =" then "+" continues as "6+".
    if (result !== null) {
      startOver(format(result) + symbol)
      return
    }

    setExpression((current) => {
      if (current === '') return current // no leading operator
      const last = current.at(-1)
      // Pressing two operators in a row swaps them; a dangling comma is dropped.
      if (isOperator(last) || last === ',') return current.slice(0, -1) + symbol
      return current + symbol
    })
  }

  const backspace = () => {
    if (busy) return
    if (error || result !== null) return startOver('')
    setExpression((current) => current.slice(0, -1))
  }

  const equals = async () => {
    if (busy || error || result !== null || expression === '') return

    setBusy(true)
    try {
      const value = await evaluate(expression)
      if (!Number.isFinite(value)) throw new Error('result is not a finite number')
      setEvaluated(expression)
      setResult(value)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const shown = error ?? (result !== null ? format(result) : expression || '0')

  return (
    <main className="calculator">
      <div className="screen" role="status" aria-live="polite">
        <div className="expression">
          {result !== null && !error ? `${evaluated} =` : ' '}
        </div>
        <div
          className={[
            'value',
            error && 'error',
            !error && shown.length > 11 && 'long',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {shown}
        </div>
      </div>

      <div className="keypad">
        <button className="span-2 function" onClick={clear}>
          C
        </button>
        <button className="function" aria-label="backspace" onClick={backspace}>
          ⌫
        </button>
        <button className="operator" onClick={() => inputOperator('÷')}>
          ÷
        </button>

        {['7', '8', '9'].map((d) => (
          <button key={d} onClick={() => inputDigit(d)}>
            {d}
          </button>
        ))}
        <button className="operator" onClick={() => inputOperator('×')}>
          ×
        </button>

        {['4', '5', '6'].map((d) => (
          <button key={d} onClick={() => inputDigit(d)}>
            {d}
          </button>
        ))}
        <button
          className="operator"
          aria-label="minus"
          onClick={() => inputOperator('−')}
        >
          −
        </button>

        {['1', '2', '3'].map((d) => (
          <button key={d} onClick={() => inputDigit(d)}>
            {d}
          </button>
        ))}
        <button className="operator" onClick={() => inputOperator('+')}>
          +
        </button>

        <button className="span-2" onClick={() => inputDigit('0')}>
          0
        </button>
        <button aria-label="decimal comma" onClick={inputComma}>
          ,
        </button>
        <button className="operator equals" onClick={equals}>
          =
        </button>
      </div>
    </main>
  )
}

export default App
