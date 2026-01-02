/*
# Add Profile Fields for Marketplace

## 1. New Columns Added to profiles table
- `full_name` (text) - User's full name for shipping/billing
- `phone` (text) - Contact phone number
- `address_line1` (text) - Street address line 1
- `address_line2` (text) - Street address line 2 (optional)
- `city` (text) - City
- `state` (text) - State/Province
- `postal_code` (text) - ZIP/Postal code
- `country` (text) - Country
- `bio` (text) - User bio/description
- `avatar_url` (text) - Profile picture URL
- `email_verified` (boolean) - Email verification status

## 2. Purpose
These fields are required for:
- Marketplace transactions (shipping address)
- User profiles and identity
- Contact information
- Email verification

## 3. Security
- All fields are optional except email_verified (defaults to false)
- Users can update their own profile
- Admin can view all profiles
*/

-- Add new columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS address_line1 text,
ADD COLUMN IF NOT EXISTS address_line2 text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- Update existing profiles to have email_verified = false
UPDATE profiles SET email_verified = false WHERE email_verified IS NULL;
