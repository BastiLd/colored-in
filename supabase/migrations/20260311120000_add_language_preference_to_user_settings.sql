ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS language_preference TEXT NOT NULL DEFAULT 'en';
