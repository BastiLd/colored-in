import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable. Please try again later.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required. Please sign in to use AI generation.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(JSON.stringify({ error: 'Invalid authentication. Please sign in again.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User authenticated:', user.id);

    // Check user's subscription plan
    const { data: subscriptionData } = await supabase
      .from('user_subscriptions')
      .select('plan, is_active')
      .eq('user_id', user.id)
      .single();

    const userPlan = (subscriptionData?.is_active && subscriptionData?.plan) || 'free';
    const planLimit = PLAN_LIMITS[userPlan] ?? PLAN_LIMITS.free;
    
    console.log('User plan:', userPlan, 'Limit:', planLimit);

    // Check user's generation count and rate limiting
    const { data: genData, error: genError } = await supabase
      .from('user_ai_generations')
      .select('generation_count, last_generation_at')
      .eq('user_id', user.id)
      .single();

    if (genError && genError.code !== 'PGRST116') {
      console.error('Error fetching generation data:', genError);
    }

    const currentCount = genData?.generation_count || 0;
    
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
        .from('user_ai_generations')
        .update({ last_generation_at: updateTimestamp })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_ai_generations')
        .insert({ 
          user_id: user.id, 
          generation_count: 0,
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
  "tags": ["tag1", "tag2", "tag3"]
}

Rules:
- Generate between 4-8 colors that work well together
- All colors must be valid 6-digit hex codes starting with #
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
        max_tokens: 300,
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

    console.log('Generated palette:', palette.name);

    // Save palette to public_palettes
    const { error: insertError } = await supabase
      .from('public_palettes')
      .insert({
        name: palette.name,
        colors: palette.colors,
        tags: palette.tags || [],
        created_by: user.id
      });

    if (insertError) {
      console.error('Error saving palette:', insertError);
    } else {
      console.log('Palette saved to public_palettes');
    }

    // Update generation count (after successful generation)
    await supabase
      .from('user_ai_generations')
      .update({ 
        generation_count: currentCount + 1,
        last_generation_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    console.log('Generation count updated');

    return new Response(JSON.stringify(palette), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-palette function:', error);
    const safeMessage = getSafeErrorMessage(error);
    return new Response(JSON.stringify({ error: safeMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
