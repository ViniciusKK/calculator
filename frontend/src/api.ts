// Thin client for the Go calculator API. In dev, Vite proxies /api to :8080.

// A single arithmetic step should be near-instant; anything slower means the
// server is wedged or unreachable, and the UI needs to say so rather than
// sitting on a spinner forever.
export const REQUEST_TIMEOUT_MS = 10_000

type ApiResponse = {
  result?: number
  error?: string
}

async function post(operation: string, body: Record<string, number>): Promise<number> {
  let res: Response
  try {
    res = await fetch(`/api/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    // An aborted fetch rejects with a DOMException, which does not extend Error
    // everywhere, so match on the name rather than the class.
    if ((err as { name?: string } | null)?.name === 'TimeoutError') {
      throw new Error('the server took too long to respond')
    }
    throw new Error('cannot reach the server')
  }

  const data = (await res.json().catch(() => null)) as ApiResponse | null
  if (!res.ok) {
    throw new Error(data?.error ?? `request failed (${res.status})`)
  }
  // A 200 without a numeric result would have thrown a TypeError before; the
  // types made the case explicit, so it now reports itself properly.
  if (typeof data?.result !== 'number') {
    throw new Error('malformed response from the server')
  }
  return data.result
}

export const calculate = (operation: string, a: number, b: number) =>
  post(operation, { a, b })

export const calculateUnary = (operation: string, a: number) => post(operation, { a })
