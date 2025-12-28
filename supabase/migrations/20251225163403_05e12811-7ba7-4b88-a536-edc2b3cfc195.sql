-- Allow users to update their own palettes
CREATE POLICY "Users can update own palettes"
ON public.public_palettes
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Allow users to delete their own palettes
CREATE POLICY "Users can delete own palettes"
ON public.public_palettes
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);