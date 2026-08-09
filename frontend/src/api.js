// Thin client for the Go calculator API. In dev, Vite proxies /api to :8080.

async function post(operation, body) {
  let res
  try {
    res = await fetch(`/api/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('cannot reach the server')
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error ?? `request failed (${res.status})`)
  }
  return data.result
}

export const calculate = (operation, a, b) => post(operation, { a, b })

export const calculateUnary = (operation, a) => post(operation, { a })
