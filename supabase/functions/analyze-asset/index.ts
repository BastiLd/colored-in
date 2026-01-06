// NOTE: Supabase Edge Functions run on Deno, but this repo's TypeScript tooling
// (Vite/tsconfig) doesn't include Deno globals. This shim fixes editor/TS errors.
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

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== analyze-asset function started ===');

  try {
    const { assetType, assetUrl } = await req.json();
    
    console.log('Request params:', { assetType, assetUrl: assetUrl?.substring(0, 50) });

    if (!assetType || !assetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing assetType or assetUrl' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY is not configured');
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
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 
        Authorization: `Bearer ${token}`, 
        apikey: supabaseServiceKey 
      },
    });

    if (!userRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userData = await userRes.json();
    if (!userData || !userData.id) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log('User authenticated:', userData.id);

    // Check user's plan (only paid users can analyze)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('plan, is_active')
      .eq('user_id', userData.id)
      .single();

    const isPaid = subscription?.is_active && subscription?.plan !== 'free';
    
    if (!isPaid) {
      return new Response(
        JSON.stringify({ error: 'This feature requires a paid plan. Upgrade to Pro!' }),
        { status: 403, headers: corsHeaders }
      );
    }

    console.log('User plan check passed:', subscription?.plan);

    // Prepare the OpenAI request based on asset type
    let systemPrompt: string;
    let userContent: { type: string; text?: string; image_url?: { url: string } }[];

    if (assetType === 'image') {
      systemPrompt = `You are a color palette extraction expert. Analyze the image provided and extract exactly 5 dominant or harmonious colors that represent the image well. 

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{"colors":["#HEX1","#HEX2","#HEX3","#HEX4","#HEX5"],"name":"Short descriptive name","description":"Brief description of the color mood"}

Rules:
- Extract colors that work well together as a palette
- Use uppercase hex codes with # prefix
- Name should be 2-4 words describing the palette mood
- Description should be 1 sentence max`;

      userContent = [
        { type: "text", text: "Extract a 5-color palette from this image:" },
        { type: "image_url", image_url: { url: assetUrl } }
      ];
    } else if (assetType === 'link') {
      systemPrompt = `You are a color palette designer. Based on the URL/website description provided, suggest a 5-color palette that would be appropriate for that type of website or content.

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{"colors":["#HEX1","#HEX2","#HEX3","#HEX4","#HEX5"],"name":"Short descriptive name","description":"Brief description of the color mood"}

Rules:
- Create colors that work well together as a cohesive palette
- Use uppercase hex codes with # prefix
- Consider the likely branding, industry, and mood of the website
- Name should be 2-4 words describing the palette mood
- Description should be 1 sentence max`;

      userContent = [
        { type: "text", text: `Create a 5-color palette appropriate for this website/URL: ${assetUrl}` }
      ];
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid asset type. Must be "image" or "link"' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('Calling OpenAI API...');

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: assetType === 'image' ? 'gpt-4o' : 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to analyze asset' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const openAIData = await openAIResponse.json();
    const responseContent = openAIData.choices?.[0]?.message?.content;

    console.log('OpenAI response:', responseContent);

    if (!responseContent) {
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Parse the response
    let parsedPalette;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedPalette = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Validate the palette
    if (!parsedPalette.colors || !Array.isArray(parsedPalette.colors) || parsedPalette.colors.length !== 5) {
      return new Response(
        JSON.stringify({ error: 'Invalid palette format from AI' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Validate hex colors
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    const validColors = parsedPalette.colors.every((c: string) => hexRegex.test(c));
    if (!validColors) {
      return new Response(
        JSON.stringify({ error: 'Invalid color format from AI' }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('=== analyze-asset completed successfully ===');

    return new Response(
      JSON.stringify({
        colors: parsedPalette.colors.map((c: string) => c.toUpperCase()),
        name: parsedPalette.name || 'Analyzed Palette',
        description: parsedPalette.description || 'Generated from asset analysis',
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('=== analyze-asset error ===', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});

