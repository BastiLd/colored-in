-- Add Stripe columns to user_subscriptions table
ALTER TABLE public.user_subscriptions
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN stripe_subscription_id TEXT,
ADD COLUMN stripe_price_id TEXT;

-- Create index for faster lookups by Stripe IDs
CREATE INDEX idx_user_subscriptions_stripe_customer_id 
ON public.user_subscriptions(stripe_customer_id);

CREATE INDEX idx_user_subscriptions_stripe_subscription_id 
ON public.user_subscriptions(stripe_subscription_id);

-- Allow service role to manage subscriptions (needed for webhook updates)
CREATE POLICY "Service role can manage subscriptions"
ON public.user_subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow users to update their own subscription (for storing stripe_customer_id)
CREATE POLICY "Users can update own subscription"
ON public.user_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to insert their own subscription
CREATE POLICY "Users can insert own subscription"
ON public.user_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

