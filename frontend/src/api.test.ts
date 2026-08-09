import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calculate, calculateUnary, REQUEST_TIMEOUT_MS } from './api'

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

const mockFetch = vi.fn<typeof fetch>()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('request shape', () => {
  it('posts both operands to the named endpoint', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ result: 5 }))
    await expect(calculate('add', 2, 3)).resolves.toBe(5)

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/add')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ a: 2, b: 3 }))
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
  })

  it('posts a single operand for unary operations', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ result: 3 }))
    await expect(calculateUnary('sqrt', 9)).resolves.toBe(3)

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/sqrt')
    expect(init?.body).toBe(JSON.stringify({ a: 9 }))
  })

  it('attaches an abort signal so a request cannot hang forever', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ result: 1 }))
    await calculate('add', 1, 0)

    const signal = mockFetch.mock.calls[0][1]?.signal
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal?.aborted).toBe(false)
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThan(0)
  })
})

describe('failures', () => {
  it('surfaces the error message the server sent', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: 'division by zero' }, { status: 422 }),
    )
    await expect(calculate('divide', 1, 0)).rejects.toThrow('division by zero')
  })

  it('falls back to the status code when there is no error body', async () => {
    mockFetch.mockResolvedValue(new Response('boom', { status: 500 }))
    await expect(calculate('add', 1, 2)).rejects.toThrow('request failed (500)')
  })

  it('rejects a 200 that carries no numeric result', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }))
    await expect(calculate('add', 1, 2)).rejects.toThrow(
      'malformed response from the server',
    )
  })

  it('reports an unreachable server', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(calculate('add', 1, 2)).rejects.toThrow('cannot reach the server')
  })

  it('reports a timeout differently from a network failure', async () => {
    mockFetch.mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    await expect(calculate('add', 1, 2)).rejects.toThrow(
      'the server took too long to respond',
    )
  })

  // The mapping above assumes what the platform does on a timed-out signal.
  // Pin that assumption rather than the 10s wait itself.
  it('aborts with a TimeoutError, which is what the mapping keys off', async () => {
    const signal = AbortSignal.timeout(1)
    await new Promise((resolve) =>
      signal.addEventListener('abort', resolve, { once: true }),
    )
    expect(signal.aborted).toBe(true)
    expect((signal.reason as { name?: string }).name).toBe('TimeoutError')
  })
})
