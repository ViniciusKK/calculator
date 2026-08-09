import { describe, expect, it } from 'vitest'
import { keyToAction } from './keyboard'

describe('keyToAction', () => {
  it('maps every digit', () => {
    for (const d of '0123456789') {
      expect(keyToAction(d)).toEqual({ type: 'digit', value: d })
    }
  })

  it('maps both decimal separators to a comma', () => {
    expect(keyToAction(',')).toEqual({ type: 'comma' })
    expect(keyToAction('.')).toEqual({ type: 'comma' })
  })

  it('maps operator keys to display symbols', () => {
    expect(keyToAction('+')).toEqual({ type: 'operator', value: '+' })
    expect(keyToAction('-')).toEqual({ type: 'operator', value: '−' })
    expect(keyToAction('*')).toEqual({ type: 'operator', value: '×' })
    expect(keyToAction('/')).toEqual({ type: 'operator', value: '÷' })
    expect(keyToAction('^')).toEqual({ type: 'operator', value: '^' })
  })

  it('maps parentheses, percent and the root sign', () => {
    expect(keyToAction('(')).toEqual({ type: 'openParen' })
    expect(keyToAction(')')).toEqual({ type: 'closeParen' })
    expect(keyToAction('%')).toEqual({ type: 'percent' })
    expect(keyToAction('√')).toEqual({ type: 'sqrt' })
  })

  it('maps the control keys', () => {
    expect(keyToAction('Enter')).toEqual({ type: 'equals' })
    expect(keyToAction('=')).toEqual({ type: 'equals' })
    expect(keyToAction('Backspace')).toEqual({ type: 'backspace' })
    expect(keyToAction('Escape')).toEqual({ type: 'clear' })
    expect(keyToAction('Delete')).toEqual({ type: 'clear' })
  })

  it('ignores every letter, upper and lower case', () => {
    for (let code = 65; code <= 90; code++) {
      const upper = String.fromCharCode(code)
      expect(keyToAction(upper), `key ${upper}`).toBeNull()
      expect(keyToAction(upper.toLowerCase()), `key ${upper.toLowerCase()}`).toBeNull()
    }
  })

  it('ignores punctuation, whitespace and other keys', () => {
    const ignored = [
      ' ',
      ';',
      ':',
      '!',
      '?',
      '@',
      '#',
      '$',
      '&',
      '[',
      ']',
      '{',
      '}',
      '<',
      '>',
      '|',
      '\\',
      '"',
      "'",
      '`',
      '~',
      '_',
      'Tab',
      'Shift',
      'ArrowLeft',
      'ArrowUp',
      'F5',
      'CapsLock',
      'Home',
      'é',
      'ç',
      'ã',
      '½',
      '€',
    ]
    for (const key of ignored) {
      expect(keyToAction(key), `key ${key}`).toBeNull()
    }
  })
})
