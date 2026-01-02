/*
# Create Comic Vault Database Schema

## 1. New Tables

### profiles
- `id` (uuid, primary key, references auth.users)
- `username` (text, unique, not null)
- `email` (text)
- `role` (user_role enum: 'user', 'admin', 'subscriber')
- `subscription_expires_at` (timestamptz) - for tracking subscription status
- `created_at` (timestamptz)

### comics
- `id` (uuid, primary key)
- `user_id` (uuid, references profiles)
- `title` (text, not null)
- `issue_number` (text)
- `publisher` (text)
- `publish_year` (integer)
- `condition` (text) - e.g., "Mint", "Near Mint", "Very Fine", etc.
- `grade` (numeric) - 1-10 scale
- `estimated_value` (numeric)
- `cover_image_url` (text)
- `notes` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### marketplace_listings
- `id` (uuid, primary key)
- `comic_id` (uuid, references comics)
- `seller_id` (uuid, references profiles)
- `price` (numeric, not null)
- `status` (listing_status enum: 'active', 'sold', 'cancelled')
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### grading_requests
- `id` (uuid, primary key)
- `user_id` (uuid, references profiles)
- `comic_id` (uuid, references comics, nullable)
- `image_urls` (jsonb) - array of uploaded images
- `condition_notes` (text)
- `grade_result` (numeric)
- `value_estimate` (numeric)
- `status` (grading_status enum: 'pending', 'completed')
- `created_at` (timestamptz)
- `completed_at` (timestamptz)

### orders
- `id` (uuid, primary key)
- `user_id` (uuid, references profiles)
- `items` (jsonb, not null)
- `total_amount` (numeric, not null)
- `currency` (text, default 'usd')
- `status` (order_status enum: 'pending', 'completed', 'cancelled', 'refunded')
- `stripe_session_id` (text, unique)
- `stripe_payment_intent_id` (text)
- `customer_email` (text)
- `customer_name` (text)
- `completed_at` (timestamptz)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

## 2. Storage Bucket
- Create `app-7whklnxpov0h_comic_images` bucket for comic photos

## 3. Security
- Enable RLS on all tables
- Create admin helper function
- Profiles: Admins full access, users can view/edit own
- Comics: Users can manage own comics, all can view
- Marketplace: All can view active listings, sellers can manage own
- Grading requests: Users can view/create own, admins can view all
- Orders: Users can view own orders, service role can manage
- Storage: Authenticated users can upload, all can read

## 4. Triggers
- Auto-sync new users to profiles (first user becomes admin)
- Auto-update timestamps
*/

-- Create enums
CREATE TYPE user_role AS ENUM ('user', 'admin', 'subscriber');
CREATE TYPE listing_status AS ENUM ('active', 'sold', 'cancelled');
CREATE TYPE grading_status AS ENUM ('pending', 'completed');
CREATE TYPE order_status AS ENUM ('pending', 'completed', 'cancelled', 'refunded');

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  email text,
  role user_role DEFAULT 'user'::user_role NOT NULL,
  subscription_expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create comics table
CREATE TABLE IF NOT EXISTS comics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  issue_number text,
  publisher text,
  publish_year integer,
  condition text,
  grade numeric(3,1),
  estimated_value numeric(10,2),
  cover_image_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create marketplace_listings table
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comic_id uuid REFERENCES comics(id) ON DELETE CASCADE NOT NULL,
  seller_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  price numeric(10,2) NOT NULL,
  status listing_status DEFAULT 'active'::listing_status NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create grading_requests table
CREATE TABLE IF NOT EXISTS grading_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  comic_id uuid REFERENCES comics(id) ON DELETE SET NULL,
  image_urls jsonb,
  condition_notes text,
  grade_result numeric(3,1),
  value_estimate numeric(10,2),
  status grading_status DEFAULT 'pending'::grading_status NOT NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  items jsonb NOT NULL,
  total_amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status order_status NOT NULL DEFAULT 'pending'::order_status,
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  customer_email text,
  customer_name text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_comics_user_id ON comics(user_id);
CREATE INDEX idx_marketplace_listings_seller_id ON marketplace_listings(seller_id);
CREATE INDEX idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX idx_grading_requests_user_id ON grading_requests(user_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Create storage bucket for comic images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-7whklnxpov0h_comic_images',
  'app-7whklnxpov0h_comic_images',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
) ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE comics ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create admin helper function
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'admin'::user_role
  );
$$;

-- Profiles policies
CREATE POLICY "Admins have full access to profiles" ON profiles
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile without changing role" ON profiles
  FOR UPDATE USING (auth.uid() = id) 
  WITH CHECK (role IS NOT DISTINCT FROM (SELECT role FROM profiles WHERE id = auth.uid()));

-- Comics policies
CREATE POLICY "Anyone can view comics" ON comics
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own comics" ON comics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comics" ON comics
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comics" ON comics
  FOR DELETE USING (auth.uid() = user_id);

-- Marketplace listings policies
CREATE POLICY "Anyone can view active listings" ON marketplace_listings
  FOR SELECT USING (status = 'active'::listing_status OR seller_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Users can create listings for own comics" ON marketplace_listings
  FOR INSERT WITH CHECK (
    auth.uid() = seller_id AND
    EXISTS (SELECT 1 FROM comics WHERE id = comic_id AND user_id = auth.uid())
  );

CREATE POLICY "Sellers can update own listings" ON marketplace_listings
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete own listings" ON marketplace_listings
  FOR DELETE USING (auth.uid() = seller_id);

-- Grading requests policies
CREATE POLICY "Users can view own grading requests" ON grading_requests
  FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Users can create grading requests" ON grading_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update grading requests" ON grading_requests
  FOR UPDATE USING (is_admin(auth.uid()));

-- Orders policies
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage orders" ON orders
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Storage policies
CREATE POLICY "Authenticated users can upload comic images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-7whklnxpov0h_comic_images');

CREATE POLICY "Anyone can view comic images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'app-7whklnxpov0h_comic_images');

CREATE POLICY "Users can update own uploads"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'app-7whklnxpov0h_comic_images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'app-7whklnxpov0h_comic_images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger function for new user sync
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count int;
  extracted_username text;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;
  
  -- Extract username from email (remove @miaoda.com)
  extracted_username := REPLACE(NEW.email, '@miaoda.com', '');
  
  INSERT INTO profiles (id, username, email, role)
  VALUES (
    NEW.id,
    extracted_username,
    NEW.email,
    CASE WHEN user_count = 0 THEN 'admin'::user_role ELSE 'user'::user_role END
  );
  RETURN NEW;
END;
$$;

-- Create trigger for user sync
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for timestamp updates
CREATE TRIGGER update_comics_updated_at
  BEFORE UPDATE ON comics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_marketplace_listings_updated_at
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();