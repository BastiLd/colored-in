-- Create user_assets table for storing uploaded images and links
CREATE TABLE public.user_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('image', 'link')),
    url TEXT NOT NULL,
    filename TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_user_assets_user_id ON public.user_assets(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;

-- Users can manage own assets
CREATE POLICY "Users can manage own assets"
ON public.user_assets FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Note: To create Supabase Storage bucket 'user-assets':
-- 1. Go to Supabase Dashboard → Storage
-- 2. Create new bucket: 'user-assets'
-- 3. Set bucket to PRIVATE
-- 4. Add RLS policy for bucket:
--    - Allow authenticated users to upload/read/delete their own files
--    - File path structure: {user_id}/{filename}

