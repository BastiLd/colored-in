// NOTE: Supabase Edge Functions run on Deno, but this repo's TypeScript tooling
// (Vite/tsconfig) doesn't include Deno globals. This shim fixes editor/TS errors
// like "Cannot find name 'Deno'" without affecting runtime behavior.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

import "https://deno.land/x/xhr@0.1.0/mod.ts";
// @ts-ignore - Deno can resolve this at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const PLAN_LIMITS: Record<string, { chatMessagesPerMonth: number; askMode: boolean }> = {
  free: { chatMessagesPerMonth: 0, askMode: false },
  pro: { chatMessagesPerMonth: 30, askMode: true },
  ultra: { chatMessagesPerMonth: 100, askMode: true },
  individual: { chatMessagesPerMonth: 300, askMode: true },
};

const WEBSITE_CONTEXT = `You are a helpful assistant for "Colored In", a color palette tool.

Key Features:
- AI Palette Generation: Create palettes from text descriptions using GPT-4
- Manual Palette Builder: Interactive tool to create and adjust palettes
- Pro Manual Builder: Advanced editor with harmonization, HSL adjustments, palette locking
- 50,000+ Curated Palettes: Browse and search through thousands of color schemes
- Chrome Extension: Access palettes anywhere (Ultra+ plans)

Subscription Plans:
- Free: $0/month - 1 AI palette generation, basic manual generator, view 500 palettes
- Pro: $2.99/month - 50 AI palettes/month, 30 chat messages/month, view 1,000+ palettes, save & organize
- Ultra: $5.99/month - 500 AI palettes/month, 100 chat messages/month, 10,000+ palettes, Chrome extension, custom editor
- Individual: $15.99/month - 2,500 AI palettes/month, 300 chat messages/month, 50,000 palettes, unlimited projects, priority support

Pro Manual Builder Features:
- Left Sidebar: Browse palettes, colors, templates, and assets
- Center Canvas: Your current palette with interactive color slots
- Right Chat Panel: Ask questions (Ask Mode) or apply quick edits (Edit Mode)
- Bottom Toolbar: Lock colors, move slots, copy (hex/JSON/CSV), save, regenerate, harmonize
- Keyboard Shortcuts: Space (regenerate), L (lock toggle), C (copy color)
- Edit Mode: Apply adjustments like warmer, cooler, pastel, more contrast to selected color or whole palette
- Harmonize: Creates analogous color scheme based on selected color

When answering:
1. Be helpful, concise, and friendly
2. If asked about features not in Free plan, mention upgrading
3. If asked about colors in the palette, reference the palette context provided
4. Provide actionable tips for color theory and design
5. Keep responses under 200 words`;

function validateInput(question: unknown): { valid: boolean; error?: string; sanitized?: string } {
  if (!question || typeof question !== 'string') {
    return { valid: false, error: 'Invalid question format' };
  }

  const trimmed = question.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Question cannot be empty' };
  }

  if (trimmed.length > 500) {
    return { valid: false, error: 'Question must be 500 characters or less' };
  }

  return { valid: true, sanitized: trimmed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== ask-chat function started ===');

    // Parse request body
    let requestBody;
    try {
      const bodyText = await req.text();
      if (!bodyText || bodyText.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'Request body is required' }),
          { status: 400, headers: corsHeaders }
        );
      }
      requestBody = JSON.parse(bodyText);
    } catch (e) {
      console.error('Failed to parse request body:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { question, paletteContext } = requestBody;

    // Validate question
    const validation = validateInput(question);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: corsHeaders }
      );
    }

    const sanitizedQuestion = validation.sanitized!;

    // Get environment variables
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 503, headers: corsHeaders }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing');
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // Verify token with Supabase Auth
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseServiceKey,
      },
    });

    if (!userRes.ok) {
      console.error('Auth API error:', userRes.status);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const user = await userRes.json();
    if (!user || !user.id) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log('User authenticated:', user.id);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check user's subscription plan
    const { data: subscriptionData } = await supabase
      .from('user_subscriptions')
      .select('plan, is_active')
      .eq('user_id', user.id)
      .single();

    const userPlan = (subscriptionData?.is_active && subscriptionData?.plan) || 'free';
    const planConfig = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free;

    console.log('User plan:', userPlan);

    // Check if user has access to Ask Mode
    if (!planConfig.askMode) {
      return new Response(
        JSON.stringify({
          error: 'You need a Pro plan or higher to use Ask Mode',
          requiresUpgrade: true,
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Check user's chat usage
    const { data: usageData, error: usageError } = await supabase
      .from('user_ai_usage')
      .select('chat_messages_count, chat_messages_reset_at')
      .eq('user_id', user.id)
      .single();

    if (usageError && usageError.code !== 'PGRST116') {
      console.error('Error fetching usage data:', usageError);
    }

    const currentCount = usageData?.chat_messages_count || 0;
    const resetAt = usageData?.chat_messages_reset_at;

    // Check if we need to reset the counter (monthly reset)
    const now = new Date();
    const needsReset = resetAt && new Date(resetAt) < new Date(now.getFullYear(), now.getMonth(), 1);

    let actualCount = currentCount;
    if (needsReset) {
      // Reset counter for new month
      await supabase
        .from('user_ai_usage')
        .update({
          chat_messages_count: 0,
          chat_messages_reset_at: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        })
        .eq('user_id', user.id);
      actualCount = 0;
    }

    // Check if user has exceeded limit
    if (actualCount >= planConfig.chatMessagesPerMonth) {
      const upgradeMessage =
        userPlan === 'pro'
          ? 'You\'ve reached your Pro limit (30 messages/month). Upgrade to Ultra for 100 messages!'
          : userPlan === 'ultra'
          ? 'You\'ve reached your Ultra limit (100 messages/month). Upgrade to Individual for 300 messages!'
          : 'You\'ve reached your monthly chat limit. Upgrade your plan for more messages.';

      return new Response(
        JSON.stringify({
          error: upgradeMessage,
          limitReached: true,
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    console.log('Chat message count:', actualCount, '/', planConfig.chatMessagesPerMonth);

    // Build context for OpenAI
    let contextMessage = WEBSITE_CONTEXT;

    if (paletteContext && Array.isArray(paletteContext) && paletteContext.length > 0) {
      contextMessage += `\n\nCurrent Palette Colors: ${paletteContext.join(', ')}`;
    }

    // Call OpenAI API
    console.log('Calling OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: contextMessage,
          },
          {
            role: 'user',
            content: sanitizedQuestion,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI service unavailable' }),
        { status: 503, headers: corsHeaders }
      );
    }

    const data = await response.json();
    const assistantResponse = data.choices[0].message.content;

    console.log('OpenAI response received');

    // Check if user has chat history enabled
    const { data: settingsData } = await supabase
      .from('user_settings')
      .select('save_chat_history')
      .eq('user_id', user.id)
      .single();

    const saveChatHistory = settingsData?.save_chat_history || false;

    // Save to chat history if enabled
    if (saveChatHistory) {
      await supabase.from('user_chat_history').insert([
        {
          user_id: user.id,
          role: 'user',
          content: sanitizedQuestion,
          palette_context: paletteContext ? { colors: paletteContext } : null,
        },
        {
          user_id: user.id,
          role: 'assistant',
          content: assistantResponse,
          palette_context: null,
        },
      ]);
      console.log('Chat history saved');
    }

    // Increment chat message count
    await supabase
      .from('user_ai_usage')
      .update({
        chat_messages_count: actualCount + 1,
        last_chat_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    // Update last activity
    await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        last_activity: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    console.log('Usage count updated');

    return new Response(
      JSON.stringify({
        response: assistantResponse,
        usage: {
          used: actualCount + 1,
          limit: planConfig.chatMessagesPerMonth,
        },
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('=== CRITICAL ERROR in ask-chat function ===');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');

    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: corsHeaders }
    );
  }
});

