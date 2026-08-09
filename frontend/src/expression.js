// Parsing and evaluation. Every arithmetic step is delegated to the Go API —
// this module only decides which steps run, and in what order.

import { calculate, calculateUnary } from './api'

// Display symbol -> backend endpoint name.
export const OPERATIONS = {
  '+': 'add',
  '−': 'subtract',
  '×': 'multiply',
  '÷': 'divide',
  '^': 'power',
}

// Higher binds tighter. Exponentiation is right-associative; the rest are left.
export const PRECEDENCE = {
  '+': 1,
  '−': 1,
  '×': 2,
  '÷': 2,
  '^': 3,
}

export const isOperator = (char) => char in PRECEDENCE

// Characters that can legally end an operand — a digit, a closing group, or a
// percent sign. Used by the input rules to decide what may follow.
export const endsValue = (char) => /[0-9)%]/.test(char ?? '')

// The number currently being typed: the trailing run of digits and commas.
export const currentSegment = (expression) => expression.match(/[0-9,]*$/)[0]

// The UI uses a comma as the decimal separator; JS numbers use a dot.
export const toNumber = (text) => Number(text.replace(',', '.'))

export const format = (value) => {
  // Trim binary floating-point noise (0.1 + 0.2) before showing the number.
  const trimmed = Number(value.toPrecision(12))
  return String(trimmed).replace('.', ',')
}

export const openGroups = (expression) =>
  [...expression].reduce(
    (depth, char) =>
      char === '(' ? depth + 1 : char === ')' ? depth - 1 : depth,
    0,
  )

// ---------------------------------------------------------------------------
// Tokenizer

export function tokenize(expression) {
  const tokens = []
  let i = 0

  while (i < expression.length) {
    const char = expression[i]

    if (/[0-9,]/.test(char)) {
      let text = ''
      while (i < expression.length && /[0-9,]/.test(expression[i])) {
        text += expression[i]
        i++
      }
      tokens.push({ type: 'number', text })
      continue
    }

    if (isOperator(char)) tokens.push({ type: 'operator', value: char })
    else if (char === '(') tokens.push({ type: 'open' })
    else if (char === ')') tokens.push({ type: 'close' })
    else if (char === '√') tokens.push({ type: 'sqrt' })
    else if (char === '%') tokens.push({ type: 'percent' })
    else throw new Error(`unexpected character "${char}"`)

    i++
  }

  return tokens
}

// ---------------------------------------------------------------------------
// Parser
//
//   expression := term (('+' | '−') term)*
//   term       := power (('×' | '÷') power)*
//   power      := unary ('^' power)?        -- right-associative
//   unary      := '√' unary | postfix
//   postfix    := primary '%'*
//   primary    := number | '(' expression ')'

export function parse(tokens) {
  let pos = 0
  const peek = () => tokens[pos]

  const parseExpression = () => parseBinary(1)

  // One function for both left-associative levels, driven by precedence.
  function parseBinary(level) {
    if (level > 2) return parsePower()

    let left = parseBinary(level + 1)
    while (peek()?.type === 'operator' && PRECEDENCE[peek().value] === level) {
      const op = tokens[pos++].value
      const right = parseBinary(level + 1)
      left = { type: 'binary', op, left, right }
    }
    return left
  }

  function parsePower() {
    const base = parseUnary()
    if (peek()?.type === 'operator' && peek().value === '^') {
      pos++
      return { type: 'binary', op: '^', left: base, right: parsePower() }
    }
    return base
  }

  function parseUnary() {
    if (peek()?.type === 'sqrt') {
      pos++
      return { type: 'sqrt', operand: parseUnary() }
    }
    return parsePostfix()
  }

  function parsePostfix() {
    let node = parsePrimary()
    while (peek()?.type === 'percent') {
      pos++
      node = { type: 'percent', operand: node }
    }
    return node
  }

  function parsePrimary() {
    const token = peek()
    if (!token) throw new Error('incomplete expression')

    if (token.type === 'number') {
      pos++
      return { type: 'number', text: token.text }
    }

    if (token.type === 'open') {
      pos++
      const inner = parseExpression()
      if (peek()?.type !== 'close') throw new Error('missing closing parenthesis')
      pos++
      return inner
    }

    if (token.type === 'close') throw new Error('empty parentheses')
    throw new Error('incomplete expression')
  }

  const ast = parseExpression()
  if (pos < tokens.length) {
    if (peek().type === 'close') throw new Error('unmatched closing parenthesis')
    throw new Error('incomplete expression')
  }
  return ast
}

// ---------------------------------------------------------------------------
// Evaluation

async function evaluateNode(node) {
  switch (node.type) {
    case 'number':
      return toNumber(node.text)

    case 'sqrt':
      return calculateUnary('sqrt', await evaluateNode(node.operand))

    // A percent on its own is just "divide by 100".
    case 'percent':
      return calculate('divide', await evaluateNode(node.operand), 100)

    case 'binary': {
      const left = await evaluateNode(node.left)
      return calculate(OPERATIONS[node.op], left, await rightOperand(node, left))
    }

    default:
      throw new Error('incomplete expression')
  }
}

// Percent is context-aware, the way a pocket calculator behaves:
//   "50+10%" is 10% *of 50*, so it adds 5;
//   "200×15%" is a plain fraction, so it multiplies by 0.15.
async function rightOperand(node, left) {
  if (node.right.type !== 'percent') return evaluateNode(node.right)

  const base = await evaluateNode(node.right.operand)
  const fraction = await calculate('divide', base, 100)

  if (node.op === '+' || node.op === '−') {
    return calculate('multiply', left, fraction)
  }
  return fraction
}

export async function evaluate(expression) {
  return evaluateNode(parse(tokenize(expression)))
}
