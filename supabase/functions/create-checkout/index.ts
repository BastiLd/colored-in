Deno.serve((req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return Promise.resolve(new Response(null, { headers: corsHeaders }));
  }

  return (async () => {
    try {
      // #region agent log
      const log1 = {location:'create-checkout/index.ts:12',message:'edge function entry',data:{method:req.method,hasAuthHeader:!!req.headers.get('Authorization')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
      await fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(log1)}).catch(()=>{});
      // #endregion

      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const pricePro = Deno.env.get('STRIPE_PRICE_PRO')!;
      const priceUltra = Deno.env.get('STRIPE_PRICE_ULTRA')!;
      const priceIndividual = Deno.env.get('STRIPE_PRICE_INDIVIDUAL')!;

      // #region agent log
      const log2 = {location:'create-checkout/index.ts:20',message:'env vars check',data:{hasStripeKey:!!stripeKey,hasSupabaseUrl:!!supabaseUrl,hasSupabaseKey:!!supabaseKey,hasPricePro:!!pricePro,hasPriceUltra:!!priceUltra,hasPriceIndividual:!!priceIndividual},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
      await fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(log2)}).catch(()=>{});
      // #endregion

      if (!stripeKey) {
        return new Response(JSON.stringify({ error: 'Service unavailable' }), {
          status: 503,
          headers: corsHeaders,
        });
      }

      const auth = req.headers.get('Authorization');
      // #region agent log
      const log3 = {location:'create-checkout/index.ts:30',message:'auth header check',data:{hasAuth:!!auth,authPreview:auth ? auth.slice(0,30) + '...' : null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
      await fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(log3)}).catch(()=>{});
      // #endregion
      
      if (!auth) {
        return new Response(JSON.stringify({ error: 'Auth required' }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      const token = auth.replace('Bearer ', '');
      // #region agent log
      const log4 = {location:'create-checkout/index.ts:40',message:'verifying token with supabase',data:{tokenLength:token.length,tokenPreview:token.slice(0,20) + '...',supabaseUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'};
      await fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(log4)}).catch(()=>{});
      // #endregion
      
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: supabaseKey },
      });

      // #region agent log
      const log5 = {location:'create-checkout/index.ts:46',message:'supabase auth response',data:{status:userRes.status,statusText:userRes.statusText,ok:userRes.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'};
      await fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(log5)}).catch(()=>{});
      // #endregion

      if (!userRes.ok) {
        const errorBody = await userRes.text();
        // #region agent log
        const log6 = {location:'create-checkout/index.ts:51',message:'token verification failed',data:{status:userRes.status,errorBody:errorBody.slice(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'};
        await fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(log6)}).catch(()=>{});
        // #endregion
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

        // Upsert so we don't fail if a row already exists
        await fetch(`${supabaseUrl}/rest/v1/user_subscriptions?on_conflict=user_id`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation',
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
        { status: 500, headers: corsHeaders }
      );
    }
  })();
});
