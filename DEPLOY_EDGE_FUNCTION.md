# Edge Function Deployment Guide

## Option 1: Via Supabase Dashboard (Einfachste Methode)

1. Öffne: https://supabase.com/dashboard/project/gevqwporirhaekapftib
2. Gehe zu: **Edge Functions** (linkes Menü)
3. Klicke: **"Create a new function"**
4. Name: `generate-palette`
5. Kopiere den Code aus: `supabase/functions/generate-palette/index.ts`
6. Füge ihn in den Editor ein
7. Klicke: **Deploy**

### Environment Variables setzen:
- Gehe zu: **Settings** → **Edge Functions** → **Secrets**
- Füge hinzu:
  - `OPENAI_API_KEY` = dein OpenAI API Key
  - (SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY sollten automatisch gesetzt sein)

## Option 2: Via Supabase CLI (mit Scoop)

### Scoop installieren (falls nicht vorhanden):
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
```

### Supabase CLI installieren:
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Projekt verknüpfen:
```powershell
supabase login
supabase link --project-ref gevqwporirhaekapftib
```

### Edge Function deployen:
```powershell
supabase functions deploy generate-palette
```

### Secrets setzen:
```powershell
supabase secrets set OPENAI_API_KEY=dein-api-key
```

