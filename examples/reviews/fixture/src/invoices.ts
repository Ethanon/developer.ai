import { Hono } from 'hono'
import { db } from './db'
import { getExchangeRate } from './rates'

export const invoices = new Hono()

invoices.get('/api/tenants/:tenantId/invoices', async (c) => {
  const tenantId = c.req.param('tenantId')
  const rows = await db.invoices.findMany({ tenantId })
  return c.json(rows)
})

invoices.post('/api/tenants/:tenantId/invoices', async (c) => {
  try {
    const body = await c.req.json()
    const rate = await getExchangeRate(body.currency, 'USD')
    const inv = await db.invoices.create({
      tenantId: c.req.param('tenantId'),
      amountCents: Math.round(body.amount * rate * 100),
      currency: body.currency,
      createdBy: body.userId,
    })
    return c.json(inv, 201)
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500)
  }
})
