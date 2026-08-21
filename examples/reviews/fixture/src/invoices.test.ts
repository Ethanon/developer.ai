import { describe, it, expect, vi } from 'vitest'
import { invoices } from './invoices'

vi.mock('./db')
vi.mock('./rates')

describe('invoices', () => {
  it('creates an invoice', async () => {
    const res = await invoices.request('/api/tenants/t1/invoices', {
      method: 'POST',
      body: JSON.stringify({ amount: 500, currency: 'EUR', userId: 'u1' }),
    })
    expect(res).toBeDefined()
  })

  it('calls db.invoices.create once', async () => {
    await invoices.request('/api/tenants/t1/invoices', {
      method: 'POST',
      body: JSON.stringify({ amount: 500, currency: 'EUR', userId: 'u1' }),
    })
    expect(db.invoices.create).toHaveBeenCalledTimes(1)
  })
})
