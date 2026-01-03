# Edge Functions Setup & Troubleshooting 🔧

## Quick Fix for "Edge Function returned a non-2xx status code"

### Step 1: Set OpenAI API Key

The most common cause is a missing OpenAI API key. Set it in Supabase:

**Option A: Via Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Edge Functions** (left sidebar)
4. Click **Secrets** tab
5. Add new secret:
   - Name: `OPENAI_API_KEY`
   - Value: `sk-proj-...` (your OpenAI API key)
6. Click **Save**

**Option B: Via Supabase CLI**
```bash
supabase secrets set OPENAI_API_KEY=sk-proj-YOUR-KEY-HERE
```

### Step 2: Get Your OpenAI API Key

If you don't have one:
1. Go to https://platform.openai.com/api-keys
2. Click **"+ Create new secret key"**
3. Name it "Colored In Production"
4. Copy the key (starts with `sk-proj-...`)
5. Add billing info if needed (pay-as-you-go)

### Step 3: Deploy Edge Functions

After setting the secret, redeploy the functions:

```bash
cd D:\colored-in-main
supabase functions deploy ask-chat
supabase functions deploy generate-palette
```

### Step 4: Verify Setup

Test the chat function locally:

```bash
# Start local Supabase
supabase start

# Set local secret
supabase secrets set OPENAI_API_KEY=sk-proj-... --local

# Serve function locally
supabase functions serve ask-chat

# In another terminal, test it
curl -X POST http://localhost:54321/functions/v1/ask-chat \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is Colored In?", "paletteContext": []}'
```

---

## Debugging Checklist

### ✅ Authentication Working?
```bash
# Check if user is logged in
supabase auth get-session
```

If not logged in → User needs to sign in

### ✅ Plan Access Correct?
```sql
-- Check user's plan in Supabase SQL Editor
SELECT plan, is_active FROM user_subscriptions WHERE user_id = 'USER_ID';
```

- Free plan: NO chat access (expected error)
- Pro+: Chat should work

### ✅ Usage Limits Not Exceeded?
```sql
-- Check usage in Supabase SQL Editor
SELECT 
  chat_messages_count,
  chat_messages_reset_at
FROM user_ai_usage 
WHERE user_id = 'USER_ID';
```

If limit reached → User needs to upgrade or wait for reset

### ✅ Database Tables Exist?
Check these tables exist in Supabase:
- `user_ai_usage`
- `user_chat_history`
- `user_settings`
- `user_subscriptions`

If missing → Run migrations:
```bash
supabase db push
```

### ✅ RLS Policies Correct?
```sql
-- Check RLS policies in Supabase SQL Editor
SELECT * FROM pg_policies WHERE tablename IN (
  'user_ai_usage',
  'user_chat_history',
  'user_settings',
  'user_subscriptions'
);
```

---

## View Edge Function Logs

**Real-time logs:**
```bash
supabase functions logs ask-chat --follow
```

**Recent logs:**
```bash
supabase functions logs ask-chat --limit 50
```

**Look for:**
- ❌ `OPENAI_API_KEY not configured` → Set the secret
- ❌ `Invalid authentication` → User not logged in
- ❌ `You need a Pro plan` → Free user trying to use chat
- ❌ `limit reached` → Usage limits exceeded
- ❌ `OpenAI API error` → Check OpenAI billing/quota

---

## Common Errors & Solutions

### Error: "Service temporarily unavailable"
**Cause**: OpenAI API key missing or invalid  
**Fix**: Set `OPENAI_API_KEY` in Supabase secrets

### Error: "You need a Pro plan to use Ask Mode"
**Cause**: User has Free plan  
**Fix**: Expected behavior. Use DEV tool in Settings to grant Ultra plan for testing:
1. Ensure `import.meta.env.DEV` is true (running `npm run dev`)
2. Go to Settings page
3. Click "Grant ULTRA (30 days)" in DEV Tools section

### Error: "You've reached your monthly chat limit"
**Cause**: User exceeded plan's chat message limit  
**Fix**: 
- **Testing**: Reset usage manually in Supabase SQL Editor:
  ```sql
  UPDATE user_ai_usage 
  SET chat_messages_count = 0, 
      chat_messages_reset_at = NOW()
  WHERE user_id = 'USER_ID';
  ```
- **Production**: User needs to upgrade plan

### Error: "Authentication required"
**Cause**: User not logged in or session expired  
**Fix**: Sign in again

### Error: "Invalid palette context"
**Cause**: Frontend sending malformed palette data  
**Fix**: Check browser console, ensure palette is array of hex colors

---

## Production Checklist

Before launching to users:

- [x] OpenAI API key set in Supabase secrets
- [x] Stripe keys configured (for payments)
- [x] All migrations applied (`supabase db push`)
- [x] Edge functions deployed
- [x] RLS policies enabled
- [x] Usage limits tested
- [x] Plan upgrades working
- [ ] **Test with real user account (not DEV mode)**
- [ ] **Verify billing/payment flow**
- [ ] **Set up monitoring/alerts for Edge Function errors**

---

## Cost Optimization

### OpenAI API Costs

**Chat (ask-chat function)**:
- Model: `gpt-4o-mini`
- Cost: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Average cost per message: ~$0.0003 (0.03 cents)

**Palette Generation (generate-palette function)**:
- Model: `gpt-4o-mini`
- Cost: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Average cost per palette: ~$0.0005 (0.05 cents)

**Monthly Estimates**:
- Pro user (30 chat + 50 palettes): ~$0.03/month
- Ultra user (100 chat + 500 palettes): ~$0.06/month
- Individual user (300 chat + 2500 palettes): ~$0.22/month

**Revenue vs Cost**:
- Pro plan: $2.99/month - $0.03 = $2.96 profit
- Ultra plan: $5.99/month - $0.06 = $5.93 profit
- Individual plan: $15.99/month - $0.22 = $15.77 profit

✅ **OpenAI costs are negligible compared to revenue**

### Supabase Costs
- Free tier: 500MB database, 1GB storage, 2GB transfer
- Pro tier: $25/month (if needed)
- Estimated usage: Well within free tier for < 1000 users

---

## Testing the Full Flow

1. **Sign Up**: Create test account
2. **Free Plan**: Try chat → Should show "You need a Pro plan" ✅
3. **Grant Ultra** (DEV mode): Click button in Settings
4. **Try Chat**: Ask "What is Colored In?" → Should get AI response ✅
5. **Check Usage**: Go to Dashboard → Should show "1/100 chat messages" ✅
6. **Generate Palette**: Try AI palette generation → Should work ✅
7. **Save Palette**: Open Manual Builder → Create → Save → Should work ✅
8. **Upload Asset**: Try image upload → Should work ✅

---

## Support & Help

If you're still having issues:

1. Check Supabase Dashboard → Logs
2. Check browser console for errors
3. Run `supabase functions logs ask-chat --follow` in terminal
4. Verify OpenAI API key is valid at https://platform.openai.com/api-keys
5. Check OpenAI billing at https://platform.openai.com/usage

**Most issues are solved by setting the OpenAI API key correctly! 🔑**

