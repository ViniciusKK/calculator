// Maps a KeyboardEvent.key to a calculator action, or null if the key means
// nothing to us. Anything not listed here — letters included — is ignored.

const OPERATOR_KEYS = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
  '^': '^',
}

const SIMPLE_KEYS = {
  ',': 'comma',
  '.': 'comma',
  '(': 'openParen',
  ')': 'closeParen',
  '%': 'percent',
  '√': 'sqrt', // no ASCII key for this; the keypad button is the usual route
  Backspace: 'backspace',
  Escape: 'clear',
  Delete: 'clear',
}

export function keyToAction(key) {
  if (/^[0-9]$/.test(key)) return { type: 'digit', value: key }
  if (key in OPERATOR_KEYS) return { type: 'operator', value: OPERATOR_KEYS[key] }
  if (key in SIMPLE_KEYS) return { type: SIMPLE_KEYS[key] }
  if (key === 'Enter' || key === '=') return { type: 'equals' }
  return null
}
