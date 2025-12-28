-- Create public_palettes table to store AI-generated palettes
CREATE TABLE public.public_palettes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    colors TEXT[] NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.public_palettes ENABLE ROW LEVEL SECURITY;

-- Everyone can view public palettes
CREATE POLICY "Anyone can view public palettes"
ON public.public_palettes
FOR SELECT
USING (true);

-- Authenticated users can insert palettes
CREATE POLICY "Authenticated users can create palettes"
ON public.public_palettes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Create user_ai_generations table to track free AI generations per user
CREATE TABLE public.user_ai_generations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    generation_count INTEGER NOT NULL DEFAULT 0,
    last_generation_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_ai_generations ENABLE ROW LEVEL SECURITY;

-- Users can view their own generation count
CREATE POLICY "Users can view own generation count"
ON public.user_ai_generations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own record
CREATE POLICY "Users can insert own generation record"
ON public.user_ai_generations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own generation count
CREATE POLICY "Users can update own generation count"
ON public.user_ai_generations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create profiles table for user info
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email);
    
    INSERT INTO public.user_ai_generations (user_id, generation_count)
    VALUES (NEW.id, 0);
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();