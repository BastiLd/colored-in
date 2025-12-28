# Colored In

A beautiful color palette generator and browser for creative professionals.

## Local development

```sh
npm i
npm run dev
```

The dev server runs on `http://localhost:8080` (see `vite.config.ts`).

## Environment variables (Supabase)

Create a local file `.env.local` (not committed) with:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_ANON_KEY
```

Restart `npm run dev` after changing env vars (Vite only loads them on startup).

## GitHub Pages deployment

This repo deploys via GitHub Actions to GitHub Pages.

Add these repository secrets in:
`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
