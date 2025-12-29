Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const pricePro = Deno.env.get('STRIPE_PRICE_PRO')!;
    const priceUltra = Deno.env.get('STRIPE_PRICE_ULTRA')!;
    const priceIndividual = Deno.env.get('STRIPE_PRICE_INDIVIDUAL')!;

    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Service unavailable' }), {
        status: 503,
        headers: corsHeaders,
      });
    }

    const auth = req.headers.get('Authorization');
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Auth required' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = auth.replace('Bearer ', '');
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseKey },
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Invalid auth' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const user = await userRes.json();
    const body = await req.json();
    const { planKey } = body;

    const priceMap: Record<string, string> = {
      pro: pricePro,
      ultra: priceUltra,
      individual: priceIndividual,
    };
    const priceId = priceMap[planKey];
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const subRes = await fetch(
      `${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${user.id}&select=stripe_customer_id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const subData = subRes.ok ? await subRes.json() : [];
    let customerId = subData[0]?.stripe_customer_id;

    if (!customerId) {
      const custRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: user.email || '',
          'metadata[supabase_user_id]': user.id,
        }),
      });
      const customer = await custRes.json();
      customerId = customer.id;

      await fetch(`${supabaseUrl}/rest/v1/user_subscriptions`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          user_id: user.id,
          stripe_customer_id: customerId,
          plan: 'free',
          is_active: true,
        }),
      });
    }

    const origin = req.headers.get('origin') || 'http://localhost:8080';
    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
        'payment_method_types[0]': 'card',
        mode: 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        success_url: body.successUrl || `${origin}/dashboard?checkout=success`,
        cancel_url: body.cancelUrl || `${origin}/pricing?checkout=canceled`,
        'metadata[supabase_user_id]': user.id,
        'metadata[plan_key]': planKey,
        'subscription_data[metadata][supabase_user_id]': user.id,
        'subscription_data[metadata][plan_key]': planKey,
      }),
    });

    const session = await sessionRes.json();
    if (!session.url) {
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

