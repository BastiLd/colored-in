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

const MIN_REQUEST_INTERVAL_MS = 10000; // 10 seconds between requests
const MAX_PROMPT_LENGTH = 500;

// Generation limits by plan
const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  pro: 100,
  ultra: 500,
  individual: Infinity, // Unlimited
};

function normalizePlan(plan: unknown): keyof typeof PLAN_LIMITS {
  const p = (typeof plan === 'string' ? plan : '').toLowerCase();
  if (!p) return 'free';
  if (p.includes('individual')) return 'individual';
  if (p.includes('ultra')) return 'ultra';
  if (p.includes('pro')) return 'pro';
  return 'free';
}

// Sanitize error messages to prevent information leakage
function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('OPENAI_API_KEY')) {
      return 'Service temporarily unavailable. Please try again later.';
    }
    if (error.message.includes('generation count') || error.message.includes('PGRST')) {
      return 'Unable to check generation limit. Please try again.';
    }
    if (error.message.includes('OpenAI API error')) {
      return 'AI service unavailable. Please try again later.';
    }
    if (error.message.includes('parse palette') || error.message.includes('Invalid palette')) {
      return 'Failed to generate palette. Please try a different prompt.';
    }
  }
  return 'An unexpected error occurred. Please try again.';
}

// Validate and sanitize user prompt
function validatePrompt(prompt: unknown): { valid: boolean; error?: string; sanitized?: string } {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'Invalid prompt format' };
  }

  const trimmedPrompt = prompt.trim();

  if (trimmedPrompt.length === 0) {
    return { valid: false, error: 'Prompt cannot be empty' };
  }

  if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
    return { valid: false, error: `Prompt must be ${MAX_PROMPT_LENGTH} characters or less` };
  }

  // Basic content filtering for potential injection attempts
  const suspiciousPatterns = /(<script|javascript:|data:text\/html|eval\(|on\w+\s*=)/i;
  if (suspiciousPatterns.test(trimmedPrompt)) {
    return { valid: false, error: 'Invalid prompt content' };
  }

  return { valid: true, sanitized: trimmedPrompt };
}

function buildFallbackColorDescriptions(colors: string[]): string[] {
  const roleTemplates = [
    "This primary color anchors the palette with a strong base, improving recognition and visual hierarchy.",
    "This secondary color supports the primary tone, adding depth and keeping the palette cohesive.",
    "This accent color provides contrast and focus, making key actions and highlights stand out.",
    "This background/neutral color creates breathing room and improves readability.",
    "This highlight color adds subtle emphasis and polish for small UI details.",
    "This supporting color balances the palette and smooths transitions between tones.",
    "This depth color adds richness and dimensionality without overwhelming the design.",
    "This soft contrast color keeps the palette versatile and easy to apply."
  ];

  return colors.map((color, index) => {
    const template = roleTemplates[index] || roleTemplates[roleTemplates.length - 1];
    return `${template} (${color})`;
  });
}

// Global error handler to catch any unhandled errors
if (typeof Deno !== 'undefined') {
  globalThis.addEventListener('error', (event) => {
    console.error('=== GLOBAL ERROR ===', event.error);
  });
  
  globalThis.addEventListener('unhandledrejection', (event) => {
    console.error('=== UNHANDLED PROMISE REJECTION ===', event.reason);
  });
}

Deno.serve((req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return Promise.resolve(new Response(null, { headers: corsHeaders }));
  }

  return (async () => {
    // Log immediately when function is called
    console.log('=== Function started ===', { method: req.method, url: req.url });
    
    try {
      console.log('Processing POST request:', { method: req.method });
    
    // Parse request body with error handling
    let requestBody;
    try {
      const bodyText = await req.text();
      console.log('Request body received, length:', bodyText.length);
      
      if (!bodyText || bodyText.trim().length === 0) {
        console.error('Empty request body');
        return new Response(
          JSON.stringify({ error: 'Request body is required' }),
          { status: 400, headers: corsHeaders }
        );
      }
      
      requestBody = JSON.parse(bodyText);
      console.log('Request body parsed:', { hasPrompt: !!requestBody?.prompt });
    } catch (e) {
      console.error('Failed to parse request body:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid request format. Expected JSON body with "prompt" field.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { prompt } = requestBody;
    
    // Validate prompt input
    const promptValidation = validatePrompt(prompt);
    if (!promptValidation.valid) {
      console.log('Invalid prompt:', promptValidation.error);
      return new Response(
        JSON.stringify({ error: promptValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const sanitizedPrompt = promptValidation.sanitized!;
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Check all required environment variables
    console.log('Environment check:', { 
      hasOpenAIKey: !!openAIApiKey, 
      hasSupabaseUrl: !!supabaseUrl, 
      hasServiceKey: !!supabaseServiceKey 
    });

    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable. Please try again later.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseServiceKey });
      return new Response(
        JSON.stringify({ error: 'Service configuration error. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header check:', { 
      hasAuthHeader: !!authHeader,
      authHeaderPreview: authHeader ? authHeader.substring(0, 30) + '...' : null,
      allHeaders: Object.fromEntries(req.headers.entries())
    });
    
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ error: 'Authentication required. Please sign in to use AI generation.' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Extract token from Authorization header
    const token = authHeader.replace('Bearer ', '').trim();
    console.log('Token extracted, length:', token.length, 'preview:', token.substring(0, 20) + '...');
    
    // Verify token with Supabase Auth API (same approach as create-checkout)
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 
        Authorization: `Bearer ${token}`, 
        apikey: supabaseServiceKey 
      },
    });
    
    console.log('Auth API response:', { status: userRes.status, ok: userRes.ok });
    
    if (!userRes.ok) {
      const errorText = await userRes.text();
      console.error('Auth API error:', errorText);
      return new Response(JSON.stringify({ 
        error: 'Invalid authentication. Please sign in again.',
        details: `Auth API returned ${userRes.status}`
      }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    
    const userData = await userRes.json();
    const user = userData;
    
    if (!user || !user.id) {
      console.error('No user in auth response:', userData);
      return new Response(JSON.stringify({ 
        error: 'Invalid authentication. User not found.',
      }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    
    console.log('User authenticated:', user.id);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check user's subscription plan
    const { data: subscriptionData } = await supabase
      .from('user_subscriptions')
      .select('plan, is_active')
      .eq('user_id', user.id)
      .single();

    const rawPlan = (subscriptionData?.is_active && subscriptionData?.plan) || 'free';
    const userPlan = normalizePlan(rawPlan);
    const planLimit = PLAN_LIMITS[userPlan] ?? PLAN_LIMITS.free;
    
    console.log('User plan:', userPlan, 'Limit:', planLimit);

    // Check user's generation count and rate limiting
    const { data: genData, error: genError } = await supabase
      .from('user_ai_usage')
      .select('palette_generations_count, last_generation_at')
      .eq('user_id', user.id)
      .single();

    if (genError && genError.code !== 'PGRST116') {
      console.error('Error fetching generation data:', genError);
    }

    const currentCount = genData?.palette_generations_count || 0;
    
    // Check generation limit based on user's plan
    if (currentCount >= planLimit) {
      const upgradeMessage = userPlan === 'free' 
        ? 'You have used your free AI generation. Upgrade to Pro for more!'
        : userPlan === 'pro'
        ? 'You have reached your Pro limit (100). Upgrade to Ultra for more!'
        : userPlan === 'ultra'
        ? 'You have reached your Ultra limit (500). Contact us for Individual plan!'
        : 'Generation limit reached.';
      
      return new Response(JSON.stringify({ 
        error: upgradeMessage,
        limitReached: true
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting: check time since last generation attempt
    if (genData?.last_generation_at) {
      const lastGenTime = new Date(genData.last_generation_at).getTime();
      const now = Date.now();
      const timeSinceLastGen = now - lastGenTime;
      
      if (timeSinceLastGen < MIN_REQUEST_INTERVAL_MS) {
        const retryAfter = Math.ceil((MIN_REQUEST_INTERVAL_MS - timeSinceLastGen) / 1000);
        console.log('Rate limit hit for user:', user.id, 'retry after:', retryAfter);
        return new Response(
          JSON.stringify({ 
            error: 'Please wait before generating another palette',
            retryAfter
          }),
          { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': String(retryAfter)
            }
          }
        );
      }
    }

    // Update last_generation_at BEFORE making the AI call to prevent race conditions
    const updateTimestamp = new Date().toISOString();
    if (genData) {
      await supabase
        .from('user_ai_usage')
        .update({ last_generation_at: updateTimestamp })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_ai_usage')
        .insert({ 
          user_id: user.id, 
          palette_generations_count: 0,
          chat_messages_count: 0,
          last_generation_at: updateTimestamp
        });
    }

    console.log('Generating palette for prompt:', sanitizedPrompt.substring(0, 50) + '...');

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
            content: `You are a color palette expert. When given a description, you create beautiful, harmonious color palettes.

IMPORTANT: Respond ONLY with a valid JSON object in this exact format:
{
  "name": "Palette Name",
  "colors": ["#HEXCODE1", "#HEXCODE2", "#HEXCODE3", "#HEXCODE4", "#HEXCODE5"],
  "colorDescriptions": [
    "Why this color is included and what it improves",
    "Why this color is included and what it improves"
  ],
  "description": "Overall explanation of how the palette works together",
  "tags": ["tag1", "tag2", "tag3"]
}

Rules:
- Generate between 4-8 colors that work well together
- All colors must be valid 6-digit hex codes starting with #
- Provide ONE description per color (colorDescriptions length must match colors)
- Each color description must explain why that color belongs and what it improves (contrast, hierarchy, mood, usability)
- The name should be creative and match the mood
- Include 2-4 relevant tags
- Do not include any explanation or text outside the JSON`
          },
          {
            role: 'user',
            content: sanitizedPrompt
          }
        ],
        temperature: 0.8,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('OpenAI response received');

    // Parse the JSON response
    let palette;
    try {
      palette = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        palette = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse palette from AI response');
      }
    }

    // Validate the palette
    if (!palette.name || !Array.isArray(palette.colors) || palette.colors.length < 4) {
      throw new Error('Invalid palette format from AI');
    }

    // Ensure all colors are valid hex codes
    palette.colors = palette.colors.map((color: string) => {
      if (!color.startsWith('#')) {
        color = '#' + color;
      }
      return color.toUpperCase();
    });

    if (!Array.isArray(palette.tags)) {
      palette.tags = [];
    }

    // Ensure overall description exists
    if (typeof palette.description !== 'string' || !palette.description.trim()) {
      palette.description = 'A cohesive palette crafted to match the requested mood and improve visual hierarchy.';
    }

    // Ensure color descriptions exist and align
    if (!Array.isArray(palette.colorDescriptions) || palette.colorDescriptions.length !== palette.colors.length) {
      palette.colorDescriptions = buildFallbackColorDescriptions(palette.colors);
    }

    console.log('Generated palette:', palette.name);

    // Save palette to public_palettes
    const { error: insertError } = await supabase
      .from('public_palettes')
      .insert({
        name: palette.name,
        colors: palette.colors,
        tags: palette.tags || [],
        description: palette.description || null,
        color_descriptions: palette.colorDescriptions || [],
        created_by: user.id
      });

    if (insertError) {
      console.error('Error saving palette:', insertError);
    } else {
      console.log('Palette saved to public_palettes');
    }

    // Update generation count (after successful generation)
    await supabase
      .from('user_ai_usage')
      .update({ 
        palette_generations_count: currentCount + 1,
        last_generation_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    // Update last activity
    await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        last_activity: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    console.log('Generation count updated');

      console.log('Returning successful response');
      return new Response(JSON.stringify(palette), {
        headers: corsHeaders,
      });
    } catch (error) {
      console.error('=== CRITICAL ERROR in generate-palette function ===');
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      try {
        const errorDetails = error instanceof Error 
          ? { message: error.message, name: error.name, stack: error.stack }
          : { error: String(error) };
        console.error('Full error:', JSON.stringify(errorDetails));
      } catch (e) {
        console.error('Could not stringify error:', e);
      }
      
      const safeMessage = getSafeErrorMessage(error);
      console.error('Returning error response:', safeMessage);
      
      return new Response(JSON.stringify({ error: safeMessage }), {
        status: 500,
        headers: corsHeaders,
      });
    } finally {
      console.log('=== Function completed ===');
    }
  })();
});
