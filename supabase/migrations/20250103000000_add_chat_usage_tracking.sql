-- Rename table for clarity (from user_ai_generations to user_ai_usage)
ALTER TABLE public.user_ai_generations RENAME TO user_ai_usage;

-- Add chat-specific columns
ALTER TABLE public.user_ai_usage 
ADD COLUMN chat_messages_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN chat_messages_reset_at TIMESTAMP WITH TIME ZONE DEFAULT date_trunc('month', now()),
ADD COLUMN palette_generations_reset_at TIMESTAMP WITH TIME ZONE DEFAULT date_trunc('month', now()),
ADD COLUMN last_chat_at TIMESTAMP WITH TIME ZONE;

-- Rename generation_count to palette_generations_count
ALTER TABLE public.user_ai_usage 
RENAME COLUMN generation_count TO palette_generations_count;

-- Update RLS policies to use new table name
DROP POLICY IF EXISTS "Users can view own generation count" ON public.user_ai_usage;
DROP POLICY IF EXISTS "Users can insert own generation record" ON public.user_ai_usage;
DROP POLICY IF EXISTS "Users can update own generation count" ON public.user_ai_usage;

CREATE POLICY "Users can view own usage"
ON public.user_ai_usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage record"
ON public.user_ai_usage
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
ON public.user_ai_usage
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Service role needs full access for Edge Functions
CREATE POLICY "Service role can manage usage"
ON public.user_ai_usage
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create user_chat_history table for optional chat storage
CREATE TABLE public.user_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    palette_context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_chat_history_user_id ON public.user_chat_history(user_id, created_at DESC);

-- RLS policies for chat history
ALTER TABLE public.user_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat history"
ON public.user_chat_history FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert chat history"
ON public.user_chat_history FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Users can delete own chat history"
ON public.user_chat_history FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create user_settings table
CREATE TABLE public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    save_chat_history BOOLEAN NOT NULL DEFAULT false,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS policies for user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings"
ON public.user_settings FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Update the handle_new_user trigger to include user_settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email);
    
    INSERT INTO public.user_ai_usage (user_id, palette_generations_count, chat_messages_count)
    VALUES (NEW.id, 0, 0);
    
    INSERT INTO public.user_settings (user_id, save_chat_history, last_activity)
    VALUES (NEW.id, false, now());
    
    RETURN NEW;
END;
$$;

-- Account cleanup function (deletes accounts inactive for 1 year)
CREATE OR REPLACE FUNCTION public.cleanup_inactive_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM auth.users
    WHERE id IN (
        SELECT user_id 
        FROM public.user_settings
        WHERE last_activity < now() - interval '1 year'
    );
END;
$$;

-- Note: To enable automatic cleanup, you need pg_cron extension
-- Run this in Supabase SQL Editor after enabling pg_cron:
-- SELECT cron.schedule('cleanup-inactive-accounts', '0 0 1 * *', 'SELECT public.cleanup_inactive_accounts()');

