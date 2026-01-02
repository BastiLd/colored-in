// NOTE: Supabase Edge Functions run on Deno, but this repo’s TypeScript tooling
// (Vite/tsconfig) doesn’t include Deno globals. This shim fixes editor/TS errors
// like “Cannot find name 'Deno'” without affecting runtime behavior.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// Map Stripe Price IDs to plan names
const PRICE_TO_PLAN: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_PRO') || 'price_pro_monthly']: 'pro',
  [Deno.env.get('STRIPE_PRICE_ULTRA') || 'price_ultra_monthly']: 'ultra',
  [Deno.env.get('STRIPE_PRICE_INDIVIDUAL') || 'price_individual_monthly']: 'individual',
};

// Verify Stripe webhook signature using Web Crypto API
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Extract timestamp and signatures from header
    const elements = signature.split(',');
    const timestamp = elements.find((e) => e.startsWith('t='))?.split('=')[1];
    const signatures = elements
      .filter((e) => e.startsWith('v1='))
      .map((e) => e.split('=')[1]);

    if (!timestamp || signatures.length === 0) {
      return false;
    }

    // Create signed payload
    const signedPayload = `${timestamp}.${payload}`;

    // Get the webhook secret key (remove 'whsec_' prefix if present)
    const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret;

    // Decode secret from base64
    const keyData = Uint8Array.from(atob(secretKey), (c) => c.charCodeAt(0));

    // Import key for HMAC
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign the payload
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      new TextEncoder().encode(signedPayload)
    );

    // Convert to hex
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Compare signatures
    return signatures.some((sig) => sig === computedSignature);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Stripe API helper
async function stripeRequest(
  secretKey: string,
  method: string,
  path: string
): Promise<Response> {
  const url = `https://api.stripe.com/v1${path}`;
  return fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${secretKey}`,
    },
  });
}

// Supabase database helper
async function supabaseRequest(
  supabaseUrl: string,
  serviceKey: string,
  method: string,
  path: string,
  body?: unknown,
  prefer?: string
): Promise<Response> {
  const headers: Record<string, string> = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Prefer': prefer ?? 'return=representation',
  };

  return fetch(`${supabaseUrl}/rest/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!stripeSecretKey || !webhookSecret) {
    console.error('Missing Stripe configuration');
    return new Response(
      JSON.stringify({ error: 'Webhook not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get the signature from headers
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    console.error('No stripe-signature header');
    return new Response(
      JSON.stringify({ error: 'No signature provided' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.text();

    // Verify webhook signature
    const isValid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error('Webhook signature verification failed');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = JSON.parse(body);
    console.log('Received webhook event:', event.type, event.id);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutCompleted(supabaseUrl, supabaseServiceKey, stripeSecretKey, session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionUpdated(supabaseUrl, supabaseServiceKey, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(supabaseUrl, supabaseServiceKey, subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await handlePaymentFailed(supabaseUrl, supabaseServiceKey, invoice);
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleCheckoutCompleted(
  supabaseUrl: string,
  serviceKey: string,
  stripeSecretKey: string,
  session: any
) {
  console.log('Processing checkout.session.completed:', session.id);

  const userId = session.metadata?.supabase_user_id;
  const planKey = session.metadata?.plan_key;

  if (!userId || !planKey) {
    console.error('Missing metadata in checkout session');
    return;
  }

  // Get the subscription details
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    console.error('No subscription ID in session');
    return;
  }

  // Fetch subscription from Stripe API
  const subResponse = await stripeRequest(stripeSecretKey, 'GET', `/subscriptions/${subscriptionId}`);
  if (!subResponse.ok) {
    console.error('Failed to fetch subscription from Stripe');
    return;
  }

  const subscription = await subResponse.json();
  const priceId = subscription.items?.data?.[0]?.price?.id;

  // Calculate expiration date (end of current billing period)
  const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

  // Upsert user subscription in database (prevents duplicate user_id on renewals)
  // Supabase REST upsert: POST + on_conflict + Prefer: resolution=merge-duplicates
  const response = await supabaseRequest(
    supabaseUrl,
    serviceKey,
    'POST',
    '/user_subscriptions?on_conflict=user_id',
    {
      user_id: userId,
      plan: planKey,
      is_active: true,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      expires_at: expiresAt,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    'resolution=merge-duplicates,return=representation'
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Error updating subscription:', error);
  } else {
    console.log('Subscription activated for user:', userId, 'plan:', planKey);
  }
}

async function handleSubscriptionUpdated(
  supabaseUrl: string,
  serviceKey: string,
  subscription: any
) {
  console.log('Processing customer.subscription.updated:', subscription.id);

  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.error('No supabase_user_id in subscription metadata');
    return;
  }

  const priceId = subscription.items?.data?.[0]?.price?.id;
  const planKey = PRICE_TO_PLAN[priceId] || 'free';
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';
  const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

  const response = await supabaseRequest(
    supabaseUrl,
    serviceKey,
    'PATCH',
    `/user_subscriptions?user_id=eq.${userId}`,
    {
      plan: planKey,
      is_active: isActive,
      stripe_price_id: priceId,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Error updating subscription:', error);
  } else {
    console.log('Subscription updated for user:', userId, 'plan:', planKey, 'active:', isActive);
  }
}

async function handleSubscriptionDeleted(
  supabaseUrl: string,
  serviceKey: string,
  subscription: any
) {
  console.log('Processing customer.subscription.deleted:', subscription.id);

  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    // Try to find user by stripe_subscription_id
    const findResponse = await supabaseRequest(
      supabaseUrl,
      serviceKey,
      'GET',
      `/user_subscriptions?stripe_subscription_id=eq.${subscription.id}&select=user_id`
    );

    if (!findResponse.ok) {
      console.error('Could not find user for deleted subscription');
      return;
    }

    const data = await findResponse.json();
    if (!data || data.length === 0) {
      console.error('Could not find user for deleted subscription');
      return;
    }

    const updateResponse = await supabaseRequest(
      supabaseUrl,
      serviceKey,
      'PATCH',
      `/user_subscriptions?user_id=eq.${data[0].user_id}`,
      {
        plan: 'free',
        is_active: true,
        stripe_subscription_id: null,
        stripe_price_id: null,
        expires_at: null,
        updated_at: new Date().toISOString(),
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.error('Error resetting subscription:', error);
    } else {
      console.log('Subscription cancelled, reverted to free plan for user:', data[0].user_id);
    }
    return;
  }

  const response = await supabaseRequest(
    supabaseUrl,
    serviceKey,
    'PATCH',
    `/user_subscriptions?user_id=eq.${userId}`,
    {
      plan: 'free',
      is_active: true,
      stripe_subscription_id: null,
      stripe_price_id: null,
      expires_at: null,
      updated_at: new Date().toISOString(),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Error resetting subscription:', error);
  } else {
    console.log('Subscription cancelled, reverted to free plan for user:', userId);
  }
}

async function handlePaymentFailed(
  supabaseUrl: string,
  serviceKey: string,
  invoice: any
) {
  console.log('Processing invoice.payment_failed:', invoice.id);

  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) {
    console.log('No subscription ID in failed invoice');
    return;
  }

  // Find user by subscription ID
  const findResponse = await supabaseRequest(
    supabaseUrl,
    serviceKey,
    'GET',
    `/user_subscriptions?stripe_subscription_id=eq.${subscriptionId}&select=user_id`
  );

  if (!findResponse.ok) {
    console.error('Could not find user for failed payment');
    return;
  }

  const data = await findResponse.json();
  if (!data || data.length === 0) {
    console.error('Could not find user for failed payment');
    return;
  }

  // Mark subscription as inactive due to payment failure
  const response = await supabaseRequest(
    supabaseUrl,
    serviceKey,
    'PATCH',
    `/user_subscriptions?user_id=eq.${data[0].user_id}`,
    {
      is_active: false,
      updated_at: new Date().toISOString(),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Error marking subscription inactive:', error);
  } else {
    console.log('Subscription marked inactive due to payment failure for user:', data[0].user_id);
  }
}
