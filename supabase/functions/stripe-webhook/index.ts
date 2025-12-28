import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// Map Stripe Price IDs to plan names
// These should match your Stripe Dashboard configuration
const PRICE_TO_PLAN: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_PRO') || 'price_pro_monthly']: 'pro',
  [Deno.env.get('STRIPE_PRICE_ULTRA') || 'price_ultra_monthly']: 'ultra',
  [Deno.env.get('STRIPE_PRICE_INDIVIDUAL') || 'price_individual_monthly']: 'individual',
};

serve(async (req) => {
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

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Received webhook event:', event.type, event.id);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, stripe, session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
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
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  session: Stripe.Checkout.Session
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

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;

  // Calculate expiration date (end of current billing period)
  const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

  // Update user subscription in database
  const { error } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: userId,
      plan: planKey,
      is_active: true,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      expires_at: expiresAt,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Error updating subscription:', error);
  } else {
    console.log('Subscription activated for user:', userId, 'plan:', planKey);
  }
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  console.log('Processing customer.subscription.updated:', subscription.id);

  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.error('No supabase_user_id in subscription metadata');
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const planKey = PRICE_TO_PLAN[priceId] || 'free';
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';
  const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      plan: planKey,
      is_active: isActive,
      stripe_price_id: priceId,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating subscription:', error);
  } else {
    console.log('Subscription updated for user:', userId, 'plan:', planKey, 'active:', isActive);
  }
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  console.log('Processing customer.subscription.deleted:', subscription.id);

  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    // Try to find user by stripe_subscription_id
    const { data } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (!data) {
      console.error('Could not find user for deleted subscription');
      return;
    }

    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        plan: 'free',
        is_active: true,
        stripe_subscription_id: null,
        stripe_price_id: null,
        expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', data.user_id);

    if (error) {
      console.error('Error resetting subscription:', error);
    } else {
      console.log('Subscription cancelled, reverted to free plan for user:', data.user_id);
    }
    return;
  }

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      plan: 'free',
      is_active: true,
      stripe_subscription_id: null,
      stripe_price_id: null,
      expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error resetting subscription:', error);
  } else {
    console.log('Subscription cancelled, reverted to free plan for user:', userId);
  }
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  console.log('Processing invoice.payment_failed:', invoice.id);

  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) {
    console.log('No subscription ID in failed invoice');
    return;
  }

  // Find user by subscription ID
  const { data } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!data) {
    console.error('Could not find user for failed payment');
    return;
  }

  // Mark subscription as inactive due to payment failure
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', data.user_id);

  if (error) {
    console.error('Error marking subscription inactive:', error);
  } else {
    console.log('Subscription marked inactive due to payment failure for user:', data.user_id);
  }
}

