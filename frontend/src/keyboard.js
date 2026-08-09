// Maps a KeyboardEvent.key to a calculator action, or null if the key means
// nothing to us. Anything not listed here — letters included — is ignored.

const OPERATOR_KEYS = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
}

export function keyToAction(key) {
  if (/^[0-9]$/.test(key)) return { type: 'digit', value: key }
  if (key === ',' || key === '.') return { type: 'comma' }
  if (key in OPERATOR_KEYS) return { type: 'operator', value: OPERATOR_KEYS[key] }
  if (key === 'Enter' || key === '=') return { type: 'equals' }
  if (key === 'Backspace') return { type: 'backspace' }
  if (key === 'Escape' || key === 'Delete') return { type: 'clear' }
  return null
}
