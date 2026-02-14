-- =====================================================
-- Migration: Add palette likes and user notes tables
-- Run this migration in your Supabase SQL editor
-- =====================================================

-- 1. Palette Likes table
CREATE TABLE IF NOT EXISTS public.palette_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  palette_id UUID NOT NULL REFERENCES public.public_palettes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(palette_id, user_id)
);

-- Add like_count column to public_palettes
ALTER TABLE public.public_palettes
  ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- RLS for palette_likes
ALTER TABLE public.palette_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all likes"
  ON public.palette_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own likes"
  ON public.palette_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
  ON public.palette_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update like_count on insert/delete
CREATE OR REPLACE FUNCTION update_palette_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.public_palettes
    SET like_count = like_count + 1
    WHERE id = NEW.palette_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.public_palettes
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.palette_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER palette_likes_count_trigger
  AFTER INSERT OR DELETE ON public.palette_likes
  FOR EACH ROW EXECUTE FUNCTION update_palette_like_count();

-- 2. User Notes table (for Chrome Extension notes system)
CREATE TABLE IF NOT EXISTS public.user_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#a78bfa',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own notes"
  ON public.user_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes"
  ON public.user_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON public.user_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON public.user_notes FOR DELETE
  USING (auth.uid() = user_id);
