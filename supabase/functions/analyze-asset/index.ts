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

// Analysis modes
type AnalysisMode = 'extract' | 'expand' | 'improve';

function tryParseSupabaseStorageUrl(assetUrl: string) {
  try {
    const u = new URL(assetUrl);
    const m = u.pathname.match(/\/storage\/v1\/object\/(public|sign)\/([^/]+)\/(.+)$/);
    if (!m) return null;
    const bucket = m[2];
    const path = decodeURIComponent(m[3]);
    return { bucket, path };
  } catch {
    return null;
  }
}

function normalizePlan(plan: unknown): 'free' | 'pro' | 'ultra' | 'individual' {
  const p = (typeof plan === 'string' ? plan : '').toLowerCase();
  if (!p) return 'free';
  if (p.includes('individual')) return 'individual';
  if (p.includes('ultra')) return 'ultra';
  if (p.includes('pro')) return 'pro';
  return 'free';
}

function buildFallbackColorDescriptions(colors: string[]): string[] {
  const roleTemplates = [
    "This primary color anchors the palette and sets the visual tone.",
    "This secondary color supports the primary and adds depth.",
    "This accent color provides contrast and draws attention to key elements.",
    "This background/neutral color improves readability and balance.",
    "This highlight color adds subtle emphasis and polish.",
    "This supporting color smooths transitions and keeps harmony.",
    "This depth color adds richness without overpowering the design.",
    "This soft contrast color keeps the palette versatile."
  ];

  return colors.map((color, index) => {
    const template = roleTemplates[index] || roleTemplates[roleTemplates.length - 1];
    return `${template} (${color})`;
  });
}

function buildImproveFallbackDescriptions(colors: string[]): string[] {
  const replaceTemplates = [
    "Replace the primary brand color with this option to improve recognition and trust.",
    "Replace the secondary/support color with this tone to add depth and balance.",
    "Replace the CTA/accent color with this shade to increase focus on key actions.",
    "Replace the background/neutral color with this to improve readability and spacing.",
    "Replace the text/contrast color with this value to strengthen legibility.",
    "Replace supporting UI elements with this color to keep the palette cohesive.",
  ];

  return colors.map((color, index) => {
    const template = replaceTemplates[index] || replaceTemplates[replaceTemplates.length - 1];
    return `${template} (${color})`;
  });
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== analyze-asset function started ===');

  try {
    const { assetType, assetUrl, mode = 'extract', expandText = '' } = await req.json();

    console.log('Request params:', {
      assetType,
      assetUrl: assetUrl?.substring(0, 50),
      mode,
      expandText: expandText?.substring(0, 50)
    });

    if (!assetType || !assetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing assetType or assetUrl' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate mode
    const validModes: AnalysisMode[] = ['extract', 'expand', 'improve'];
    if (!validModes.includes(mode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid mode. Must be "extract", "expand", or "improve"' }),
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

    // Check user's plan (Ultra or Individual required for extension features)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('plan, is_active')
      .eq('user_id', userData.id)
      .single();

    const userPlan = normalizePlan(subscription?.plan);
    const isActive = Boolean(subscription?.is_active);
    const isPremium = isActive && (userPlan === 'ultra' || userPlan === 'individual');

    // For basic analysis, Pro is enough. For advanced modes, Ultra/Individual required
    const isPaid = isActive && userPlan !== 'free';

    if (!isPaid) {
      return new Response(
        JSON.stringify({ error: 'This feature requires a paid plan. Upgrade to Pro!' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Advanced modes (improve, expand) require Ultra or Individual
    if ((mode === 'improve' || mode === 'expand') && !isPremium) {
      return new Response(
        JSON.stringify({ error: 'This analysis mode requires an Ultra or Individual plan.' }),
        { status: 403, headers: corsHeaders }
      );
    }

    console.log('User plan check passed:', subscription?.plan, 'Normalized:', userPlan, 'Mode:', mode);

    // If the image is from Supabase Storage, we need to fetch it and convert to base64
    // because OpenAI cannot access Supabase Storage URLs directly
    let imageUrlForAI = assetUrl;

    if (assetType === 'image') {
      const isSupabaseUrl = assetUrl.includes('supabase.co/storage');
      const isDataUrl = assetUrl.startsWith('data:');

      if (isSupabaseUrl && !isDataUrl) {
        console.log('Converting Supabase Storage image to base64...');
        try {
          const parsed = tryParseSupabaseStorageUrl(assetUrl);
          if (!parsed) {
            console.error('Failed to parse Supabase Storage URL');
            return new Response(
              JSON.stringify({ error: 'Invalid image URL. Please try re-uploading.' }),
              { status: 400, headers: corsHeaders }
            );
          }

          // Download using service role (works for both public + private buckets and avoids 400s)
          const { data: fileData, error: dlError } = await supabase
            .storage
            .from(parsed.bucket)
            .download(parsed.path);

          if (dlError || !fileData) {
            console.error('Failed to download image from storage:', {
              message: dlError?.message,
              bucket: parsed.bucket,
              pathPrefix: parsed.path.slice(0, 80),
            });
            return new Response(
              JSON.stringify({ error: 'Failed to access image. Please try re-uploading.' }),
              { status: 400, headers: corsHeaders }
            );
          }

          const contentType =
            // deno-lint-ignore no-explicit-any
            (fileData as any)?.type ||
            'image/png';

          // Get the image as ArrayBuffer and convert to base64
          const arrayBuffer = await fileData.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Convert to base64
          let binary = '';
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64 = btoa(binary);

          // Create data URL
          imageUrlForAI = `data:${contentType};base64,${base64}`;
          console.log('Image converted to base64, length:', base64.length);
        } catch (fetchError) {
          console.error('Error converting image to base64:', fetchError);
          return new Response(
            JSON.stringify({ error: 'Failed to process image. Please try again.' }),
            { status: 500, headers: corsHeaders }
          );
        }
      } else if (isDataUrl) {
        // Already a data URL, use as-is
        imageUrlForAI = assetUrl;
        console.log('Image is already a data URL');
      }
    }

    // Build prompts based on mode
    let systemPrompt = "";
    let userContent: { type: string; text?: string; image_url?: { url: string } }[] = [];

    if (mode === 'extract') {
      // EXTRACT MODE: Get exact colors from the asset (variable length 2-10)
      if (assetType === 'image') {
        systemPrompt = `You are a color extraction expert. Analyze the image and extract ALL the dominant colors actually present in it. Extract between 2 and 10 colors depending on the image's color complexity.

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{"colors":["#HEX1","#HEX2",...],"colorDescriptions":["Why this color appears and what it contributes", "..."],"name":"Short descriptive name","description":"Brief description of the colors found"}

Rules:
- Extract the ACTUAL colors present in the image
- Use between 2 and 10 colors based on the image's color diversity
- Use uppercase hex codes with # prefix
- Provide ONE description per color (colorDescriptions length must match colors)
- Each color description should mention where it appears and why it matters visually
- Name should be 2-4 words describing what you see
- Description should mention what the colors represent in the image`;

        userContent = [
          { type: "text", text: "Extract all the dominant colors actually present in this image:" },
          { type: "image_url", image_url: { url: imageUrlForAI } }
        ];
      } else {
        systemPrompt = `You are a web design color analyst. Analyze the website URL provided and determine what colors are likely used on that type of site. Extract between 2 and 10 colors.

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{"colors":["#HEX1","#HEX2",...],"colorDescriptions":["Why this color fits the site and what it improves", "..."],"name":"Short descriptive name","description":"Brief description of the color scheme"}

Rules:
- Predict the ACTUAL colors likely used on this type of website
- Use between 2 and 10 colors based on typical usage
- Use uppercase hex codes with # prefix
- Provide ONE description per color (colorDescriptions length must match colors)
- Each color description should explain role (primary, accent, background, text)
- Consider the industry, brand type, and typical web design patterns
- Name should describe the color scheme style`;

        userContent = [
          { type: "text", text: `Extract the color scheme likely used on this website: ${assetUrl}` }
        ];
      }
    } else if (mode === 'expand') {
      // EXPAND MODE: Create palette based on asset + user's description
      const userDescription = expandText || 'Create a harmonious palette';

      if (assetType === 'image') {
        systemPrompt = `You are a creative color palette designer. Analyze the image AND incorporate the user's creative direction to generate a unique palette.

User's direction: "${userDescription}"

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{"colors":["#HEX1","#HEX2","#HEX3","#HEX4","#HEX5","#HEX6"],"colorDescriptions":["Why this color was chosen and what it improves", "..."],"name":"Creative palette name","description":"How this palette combines the image with the user's vision"}

Rules:
- Create 5-6 colors that blend the image's essence with the user's direction
- Use uppercase hex codes with # prefix
- Provide ONE description per color (colorDescriptions length must match colors)
- Each color description should explain the role in the palette and the benefit
- Be creative and interpret the user's vision
- Name should be evocative and unique
- Description should explain the creative choices`;

        userContent = [
          { type: "text", text: `Create a palette inspired by this image, following this direction: "${userDescription}"` },
          { type: "image_url", image_url: { url: imageUrlForAI } }
        ];
      } else {
        systemPrompt = `You are a creative color palette designer. Analyze the website type AND incorporate the user's creative direction.

User's direction: "${userDescription}"

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{"colors":["#HEX1","#HEX2","#HEX3","#HEX4","#HEX5","#HEX6"],"colorDescriptions":["Why this color was chosen and what it improves", "..."],"name":"Creative palette name","description":"How this palette combines the website theme with the user's vision"}

Rules:
- Create 5-6 colors that blend the website's likely theme with the user's direction
- Use uppercase hex codes with # prefix
- Provide ONE description per color (colorDescriptions length must match colors)
- Each color description should explain the role in the palette and the benefit
- Be creative and interpret the user's vision
- Name should be evocative and unique`;

        userContent = [
          { type: "text", text: `Create a palette for this website (${assetUrl}), following this direction: "${userDescription}"` }
        ];
      }
    } else if (mode === 'improve') {
      // IMPROVE MODE: Analyze and suggest better colors with explanations
      if (assetType === 'image') {
        systemPrompt = `You are an expert color consultant and UX designer. Analyze the image deeply - understand its purpose, mood, target audience, and current color usage. Then create an IMPROVED color palette that would make it more effective, appealing, and professional.

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "colors": ["#HEX1", "#HEX2", "#HEX3", "#HEX4", "#HEX5"],
  "colorDescriptions": [
    "Replace the current primary color with #HEX1 and explain what it improves",
    "Replace the current secondary color with #HEX2 and explain the benefit",
    "Replace the current accent/CTA color with #HEX3 and explain the impact",
    "Replace the current background/neutral with #HEX4 and explain readability gains",
    "Replace the current text/contrast color with #HEX5 and explain legibility improvements"
  ],
  "name": "Improved Palette Name",
  "description": "Overall explanation of how this palette improves upon the original"
}

Rules:
- Create exactly 5 colors that would IMPROVE the design
- Each colorDescription must explicitly say what should be replaced and why the new color is better
- Reference color theory, psychology, and UX best practices
- Use uppercase hex codes with # prefix
- Name should suggest improvement/enhancement
- Overall description should summarize the improvements`;

        userContent = [
          { type: "text", text: "Analyze this image and create an improved color palette with detailed explanations for each color choice:" },
          { type: "image_url", image_url: { url: imageUrlForAI } }
        ];
      } else {
        systemPrompt = `You are an expert color consultant and UX designer. Analyze this website URL - understand its likely purpose, target audience, industry, and typical color usage. Then create an IMPROVED color palette that would make it more effective, appealing, and professional.

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "colors": ["#HEX1", "#HEX2", "#HEX3", "#HEX4", "#HEX5"],
  "colorDescriptions": [
    "Replace the current primary brand color with #HEX1 and explain the improvement",
    "Replace the current secondary/support color with #HEX2 and explain the benefit",
    "Replace the current accent/CTA color with #HEX3 and explain conversion impact",
    "Replace the current background color with #HEX4 and explain readability gains",
    "Replace the current text/contrast color with #HEX5 and explain legibility improvements"
  ],
  "name": "Improved Palette Name",
  "description": "Overall explanation of how this palette improves the website's effectiveness"
}

Rules:
- Create exactly 5 colors that would IMPROVE the website's design
- Each colorDescription must explicitly say what should be replaced and why the new color is better
- Consider the industry, target audience, and conversion goals
- Use uppercase hex codes with # prefix
- Reference color psychology, UX best practices, and brand strategy`;

        userContent = [
          { type: "text", text: `Analyze this website (${assetUrl}) and create an improved color palette with detailed explanations for each color:` }
        ];
      }
    }

    console.log('Calling OpenAI API with mode:', mode);

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
        max_tokens: mode === 'improve' ? 600 : 300,
        temperature: mode === 'expand' ? 0.9 : 0.7,
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

    // Validate the palette - allow variable length for extract mode
    const minColors = mode === 'extract' ? 2 : 5;
    const maxColors = mode === 'extract' ? 10 : 6;

    if (!parsedPalette.colors || !Array.isArray(parsedPalette.colors)) {
      return new Response(
        JSON.stringify({ error: 'Invalid palette format from AI' }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (parsedPalette.colors.length < minColors || parsedPalette.colors.length > maxColors) {
      console.warn(`Color count ${parsedPalette.colors.length} outside expected range ${minColors}-${maxColors}`);
      // Don't fail, just warn - AI might have good reasons
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

    // Build response based on mode
    const response: Record<string, unknown> = {
      colors: parsedPalette.colors.map((c: string) => c.toUpperCase()),
      name: parsedPalette.name || 'Analyzed Palette',
      description: parsedPalette.description || 'Generated from asset analysis',
      mode: mode,
    };

    const normalizedColors = response.colors as string[];
    if (!Array.isArray(parsedPalette.colorDescriptions) || parsedPalette.colorDescriptions.length !== normalizedColors.length) {
      response.colorDescriptions =
        mode === 'improve'
          ? buildImproveFallbackDescriptions(normalizedColors)
          : buildFallbackColorDescriptions(normalizedColors);
    } else {
      response.colorDescriptions = parsedPalette.colorDescriptions;
    }

    // Save analyzed palette to public_palettes so it appears in the dashboard
    try {
      const tags: string[] = [
        'analyzed',
        String(mode),
        String(assetType),
      ];

      const { error: insertError } = await supabase
        .from('public_palettes')
        .insert({
          name: String(response.name || 'Analyzed Palette'),
          colors: response.colors as string[],
          tags,
          description: String(response.description || ''),
          color_descriptions: response.colorDescriptions as string[],
          created_by: userData.id,
        });

      if (insertError) {
        console.error('Failed to save analyzed palette:', insertError);
      } else {
        console.log('Analyzed palette saved to public_palettes');
      }
    } catch (e) {
      console.error('Failed to save analyzed palette (exception):', e);
    }

    console.log('=== analyze-asset completed successfully ===');

    return new Response(
      JSON.stringify(response),
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
