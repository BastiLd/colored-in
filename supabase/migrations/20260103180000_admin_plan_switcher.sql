-- Admin-only plan switching for testing (can be removed later)
-- Also tightens user_subscriptions RLS so users cannot self-upgrade via client writes.

-- Ensure RLS enabled
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Allow users to view only their own subscription
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_subscriptions'
      AND policyname = 'Users can view own subscription'
  ) THEN
    CREATE POLICY "Users can view own subscription"
    ON public.user_subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;

  -- Remove unsafe policies that allow any authenticated user to insert/update their own plan
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_subscriptions'
      AND policyname = 'Users can insert own subscription'
  ) THEN
    EXECUTE 'DROP POLICY "Users can insert own subscription" ON public.user_subscriptions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_subscriptions'
      AND policyname = 'Users can update own subscription'
  ) THEN
    EXECUTE 'DROP POLICY "Users can update own subscription" ON public.user_subscriptions';
  END IF;
END $$;

-- Admin-only helper to set a user's plan (security definer; uses has_role)
CREATE OR REPLACE FUNCTION public.admin_set_user_plan(
  _target_user_id uuid,
  _plan public.subscription_plan,
  _duration_days integer DEFAULT 30
)
RETURNS public.user_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_is_active boolean;
  v_expires_at timestamptz;
  v_row public.user_subscriptions;
BEGIN
  v_is_admin := public.has_role(auth.uid(), 'admin');
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  v_is_active := (_plan <> 'free');
  v_expires_at := CASE
    WHEN v_is_active THEN now() + make_interval(days => GREATEST(_duration_days, 1))
    ELSE NULL
  END;

  INSERT INTO public.user_subscriptions (
    user_id,
    plan,
    is_active,
    started_at,
    expires_at,
    updated_at,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id
  )
  VALUES (
    _target_user_id,
    _plan,
    v_is_active,
    now(),
    v_expires_at,
    now(),
    NULL,
    NULL,
    NULL
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    plan = EXCLUDED.plan,
    is_active = EXCLUDED.is_active,
    expires_at = EXCLUDED.expires_at,
    updated_at = now(),
    stripe_customer_id = NULL,
    stripe_subscription_id = NULL,
    stripe_price_id = NULL
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Convenience: admin can change own plan (for testing)
CREATE OR REPLACE FUNCTION public.admin_set_self_plan(
  _plan public.subscription_plan,
  _duration_days integer DEFAULT 30
)
RETURNS public.user_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.admin_set_user_plan(auth.uid(), _plan, _duration_days);
END;
$$;

-- Allow authenticated users to call the admin switcher functions (they still require admin role)
GRANT EXECUTE ON FUNCTION public.admin_set_user_plan(uuid, public.subscription_plan, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_self_plan(public.subscription_plan, integer) TO authenticated;


