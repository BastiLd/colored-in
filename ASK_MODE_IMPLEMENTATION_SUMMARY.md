# Ask Mode Chat Implementation - Complete ✅

## Summary

Successfully implemented a full-featured AI chat system ("Ask Mode") in the Pro Manual Builder with plan-based limits, usage tracking, optional chat history storage, account cleanup functionality, and password reset. All website text is in English.

---

## What Was Implemented

### 1. Database Changes ✅

**Migration File**: `supabase/migrations/20250103000000_add_chat_usage_tracking.sql`

- **Renamed** `user_ai_generations` → `user_ai_usage` table
- **Added columns**:
  - `chat_messages_count` (tracks chat usage)
  - `chat_messages_reset_at` (monthly reset timestamp)
  - `palette_generations_reset_at` (monthly reset timestamp)
  - `last_chat_at` (last chat message timestamp)
- **Renamed** `generation_count` → `palette_generations_count`
- **Created** `user_chat_history` table for optional chat storage
- **Created** `user_settings` table with:
  - `save_chat_history` toggle
  - `last_activity` tracking for account cleanup
- **Added** `cleanup_inactive_accounts()` function for auto-deletion of accounts inactive for 1+ year
- **Updated** all RLS policies to work with new tables

### 2. Plan Limits System ✅

**File**: `src/lib/planLimits.ts`

```typescript
FREE:      1 palette/month,    0 chat messages (no Ask Mode access)
PRO:      50 palettes/month,  30 chat messages/month
ULTRA:   500 palettes/month, 100 chat messages/month
INDIVIDUAL: 2500 palettes/month, 300 chat messages/month
```

### 3. Ask Chat Edge Function ✅

**File**: `supabase/functions/ask-chat/index.ts`

**Features**:
- Authenticates user via Supabase Auth
- Checks user's plan and enforces chat message limits
- Monthly auto-reset of counters
- Calls OpenAI API (gpt-4o-mini) with website context + palette colors
- Saves chat history if user has enabled it in settings
- Tracks `chat_messages_count` and `last_activity`
- Returns helpful error messages for limit exceeded or plan upgrades needed

**Context Provided to AI**:
- Website features (AI generation, Pro Builder, palette browsing, etc.)
- Subscription plans and pricing
- Current palette colors from the builder
- Pro Manual Builder features and shortcuts

### 4. Pro Builder Chat UI ✅

**File**: `src/components/ProPaletteBuilder.tsx`

**Changes**:
- Real OpenAI integration (replaced placeholder tips)
- Loading spinner during API calls
- Usage counter: "X / Y messages used this month"
- Error handling for FREE users: "You need a Pro plan to use Ask Mode"
- Error handling for limit reached: "Upgrade your plan"
- Loads chat history on mount if user has enabled it
- Shows helpful examples in empty state
- Disabled state while loading

### 5. Settings Page Enhancements ✅

**File**: `src/pages/Settings.tsx`

**New Features**:
1. **Chat History Toggle**:
   - Switch component to enable/disable chat history saving
   - Updates `user_settings` table
   - Shows explanation text

2. **Password Reset Email**:
   - Button to send password reset email
   - Uses Supabase's built-in `resetPasswordForEmail()`
   - Redirects to auth page with reset token
   - FREE with Supabase Auth (no additional cost)

### 6. Updated Pricing Page ✅

**File**: `src/pages/Pricing.tsx`

**Updated all plan feature lists**:
- FREE: Shows "Ask Mode chat" as unavailable
- PRO: "30 Ask Mode chat messages/month"
- ULTRA: "100 Ask Mode chat messages/month"
- INDIVIDUAL: "300 Ask Mode chat messages/month"

### 7. Dashboard Usage Display ✅

**File**: `src/pages/Dashboard.tsx`

**New Section**: "Your Usage This Month"
- Shows palette generation count + limit
- Shows chat message count + limit
- Warning when limit is reached
- Different message for FREE users: "Upgrade to Pro to use Ask Mode"

### 8. Activity Tracking ✅

**Files Updated**:
- `supabase/functions/generate-palette/index.ts`: Updates `last_activity` after palette generation
- `supabase/functions/ask-chat/index.ts`: Updates `last_activity` after chat message

**Purpose**: Enables automatic cleanup of accounts inactive for 1+ year

### 9. TypeScript Types ✅

**File**: `src/integrations/supabase/types.ts`

Updated types to match new database schema:
- `user_ai_usage` (with all new columns)
- `user_chat_history`
- `user_settings`

---

## To Deploy to Supabase

### Step 1: Apply Database Migration

Open your Supabase dashboard → SQL Editor → paste the contents of:
`supabase/migrations/20250103000000_add_chat_usage_tracking.sql`

Then click "Run".

### Step 2: Deploy Edge Functions

```bash
# Deploy ask-chat function
npx supabase functions deploy ask-chat

# Redeploy generate-palette function (updated to use new table names)
npx supabase functions deploy generate-palette
```

### Step 3: Set Environment Variables (if not already set)

In Supabase Dashboard → Edge Functions → Configuration:
- `OPENAI_API_KEY`: Your OpenAI API key
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key

---

## How It Works

### Ask Mode Chat Flow

1. User types question in Pro Builder chat panel
2. Frontend checks if user has Pro+ plan
3. Frontend checks if user has remaining chat messages
4. If yes → calls `ask-chat` Edge Function
5. Edge Function:
   - Authenticates user
   - Double-checks plan & limits
   - Builds context (website info + current palette)
   - Calls OpenAI API
   - Increments `chat_messages_count`
   - Saves to `user_chat_history` if enabled
   - Updates `last_activity`
   - Returns response
6. Frontend displays response and updates usage counter

### Monthly Reset Logic

The `ask-chat` Edge Function checks if `chat_messages_reset_at` is from a previous month. If yes:
- Resets `chat_messages_count` to 0
- Updates `chat_messages_reset_at` to current month

Same logic applies to `palette_generations_count`.

---

## Password Reset Explanation

Supabase Auth provides built-in password reset at **no additional cost**:

1. User clicks "Send Password Reset Email" in Settings
2. Code calls: `supabase.auth.resetPasswordForEmail(email, { redirectTo: url })`
3. Supabase sends email with magic link (uses Supabase's SMTP or your custom SMTP)
4. User clicks link → redirected to your app with special token in URL
5. Your app shows password reset form
6. User enters new password → calls `supabase.auth.updateUser({ password: newPassword })`
7. Done!

**Cost**: FREE (included with Supabase Auth)

---

## OpenAI Cost Tracking

### Model Used: `gpt-4o-mini`
- **Input**: ~$0.15 per 1M tokens
- **Output**: ~$0.60 per 1M tokens

### Estimated Monthly Costs Per User:

| Plan | Messages | Avg Tokens/Msg | Total Tokens | Estimated Cost |
|------|----------|----------------|--------------|----------------|
| Pro | 30 | 500 | 15,000 | $0.01 |
| Ultra | 100 | 500 | 50,000 | $0.03 |
| Individual | 300 | 500 | 150,000 | $0.09 |

**Your Pricing**: $2.99 / $5.99 / $15.99 per month
**Your Margin**: Covers costs with significant profit

### How to Track Tokens:

The OpenAI API response includes:
```typescript
data.usage.total_tokens  // Total tokens used
data.usage.prompt_tokens  // Input tokens
data.usage.completion_tokens  // Output tokens
```

You can log these values and sum them monthly to monitor costs.

---

## Account Cleanup

### Auto-Delete Inactive Accounts

The migration includes a `cleanup_inactive_accounts()` function that deletes accounts inactive for 1+ year.

To enable automatic cleanup, you need to:

1. Enable `pg_cron` extension in Supabase (if not already enabled)
2. Schedule the cleanup job:

```sql
SELECT cron.schedule(
  'cleanup-inactive-accounts',
  '0 0 1 * *',  -- Runs at midnight on the 1st of each month
  'SELECT public.cleanup_inactive_accounts()'
);
```

Run this in the Supabase SQL Editor.

---

## Testing Checklist

### Before Testing:
1. ✅ Apply database migration in Supabase SQL Editor
2. ✅ Deploy `ask-chat` Edge Function
3. ✅ Redeploy `generate-palette` Edge Function
4. ✅ Verify `OPENAI_API_KEY` is set in Edge Functions config

### Test Cases:

1. **FREE Plan User**:
   - [ ] Opens Pro Builder → Ask Mode tab
   - [ ] Types question → sees "You need a Pro plan to use Ask Mode"
   - [ ] Dashboard shows "0 / 0" for chat messages with upgrade message

2. **PRO Plan User (within limits)**:
   - [ ] Opens Pro Builder → Ask Mode tab
   - [ ] Asks question about features → gets helpful response
   - [ ] Asks question about current palette → AI references palette colors
   - [ ] Dashboard shows usage counter (e.g., "3 / 30")

3. **PRO Plan User (at limit)**:
   - [ ] Uses 30 messages
   - [ ] Tries 31st message → sees "You've reached your monthly limit"

4. **Chat History Toggle**:
   - [ ] Settings → Enable "Save Chat History"
   - [ ] Ask some questions in Pro Builder
   - [ ] Refresh page → chat history is restored
   - [ ] Settings → Disable "Save Chat History"
   - [ ] Refresh page → chat is empty

5. **Password Reset**:
   - [ ] Settings → Click "Send Password Reset Email"
   - [ ] Check email inbox → receives reset link
   - [ ] Click link → redirected to auth page
   - [ ] Enter new password → success

6. **Monthly Reset** (manual test):
   - [ ] In Supabase, set `chat_messages_reset_at` to last month
   - [ ] Send a chat message
   - [ ] Verify `chat_messages_count` reset to 1

---

## Known Issues / Limitations

1. **Monthly reset is based on calendar month**, not subscription billing date
   - To fix: Store `subscription_started_at` and calculate reset date from there

2. **No chat history pagination**
   - Currently loads last 20 messages
   - For heavy users, consider adding pagination or infinite scroll

3. **No rate limiting on chat messages**
   - Users can spam messages quickly
   - Consider adding: max 1 message per 3 seconds

---

## Files Changed

1. `supabase/migrations/20250103000000_add_chat_usage_tracking.sql` (NEW)
2. `supabase/functions/ask-chat/index.ts` (NEW)
3. `src/lib/planLimits.ts` (NEW)
4. `src/components/ProPaletteBuilder.tsx` (UPDATED)
5. `src/pages/Settings.tsx` (UPDATED)
6. `src/pages/Pricing.tsx` (UPDATED)
7. `src/pages/Dashboard.tsx` (UPDATED)
8. `supabase/functions/generate-palette/index.ts` (UPDATED)
9. `src/integrations/supabase/types.ts` (UPDATED)

---

## Next Steps (Optional Enhancements)

1. **Add rate limiting** to prevent spam (e.g., max 1 msg per 3 seconds)
2. **Chat history UI improvements**: Add "Clear History" button, pagination
3. **Billing-based reset**: Align monthly reset with subscription billing date
4. **Analytics dashboard**: Track most asked questions, popular features
5. **Chat export**: Let users export their chat history as JSON/CSV
6. **System prompts customization**: Allow users to customize AI personality
7. **Voice input**: Add speech-to-text for questions
8. **Multi-language support**: Detect user language and respond accordingly

---

## Support & Troubleshooting

### Issue: "Service temporarily unavailable"
**Cause**: `OPENAI_API_KEY` not set or invalid
**Fix**: Check Edge Functions → Configuration → Set valid API key

### Issue: "Authentication required"
**Cause**: User not signed in or token expired
**Fix**: Sign out and sign back in

### Issue: Migration fails in Supabase
**Cause**: Old table still has dependencies or constraints
**Fix**: Check for any custom policies/functions referencing old table names

### Issue: Chat doesn't save history even when enabled
**Cause**: `user_settings` entry not created for user
**Fix**: The migration's `handle_new_user()` trigger creates this automatically for new users. For existing users, manually insert a row in `user_settings`

---

## Conclusion

✅ **All 10 TODO items completed**
✅ **Build successful (no errors)**
✅ **All changes committed and pushed**

The Ask Mode Chat system is fully implemented with:
- Plan-based limits enforced on both frontend and backend
- Real OpenAI integration with website + palette context
- Optional chat history storage
- Password reset via email
- Account cleanup for inactive users (1+ year)
- Comprehensive usage tracking and display

Ready for deployment! 🚀

