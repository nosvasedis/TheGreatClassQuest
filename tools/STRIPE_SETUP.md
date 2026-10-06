# Card payments with Stripe: setup

How schools pay (prices before VAT; Greek VAT 24% is added at checkout):

| Plan | Monthly (charged Sept–June, summer free) | Yearly (school year, renews 1 September) |
|---|---|---|
| Starter | €19 | €150 |
| Pro | €35 | €280 |
| Elite | €49 | €390 |

- Monthly payments fall on the **1st**. Billing pauses automatically from 15 June to 15 August, so
  the 1 July and 1 August payments are skipped; the school keeps access all summer.
- Yearly renews every **1 September**. A school joining mid-year pays only for the rest of the
  school year (Stripe prorates it).
- A school that starts in July or August pays nothing until 1 September.
- Founding schools: a code for **20% off the first year**, usable by the first 5 schools.
- If a card keeps failing, Stripe retries for about two weeks; then the plan ends and the school
  is locked (its data is kept).
- The prices shown in the app live in `config/tiers/pricing.mjs`. Change both together.

**Invoices:** Stripe receipts are not Greek tax invoices. Issue the invoice through myDATA (ΑΑΔΕ),
with your accountant or invoicing app. Checkout collects the school's address and ΑΦΜ for it.

## Quick way: one command

1. In the Stripe dashboard (Test mode), Developers → API keys → reveal the **Secret key**.
2. In your own terminal, from the project folder:

   ```bash
   npm run stripe:setup
   ```

   Paste the key when asked (typing stays hidden). The script creates or reuses steps 1–3 and
   5–6 below, writes the ids to `functions/.env`, and stores the key and the webhook secret in
   Firebase Secret Manager. It never prints a secret, and running it again creates no duplicates.
3. Do step 4 below by hand (Stripe does not allow it through the API).
4. Deploy Functions (`npm run deploy:functions`) and test one purchase (step 10).
5. For real payments: repeat with your **live** key and `npm run stripe:setup -- --live`, then
   deploy Functions again.

**Important when only keys or ids changed:** Firebase skips functions whose code did not change,
so after `stripe:setup` force the payment functions to redeploy:

```bash
FUNCTIONS_DEPLOY_UNCHANGED=true npm run deploy:functions -- --only functions:billingCreateCheckout,functions:billingCreatePortal,functions:stripeWebhook,functions:stripeSummerPause,functions:opDeleteSchool
```

The manual steps below are the same thing done by hand.

## Manual way

Do everything first in **Test mode** (the toggle in the Stripe dashboard), test one purchase,
then repeat steps 1–7 in Live mode.

## 1. Tax rate
Product catalogue → **Tax rates** → New: name `ΦΠΑ`, percentage **24**, type **Exclusive**,
region Greece. Copy its id (`txr_…`).

## 2. Products and prices
Product catalogue → **Add product**, three times: `Starter`, `Pro`, `Elite`. Each gets **two**
recurring prices in EUR, tax behaviour **Exclusive**:

- Starter: €19 **monthly**, €150 **yearly**
- Pro: €35 **monthly**, €280 **yearly**
- Elite: €49 **monthly**, €390 **yearly**

Copy the six price ids (`price_…`).

## 3. Founding-schools code
Product catalogue → **Coupons** → New: **20%** off, duration **Repeating, 12 months**.
On the coupon → **Promotion codes** → New: code e.g. `FOUNDING20`, tick **Limit the number of
times this code can be redeemed** → **5**, and **Eligible for first-time orders only**.

## 4. Failed payments and emails
Settings → Billing → **Subscriptions and emails**:
- Smart Retries **on**, retry for up to **2 weeks**.
- If all retries for a payment fail: **Cancel the subscription**.
- Send emails about failed payments and expiring cards; send a reminder before **yearly** renewals.

## 5. Customer portal
Settings → Billing → **Customer portal**: allow updating the payment method, viewing invoices,
and cancelling **at the end of the billing period**. To let schools switch plan or between
monthly and yearly themselves, add the three products with both prices.

## 6. Webhook
Developers → **Webhooks** → Add endpoint:
`https://europe-west1-the-great-class-quest.cloudfunctions.net/stripeWebhook`
Events: `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`. Copy its **signing secret** (`whsec_…`).

## 7. Secret key
Developers → **API keys**. Best: create a **restricted key** with write access to Customers,
Checkout Sessions, Subscriptions and Customer portal, and read access to Prices.

## 8. Give the keys to Firebase (you type them; they never go in a file)
From the project folder:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
```
```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

## 9. Switch it on
Copy `functions/.env.example` to `functions/.env`, set `GCQ_ENABLE_STRIPE=true`, and paste the six
price ids and the tax rate id. Then deploy Functions:

```bash
npm run deploy:functions
```

## 10. Test
With Test-mode keys: create a test school in `#operator` (plan **Pending**), sign in as its
Secretary, choose a plan and pay with card `4242 4242 4242 4242` (any future date, any CVC).
Within a minute the school unlocks with that plan. Try the founding code too. When all is well,
repeat steps 1–7 in Live mode, run step 8 again with the live keys, update `functions/.env`
with the live ids, and deploy again.
