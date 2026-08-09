// Pins the frontend↔backend contract against the real Go server.
//
// Every other suite mocks ./api, so a renamed endpoint on either side would go
// unnoticed: the mocks would keep answering to the old names. This one boots
// the actual binary and checks that each operation name the frontend sends is
// one the server implements.

import { execFile, spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { OPERATIONS } from './expression'

const execFileAsync = promisify(execFile)

const backendDir = fileURLToPath(new URL('../../backend', import.meta.url))

// The one unary operation. `evaluate` calls calculateUnary('sqrt', x) directly
// rather than going through the OPERATIONS map.
const UNARY_OPERATION = 'sqrt'

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (typeof address === 'string' || address === null) {
        reject(new Error('could not determine a free port'))
        return
      }
      const { port } = address
      probe.close(() => resolve(port))
    })
  })

let baseUrl: string
let server: ReturnType<typeof spawn>
let buildDir: string

beforeAll(async () => {
  // Build first and run the binary directly: `go run` leaves an orphaned child
  // behind when the parent is killed.
  buildDir = await mkdtemp(join(tmpdir(), 'calc-contract-'))
  const binary = join(buildDir, 'server')
  await execFileAsync('go', ['build', '-o', binary, './cmd/server'], {
    cwd: backendDir,
  })

  const port = await freePort()
  baseUrl = `http://127.0.0.1:${port}`
  server = spawn(binary, { env: { ...process.env, PORT: String(port) } })
  server.on('error', (err) => {
    throw new Error(`could not start the server: ${err.message}`)
  })

  const deadline = Date.now() + 30_000
  for (;;) {
    try {
      const res = await fetch(`${baseUrl}/health`)
      if (res.ok) break
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) throw new Error('server never became healthy')
    await new Promise((r) => setTimeout(r, 100))
  }
})

afterAll(async () => {
  server?.kill('SIGTERM')
  if (buildDir) await rm(buildDir, { recursive: true, force: true })
})

const post = (operation: string, body: Record<string, number>) =>
  fetch(`${baseUrl}/api/${operation}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('operation names the frontend sends', () => {
  it('covers every display symbol', () => {
    // Guards against a symbol being added to the UI without an endpoint name.
    expect(Object.keys(OPERATIONS).sort()).toEqual(['+', '^', '×', '÷', '−'].sort())
  })

  it.each(Object.entries(OPERATIONS))(
    '"%s" maps to /api/%s, which the server implements',
    async (_symbol, operation) => {
      const res = await post(operation, { a: 8, b: 2 })
      expect(
        res.status,
        `POST /api/${operation} — the Go server does not implement this name`,
      ).toBe(200)

      const body = (await res.json()) as { op: string; result: number }
      expect(body.op).toBe(operation)
      expect(typeof body.result).toBe('number')
    },
  )

  it(`"${UNARY_OPERATION}" maps to a unary endpoint taking only "a"`, async () => {
    const res = await fetch(`${baseUrl}/api/${UNARY_OPERATION}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 9 }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { op: string; result: number }
    expect(body.op).toBe(UNARY_OPERATION)
    expect(body.result).toBe(3)
  })
})

describe('the arithmetic each name actually performs', () => {
  // A name existing is not enough: /api/subtract must subtract.
  it.each([
    ['add', 8, 2, 10],
    ['subtract', 8, 2, 6],
    ['multiply', 8, 2, 16],
    ['divide', 8, 2, 4],
    ['power', 8, 2, 64],
  ])('%s(%d, %d) = %d', async (operation, a, b, want) => {
    const res = await post(operation, { a, b })
    const body = (await res.json()) as { result: number }
    expect(body.result).toBe(want)
  })
})

describe('error contract', () => {
  it('reports division by zero as a 422 with a message the UI shows verbatim', async () => {
    const res = await post('divide', { a: 1, b: 0 })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'division by zero' })
  })

  it('reports a negative root as a 422', async () => {
    const res = await fetch(`${baseUrl}/api/sqrt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: -1 }),
    })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      error: 'square root of a negative number',
    })
  })

  it('rejects an unknown operation name rather than silently succeeding', async () => {
    const res = await post('modulo', { a: 8, b: 2 })
    expect(res.status).toBe(404)
  })
})
