// Thin client for the Go calculator API. In dev, Vite proxies /api to :8080.

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
    })
  } catch {
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
