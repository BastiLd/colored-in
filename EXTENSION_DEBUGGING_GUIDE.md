# Chrome Extension Debugging Guide

## How to Open Extension Console and View Logs

1. **Open Extension Popup Console:**
   - Right-click the Colored-In extension icon in Chrome toolbar
   - Select "Inspect popup" or "Popup überprüfen"
   - A Developer Tools window will open showing the extension's console

2. **Keep Console Open While Testing:**
   - The console will show all `console.log` messages
   - Leave the DevTools window open while using the extension

## Testing Steps

### Test 1: Check if Palettes Load

1. Open extension popup with console open
2. Click on "My Palettes" in the menu
3. Watch the console for these messages:
   ```
   Ensuring config before loading palettes...
   Loading palettes for user: <user-id>
   [SupabaseClient] Fetching palettes for user: <user-id>
   [SupabaseClient] Request URL: ...
   [SupabaseClient] Fetched palettes: [array]
   ```

**Expected Results:**
- If you see `Fetched palettes: []` - You have NO saved palettes yet (this is normal if you haven't saved any)
- If you see `Fetched palettes: [...]` with data - Palettes should display
- If you see error messages - There's a permission or authentication issue

**Solution if No Palettes:**
You need to SAVE palettes first! Try these:
1. Go to the website: https://bastild.github.io/colored-in/dashboard
2. Generate a palette with AI
3. Click "Save Palette" and give it a name
4. Return to extension and check "My Palettes" again

### Test 2: Check if Images Load

1. Open extension with console open
2. Click on "Assets" or "Analyze and Create" (Saved tab)
3. Watch console for these messages:
   ```
   Processing asset: <id> URL: <url>
   Extracted path: <path>
   [SupabaseClient] Creating signed URL for bucket: user-assets path: <path>
   [SupabaseClient] Created signed URL: <full-url>
   Hydrated assets: [...]
   ```

**Expected Results:**
- If you see "Failed to create signed URL" - Storage permissions issue
- If you see "Could not extract path from URL" - Database URL format issue
- If signed URLs are created but images still don't show - CORS or bucket policy issue

## Common Issues & Fixes

### Issue 1: "No saved palettes yet"
**Solution:** Generate and save palettes on the website first, then they'll appear in the extension.

### Issue 2: Images showing placeholder icons
**Possible Causes:**
1. Storage bucket `user-assets` is not public
2. RLS policies don't allow reading images
3. CORS not configured

**Fix - Make Storage Bucket Public:**
1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/gevqwporirhaekapftib/storage/buckets
2. Find `user-assets` bucket
3. Click the three dots menu → "Make Public"
4. Or create a Storage Policy:
   - Go to Storage → Policies
   - Click "New Policy" for `user-assets` bucket
   - Select "For full customization"
   - Name: "Public read access"
   - Allowed operation: SELECT
   - Policy definition: `true` (allows all reads)
   - Click "Review" and "Save"

### Issue 3: Authentication Errors
**Solution:** 
1. Log out and log back in to refresh the token
2. Make sure you're logged in on the website as well

### Issue 4: Extension Not Updated
**Solution:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Find "Colored-In" extension
4. Click the refresh icon to reload the extension
5. Re-open the extension popup

## Send Me Console Output

If issues persist, please:
1. Open the extension console (right-click extension icon → "Inspect popup")
2. Clear the console (click clear button)
3. Perform the action (e.g., click "My Palettes" or "Assets")
4. Take a screenshot of ALL console messages
5. Send me the screenshot

## Quick Checklist

- [ ] Extension reloaded after latest code changes
- [ ] Console open while testing
- [ ] Logged in to extension
- [ ] Have saved palettes on website (if testing palettes)
- [ ] Have uploaded images on website (if testing images)
- [ ] Storage bucket `user-assets` is public or has read policy
- [ ] Console shows detailed log messages (not old cached version)
