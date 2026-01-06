// NOTE: Supabase Edge Functions run on Deno
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

Deno.serve((req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return Promise.resolve(new Response(null, { headers: corsHeaders }));
  }

  return (async () => {
    try {
      console.log('=== Cancel Subscription Function Started ===');

      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!stripeKey) {
        console.error('STRIPE_SECRET_KEY not configured');
        return new Response(JSON.stringify({ error: 'Service unavailable' }), {
          status: 503,
          headers: corsHeaders,
        });
      }

      if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase configuration missing');
        return new Response(JSON.stringify({ error: 'Service configuration error' }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      // Get user from auth header
      const auth = req.headers.get('Authorization');
      if (!auth) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      const token = auth.replace('Bearer ', '');
      
      // Verify user with Supabase Auth API
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: supabaseKey },
      });

      if (!userRes.ok) {
        const errorBody = await userRes.text();
        console.error('Auth verification failed:', errorBody);
        return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      const user = await userRes.json();
      console.log('User authenticated:', user.id);

      // Get user's subscription from database
      const subRes = await fetch(
        `${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${user.id}&select=stripe_subscription_id,plan,is_active`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );

      if (!subRes.ok) {
        console.error('Failed to fetch subscription data');
        return new Response(JSON.stringify({ error: 'Failed to fetch subscription data' }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      const subData = await subRes.json();
      const subscription = subData[0];

      if (!subscription || !subscription.stripe_subscription_id) {
        return new Response(JSON.stringify({ error: 'No active subscription found' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      if (subscription.plan === 'free') {
        return new Response(JSON.stringify({ error: 'Cannot cancel a free plan' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      console.log('Canceling subscription:', subscription.stripe_subscription_id);

      // Cancel subscription at period end via Stripe API
      const stripeRes = await fetch(
        `https://api.stripe.com/v1/subscriptions/${subscription.stripe_subscription_id}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'cancel_at_period_end=true',
        }
      );

      if (!stripeRes.ok) {
        const stripeError = await stripeRes.text();
        console.error('Stripe API error:', stripeError);
        return new Response(JSON.stringify({ error: 'Failed to cancel subscription with Stripe' }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      const stripeSubscription = await stripeRes.json();
      console.log('Stripe subscription updated:', {
        id: stripeSubscription.id,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        current_period_end: stripeSubscription.current_period_end,
      });

      // The webhook will handle the database update when the subscription actually ends
      // For now, we can optionally mark it as "pending cancellation" in our database
      // But we'll let the user keep their benefits until the period ends

      console.log('=== Subscription cancellation scheduled successfully ===');

      return new Response(JSON.stringify({
        success: true,
        message: 'Subscription will be canceled at the end of the current billing period',
        cancel_at: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      }), {
        status: 200,
        headers: corsHeaders,
      });

    } catch (error) {
      console.error('Error in cancel-subscription function:', error);
      return new Response(JSON.stringify({ 
        error: 'An unexpected error occurred. Please try again.' 
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  })();
});

