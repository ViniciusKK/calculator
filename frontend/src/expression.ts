// Parsing and evaluation. Every arithmetic step is delegated to the Go API —
// this module only decides which steps run, and in what order.

import { calculate, calculateUnary } from './api'

export type BinaryOp = '+' | '−' | '×' | '÷' | '^'

// Display symbol -> backend endpoint name.
export const OPERATIONS: Record<BinaryOp, string> = {
  '+': 'add',
  '−': 'subtract',
  '×': 'multiply',
  '÷': 'divide',
  '^': 'power',
}

// Higher binds tighter. Exponentiation is right-associative; the rest are left.
export const PRECEDENCE: Record<BinaryOp, number> = {
  '+': 1,
  '−': 1,
  '×': 2,
  '÷': 2,
  '^': 3,
}

export const isOperator = (char: string): char is BinaryOp => char in PRECEDENCE

// Characters that can legally end an operand — a digit, a closing group, or a
// percent sign. Used by the input rules to decide what may follow.
export const endsValue = (char: string | undefined): boolean =>
  /[0-9)%]/.test(char ?? '')

// The number currently being typed: the trailing run of digits and commas.
export const currentSegment = (expression: string): string =>
  expression.match(/[0-9,]*$/)?.[0] ?? ''

// The UI uses a comma as the decimal separator; JS numbers use a dot.
export const toNumber = (text: string): number => Number(text.replace(',', '.'))

export const format = (value: number): string => {
  // Trim binary floating-point noise (0.1 + 0.2) before showing the number.
  const trimmed = Number(value.toPrecision(12))
  return String(trimmed).replace('.', ',')
}

export const openGroups = (expression: string): number =>
  [...expression].reduce(
    (depth, char) => (char === '(' ? depth + 1 : char === ')' ? depth - 1 : depth),
    0,
  )

// ---------------------------------------------------------------------------
// Tokenizer

export type Token =
  | { type: 'number'; text: string }
  | { type: 'operator'; value: BinaryOp }
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'sqrt' }
  | { type: 'percent' }

export function tokenize(expression: string): Token[] {
  const tokens: Token[] = []
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

export type Node =
  | { type: 'number'; text: string }
  | { type: 'sqrt'; operand: Node }
  | { type: 'percent'; operand: Node }
  | { type: 'binary'; op: BinaryOp; left: Node; right: Node }

export type BinaryNode = Extract<Node, { type: 'binary' }>

export function parse(tokens: Token[]): Node {
  let pos = 0
  const peek = (): Token | undefined => tokens[pos]

  const parseExpression = (): Node => parseBinary(1)

  // One function for both left-associative levels, driven by precedence.
  function parseBinary(level: number): Node {
    if (level > 2) return parsePower()

    let left = parseBinary(level + 1)
    for (;;) {
      const token = peek()
      if (token?.type !== 'operator' || PRECEDENCE[token.value] !== level) {
        break
      }
      pos++
      const right = parseBinary(level + 1)
      left = { type: 'binary', op: token.value, left, right }
    }
    return left
  }

  function parsePower(): Node {
    const base = parseUnary()
    const token = peek()
    if (token?.type === 'operator' && token.value === '^') {
      pos++
      return { type: 'binary', op: '^', left: base, right: parsePower() }
    }
    return base
  }

  function parseUnary(): Node {
    if (peek()?.type === 'sqrt') {
      pos++
      return { type: 'sqrt', operand: parseUnary() }
    }
    return parsePostfix()
  }

  function parsePostfix(): Node {
    let node = parsePrimary()
    while (peek()?.type === 'percent') {
      pos++
      node = { type: 'percent', operand: node }
    }
    return node
  }

  function parsePrimary(): Node {
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
  const trailing = peek()
  if (trailing) {
    if (trailing.type === 'close') throw new Error('unmatched closing parenthesis')
    throw new Error('incomplete expression')
  }
  return ast
}

// ---------------------------------------------------------------------------
// Evaluation

async function evaluateNode(node: Node): Promise<number> {
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

    default: {
      // The parser only produces the cases above; this keeps it that way.
      const unreachable: never = node
      throw new Error(`unexpected node ${JSON.stringify(unreachable)}`)
    }
  }
}

// Percent is context-aware, the way a pocket calculator behaves:
//   "50+10%" is 10% *of 50*, so it adds 5;
//   "200×15%" is a plain fraction, so it multiplies by 0.15.
async function rightOperand(node: BinaryNode, left: number): Promise<number> {
  if (node.right.type !== 'percent') return evaluateNode(node.right)

  const base = await evaluateNode(node.right.operand)
  const fraction = await calculate('divide', base, 100)

  if (node.op === '+' || node.op === '−') {
    return calculate('multiply', left, fraction)
  }
  return fraction
}

export async function evaluate(expression: string): Promise<number> {
  return evaluateNode(parse(tokenize(expression)))
}
