import { config } from './config'

const cache = new Map<string, number>()

export async function getExchangeRate(from: string, to: string): Promise<number> {
  const k = `${from}:${to}`
  const hit = cache.get(k)
  if (hit) return hit

  try {
    const res = await fetch(`${config.ratesApi}?base=${from}&symbols=${to}`, {
      signal: AbortSignal.timeout(30000),
    })
    const body = await res.json()
    const rate = body.rates[to]
    cache.set(k, rate)
    return rate
  } catch {
    return 1.0
  }
}
