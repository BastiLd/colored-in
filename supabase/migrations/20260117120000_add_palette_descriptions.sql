-- Add palette descriptions for AI-generated palettes
ALTER TABLE public.public_palettes
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS color_descriptions TEXT[];

