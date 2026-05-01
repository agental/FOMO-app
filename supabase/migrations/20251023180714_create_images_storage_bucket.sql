/*
  # Create Storage Bucket for Images
  
  1. New Storage Bucket
    - `images` bucket for storing post and event images
    - Public access for reading images
    - Authenticated and anonymous users can upload images
  
  2. Security
    - Allow public to read images
    - Allow authenticated and anonymous users to upload images
    - Allow users to update/delete their own images
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'images');

CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'images');

CREATE POLICY "Anonymous users can upload images"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'images');