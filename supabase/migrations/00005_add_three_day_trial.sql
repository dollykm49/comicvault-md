/*
# Add 3-Day Free Trial System

## Overview
Replaces the single free scan with a 3-day free trial that includes:
- 3 grading scans
- Full COLLECTOR tier access (1,000 comics storage, 6% marketplace fees)
- Automatic activation on registration
- Automatic expiration after 3 days

## Changes

### 1. New Columns in profiles table
- `trial_started_at` (timestamptz) - When the trial began
- `trial_expires_at` (timestamptz) - When the trial ends (3 days after start)
- `trial_scans_used` (integer) - Number of scans used during trial (max 3)

### 2. Database Functions

#### is_trial_active(user_id)
Returns true if user's trial is still active (not expired and has scans remaining)

#### get_effective_tier(user_id)
Returns the user's effective tier considering trial status:
- If trial is active: returns 'collector'
- Otherwise: returns actual subscription_tier

#### use_trial_scan(user_id)
Consumes one trial scan if trial is active and scans remain

#### start_trial(user_id)
Initializes the 3-day trial for a new user

### 3. Security
- All functions use SECURITY DEFINER for proper access control
- Trial automatically expires after 3 days
- Trial scans limited to 3 total

### 4. Migration Notes
- Existing users will NOT get a trial (trial_started_at remains NULL)
- New users will automatically get trial on registration
- Remove old free_scans_remaining column (deprecated)
*/

-- Add trial columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS trial_scans_used integer DEFAULT 0;

-- Remove deprecated free_scans_remaining column
ALTER TABLE profiles DROP COLUMN IF EXISTS free_scans_remaining;

-- Function to check if trial is active
CREATE OR REPLACE FUNCTION is_trial_active(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_record profiles%ROWTYPE;
BEGIN
  SELECT * INTO profile_record
  FROM profiles
  WHERE id = user_id;
  
  -- Trial is active if:
  -- 1. Trial was started (trial_started_at is not null)
  -- 2. Trial has not expired (trial_expires_at > now())
  -- 3. User has scans remaining (trial_scans_used < 3)
  RETURN profile_record.trial_started_at IS NOT NULL
    AND profile_record.trial_expires_at > now()
    AND profile_record.trial_scans_used < 3;
END;
$$;

-- Function to get effective tier (considering trial)
CREATE OR REPLACE FUNCTION get_effective_tier(user_id uuid)
RETURNS subscription_tier
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_record profiles%ROWTYPE;
BEGIN
  SELECT * INTO profile_record
  FROM profiles
  WHERE id = user_id;
  
  -- If trial is active, user gets COLLECTOR tier benefits
  IF is_trial_active(user_id) THEN
    RETURN 'collector'::subscription_tier;
  END IF;
  
  -- Otherwise return actual tier
  RETURN profile_record.subscription_tier;
END;
$$;

-- Function to use a trial scan
CREATE OR REPLACE FUNCTION use_trial_scan(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if trial is active
  IF NOT is_trial_active(user_id) THEN
    RETURN false;
  END IF;
  
  -- Increment trial scans used
  UPDATE profiles
  SET trial_scans_used = trial_scans_used + 1
  WHERE id = user_id;
  
  RETURN true;
END;
$$;

-- Function to start trial for new users
CREATE OR REPLACE FUNCTION start_trial(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET 
    trial_started_at = now(),
    trial_expires_at = now() + interval '3 days',
    trial_scans_used = 0
  WHERE id = user_id
    AND trial_started_at IS NULL; -- Only start trial if not already started
END;
$$;

-- Update the can_scan function to check trial first
CREATE OR REPLACE FUNCTION can_scan(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_record profiles%ROWTYPE;
  effective_tier subscription_tier;
BEGIN
  SELECT * INTO profile_record
  FROM profiles
  WHERE id = user_id;
  
  -- Check trial first
  IF is_trial_active(user_id) THEN
    RETURN true;
  END IF;
  
  -- Get effective tier
  effective_tier := get_effective_tier(user_id);
  
  -- Check based on tier
  IF effective_tier = 'pro'::subscription_tier THEN
    RETURN true; -- Unlimited scans
  END IF;
  
  -- Check monthly scans or one-time scans
  RETURN profile_record.monthly_scans_remaining > 0 
    OR profile_record.one_time_scans > 0;
END;
$$;

-- Update the use_scan function to use trial scans first
CREATE OR REPLACE FUNCTION use_scan(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_record profiles%ROWTYPE;
  effective_tier subscription_tier;
BEGIN
  SELECT * INTO profile_record
  FROM profiles
  WHERE id = user_id;
  
  -- Try to use trial scan first
  IF is_trial_active(user_id) THEN
    RETURN use_trial_scan(user_id);
  END IF;
  
  -- Get effective tier
  effective_tier := get_effective_tier(user_id);
  
  -- PRO tier has unlimited scans
  IF effective_tier = 'pro'::subscription_tier THEN
    RETURN true;
  END IF;
  
  -- Try to use monthly scan first
  IF profile_record.monthly_scans_remaining > 0 THEN
    UPDATE profiles
    SET monthly_scans_remaining = monthly_scans_remaining - 1
    WHERE id = user_id;
    RETURN true;
  END IF;
  
  -- Try to use one-time scan
  IF profile_record.one_time_scans > 0 THEN
    UPDATE profiles
    SET one_time_scans = one_time_scans - 1
    WHERE id = user_id;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Drop and recreate get_scan_status to include trial information
DROP FUNCTION IF EXISTS get_scan_status(uuid);

CREATE OR REPLACE FUNCTION get_scan_status(user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_record profiles%ROWTYPE;
  effective_tier subscription_tier;
  trial_active boolean;
  trial_scans_remaining integer;
BEGIN
  SELECT * INTO profile_record
  FROM profiles
  WHERE id = user_id;
  
  effective_tier := get_effective_tier(user_id);
  trial_active := is_trial_active(user_id);
  
  IF trial_active THEN
    trial_scans_remaining := 3 - profile_record.trial_scans_used;
  ELSE
    trial_scans_remaining := 0;
  END IF;
  
  RETURN json_build_object(
    'tier', effective_tier,
    'monthly_scans_remaining', profile_record.monthly_scans_remaining,
    'monthly_scans_limit', profile_record.monthly_scans_limit,
    'one_time_scans', profile_record.one_time_scans,
    'trial_active', trial_active,
    'trial_scans_remaining', trial_scans_remaining,
    'trial_expires_at', profile_record.trial_expires_at,
    'can_scan', can_scan(user_id)
  );
END;
$$;

-- Update can_add_comic to consider trial status
CREATE OR REPLACE FUNCTION can_add_comic(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_record profiles%ROWTYPE;
  effective_tier subscription_tier;
  tier_limits json;
  current_count integer;
BEGIN
  SELECT * INTO profile_record
  FROM profiles
  WHERE id = user_id;
  
  effective_tier := get_effective_tier(user_id);
  tier_limits := get_tier_limits(effective_tier);
  
  -- PRO tier has unlimited storage
  IF (tier_limits->>'comic_storage_limit')::integer = -1 THEN
    RETURN true;
  END IF;
  
  -- Count user's current comics
  SELECT COUNT(*) INTO current_count
  FROM comics
  WHERE user_id = can_add_comic.user_id;
  
  RETURN current_count < (tier_limits->>'comic_storage_limit')::integer;
END;
$$;

-- Create trigger to automatically start trial for new users
CREATE OR REPLACE FUNCTION trigger_start_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Start trial for new user
  NEW.trial_started_at := now();
  NEW.trial_expires_at := now() + interval '3 days';
  NEW.trial_scans_used := 0;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_profile_created_start_trial ON profiles;

-- Create trigger on profile creation
CREATE TRIGGER on_profile_created_start_trial
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_start_trial();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_trial_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_effective_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION use_trial_scan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION start_trial(uuid) TO authenticated;
