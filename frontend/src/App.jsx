import { useState } from 'react'
import { calculate } from './api'
import './App.css'

// Display symbol -> backend endpoint name.
const OPERATIONS = {
  '+': 'add',
  '−': 'subtract',
  '×': 'multiply',
  '÷': 'divide',
}

const MAX_DIGITS = 15

// The UI uses a comma as the decimal separator; JS numbers use a dot.
const toNumber = (text) => Number(text.replace(',', '.'))

const format = (value) => {
  // Trim binary floating-point noise (0.1 + 0.2) before showing the number.
  const trimmed = Number(value.toPrecision(12))
  return String(trimmed).replace('.', ',')
}

function App() {
  const [display, setDisplay] = useState('0')
  const [pending, setPending] = useState(null) // { value: number, symbol: string }
  const [overwrite, setOverwrite] = useState(true) // next digit starts a new number
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const clear = () => {
    setDisplay('0')
    setPending(null)
    setOverwrite(true)
    setError(null)
  }

  // After an error the next entry starts from scratch rather than resuming.
  const restartWith = (text) => {
    setError(null)
    setPending(null)
    setDisplay(text)
    setOverwrite(false)
  }

  const inputDigit = (digit) => {
    if (busy) return
    if (error) return restartWith(digit)

    if (overwrite) {
      setDisplay(digit)
      setOverwrite(false)
      return
    }
    setDisplay((current) => {
      if (current.replace(/[-,]/g, '').length >= MAX_DIGITS) return current
      return current === '0' ? digit : current + digit
    })
  }

  const inputComma = () => {
    if (busy) return
    if (error) return restartWith('0,')

    if (overwrite) {
      setDisplay('0,')
      setOverwrite(false)
      return
    }
    setDisplay((current) => (current.includes(',') ? current : current + ','))
  }

  // Runs the pending operation against what is currently on screen.
  const resolvePending = async () => {
    const result = await calculate(
      OPERATIONS[pending.symbol],
      pending.value,
      toNumber(display),
    )
    setDisplay(format(result))
    return result
  }

  const chooseOperation = async (symbol) => {
    if (error || busy) return

    // Pressing two operators in a row just swaps the pending one.
    if (pending && overwrite) {
      setPending({ ...pending, symbol })
      return
    }

    if (!pending) {
      setPending({ value: toNumber(display), symbol })
      setOverwrite(true)
      return
    }

    setBusy(true)
    try {
      const result = await resolvePending()
      setPending({ value: result, symbol })
      setOverwrite(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const equals = async () => {
    if (error || busy || !pending) return

    setBusy(true)
    try {
      await resolvePending()
      setPending(null)
      setOverwrite(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="calculator">
      <div className="screen" role="status" aria-live="polite">
        <div className="expression">
          {pending ? `${format(pending.value)} ${pending.symbol}` : ' '}
        </div>
        <div className={error ? 'value error' : 'value'}>
          {error ?? display}
        </div>
      </div>

      <div className="keypad">
        <button className="span-3 function" onClick={clear}>
          C
        </button>
        <button className="operator" onClick={() => chooseOperation('÷')}>
          ÷
        </button>

        {['7', '8', '9'].map((d) => (
          <button key={d} onClick={() => inputDigit(d)}>
            {d}
          </button>
        ))}
        <button className="operator" onClick={() => chooseOperation('×')}>
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
          onClick={() => chooseOperation('−')}
        >
          −
        </button>

        {['1', '2', '3'].map((d) => (
          <button key={d} onClick={() => inputDigit(d)}>
            {d}
          </button>
        ))}
        <button className="operator" onClick={() => chooseOperation('+')}>
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
