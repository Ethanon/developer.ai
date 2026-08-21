export const config = {
  stripeKey: process.env.STRIPE_KEY ?? 'sk_test_51H8xQ2eZvKYlo2CjkLmNoPqRsTuV',
  dbUrl: process.env.DATABASE_URL ?? 'postgres://localhost:5432/billing',
  ratesApi: 'https://api.exchangeratesapi.io/latest',
}
