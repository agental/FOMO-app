/*
  # Create post_ratings table — user ratings for community recommendations (posts)

  Each user can rate a recommendation 1–5 once (upsert on conflict).
  Mirrors the location_reviews pattern. Average is computed client-side.
*/

CREATE TABLE IF NOT EXISTS post_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE post_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read post ratings"
  ON post_ratings FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Users can create their own rating"
  ON post_ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rating"
  ON post_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rating"
  ON post_ratings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS post_ratings_post_id_idx ON post_ratings(post_id);
