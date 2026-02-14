# Colored In

A beautiful color palette generator and browser for creative professionals.

## Chrome Extension installieren (wichtig)

Wenn du die Extension in Chrome laden willst, nutze **genau diesen Ordner**:
`Chrome Extension Colored-In`

### Schritt-für-Schritt

1. Auf GitHub auf `Code` klicken und `Download ZIP` wählen.
2. ZIP entpacken.
3. In Chrome `chrome://extensions` öffnen.
4. Oben rechts `Developer mode` aktivieren.
5. `Load unpacked` klicken.
6. Den entpackten Ordner `Chrome Extension Colored-In` auswählen (nicht den gesamten Repo-Root).
7. Danach erscheint die Extension in Chrome und kann verwendet werden.

### Nach Updates

Wenn du neue Änderungen aus GitHub ziehst, in `chrome://extensions` bei der Extension auf `Reload` klicken.

## Local development

```sh
npm i
npm run dev
```

The dev server runs on `http://localhost:8080` (see `vite.config.ts`).

## Environment variables

Copy `env.example` to a local file `.env.local` (not committed) and fill in your credentials.

### Required Variables

```env
# Supabase
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_ANON_KEY

# Stripe (for payments)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
```

Restart `npm run dev` after changing env vars (Vite only loads them on startup).

## Stripe Setup

### 1. Create Stripe Products and Prices

In your [Stripe Dashboard](https://dashboard.stripe.com/products):

1. Create three products: **Pro**, **Ultra**, **Individual**
2. For each product, create a **monthly recurring price**:
   - Pro: €2.99/month
   - Ultra: €5.99/month
   - Individual: €15.99/month
3. Copy the Price IDs (e.g., `price_1ABC123...`)

### 2. Configure Edge Function Secrets

In Supabase Dashboard → Project Settings → Edge Functions → Secrets:

| Secret Name | Value |
|-------------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_...` (from Stripe Dashboard) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (created in step 3) |
| `STRIPE_PRICE_PRO` | Price ID for Pro plan |
| `STRIPE_PRICE_ULTRA` | Price ID for Ultra plan |
| `STRIPE_PRICE_INDIVIDUAL` | Price ID for Individual plan |

### 3. Set Up Webhook

In Stripe Dashboard → Developers → Webhooks:

1. Add endpoint: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
2. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
3. Copy the signing secret and add it as `STRIPE_WEBHOOK_SECRET`

### 4. Deploy Edge Functions

```sh
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
```

## Database Migrations

Run migrations to set up the database schema:

```sh
supabase db push
```

## GitHub Pages deployment

This repo deploys via GitHub Actions to GitHub Pages.

Add these repository secrets in:
`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`

## Testing Payments

Use Stripe test cards for development:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

See [Stripe Testing Docs](https://stripe.com/docs/testing) for more test cards.

## Pro Manual Builder (paid plans)

- The upgraded Canva-style manual builder is available to paid plans (Pro, Ultra, Individual).
- Access it via `Dashboard → Generate Palette` (paid users are routed to the new builder; free users keep the classic generator with an upgrade CTA).
- Shortcuts: `Space` regenerate, `L` lock/unlock selected color, `C` copy selected color.
