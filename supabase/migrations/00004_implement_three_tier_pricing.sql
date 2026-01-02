/*
# Implement Three-Tier Pricing Structure

## Overview
Replace the simple free/premium model with a comprehensive 3-tier system:
- FREE: 50 comics, 5 scans/month
- COLLECTOR: 1,000 comics, 50 scans/month ($4.99/month)
- PRO: Unlimited comics, unlimited scans ($12.99/month)

## Changes

1. New subscription_tier enum type
   - 'free' (default)
   - 'collector' ($4.99/month)
   - 'pro' ($12.99/month)

2. New columns in profiles table
   - subscription_tier: Current tier
   - monthly_scans_remaining: Scans left this month
   - monthly_scans_limit: Total scans per month for tier
   - comic_storage_limit: Max comics allowed for tier
   - scans_reset_date: When monthly scans reset
   - one_time_scans: Purchased scan packs

3. Storage and scan limits by tier
   - Free: 50 comics, 5 scans/month
   - Collector: 1,000 comics, 50 scans/month
   - Pro: unlimited comics, unlimited scans

4. Marketplace fees by tier
   - Free: 10%
   - Collector: 6%
   - Pro: 3%

## Migration Steps
1. Create subscription_tier enum
2. Add new columns to profiles
3. Set default values for existing users
4. Create helper functions for tier management
5. Create function to reset monthly scans
*/

-- Create subscription tier enum
CREATE TYPE subscription_tier AS ENUM ('free', 'collector', 'pro');

-- Add new columns to profiles table
ALTER TABLE profiles 
ADD COLUMN subscription_tier subscription_tier DEFAULT 'free'::subscription_tier NOT NULL,
ADD COLUMN monthly_scans_remaining integer DEFAULT 5 NOT NULL,
ADD COLUMN monthly_scans_limit integer DEFAULT 5 NOT NULL,
ADD COLUMN comic_storage_limit integer DEFAULT 50 NOT NULL,
ADD COLUMN scans_reset_date timestamptz DEFAULT (date_trunc('month', now()) + interval '1 month'),
ADD COLUMN one_time_scans integer DEFAULT 0 NOT NULL;

-- Update existing users to free tier with proper limits
UPDATE profiles 
SET 
  subscription_tier = 'free'::subscription_tier,
  monthly_scans_remaining = 5,
  monthly_scans_limit = 5,
  comic_storage_limit = 50,
  scans_reset_date = date_trunc('month', now()) + interval '1 month',
  one_time_scans = 0
WHERE subscription_tier IS NULL;

-- Function to get tier limits
CREATE OR REPLACE FUNCTION get_tier_limits(tier subscription_tier)
RETURNS TABLE(
  scans_per_month integer,
  storage_limit integer,
  marketplace_fee_percent numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE tier
      WHEN 'free' THEN 5
      WHEN 'collector' THEN 50
      WHEN 'pro' THEN 999999
    END as scans_per_month,
    CASE tier
      WHEN 'free' THEN 50
      WHEN 'collector' THEN 1000
      WHEN 'pro' THEN 999999
    END as storage_limit,
    CASE tier
      WHEN 'free' THEN 10.0
      WHEN 'collector' THEN 6.0
      WHEN 'pro' THEN 3.0
    END as marketplace_fee_percent;
END;
$$;

-- Function to check if user can add comic (storage limit)
CREATE OR REPLACE FUNCTION can_add_comic(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count integer;
  storage_limit integer;
BEGIN
  -- Get current comic count
  SELECT COUNT(*) INTO current_count
  FROM comics
  WHERE comics.user_id = can_add_comic.user_id;
  
  -- Get storage limit
  SELECT comic_storage_limit INTO storage_limit
  FROM profiles
  WHERE id = can_add_comic.user_id;
  
  RETURN current_count < storage_limit;
END;
$$;

-- Function to check if user can scan (monthly limit)
CREATE OR REPLACE FUNCTION can_scan(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  scans_remaining integer;
  one_time integer;
BEGIN
  -- Get scans remaining
  SELECT monthly_scans_remaining, one_time_scans 
  INTO scans_remaining, one_time
  FROM profiles
  WHERE id = can_scan.user_id;
  
  RETURN (scans_remaining > 0 OR one_time > 0);
END;
$$;

-- Function to use a scan
CREATE OR REPLACE FUNCTION use_scan(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  scans_remaining integer;
  one_time integer;
  reset_date timestamptz;
BEGIN
  -- Get current scan status
  SELECT monthly_scans_remaining, one_time_scans, scans_reset_date
  INTO scans_remaining, one_time, reset_date
  FROM profiles
  WHERE id = use_scan.user_id;
  
  -- Check if we need to reset monthly scans
  IF reset_date <= now() THEN
    -- Reset monthly scans based on tier
    UPDATE profiles
    SET 
      monthly_scans_remaining = monthly_scans_limit,
      scans_reset_date = date_trunc('month', now()) + interval '1 month'
    WHERE id = use_scan.user_id;
    
    -- Refresh values
    SELECT monthly_scans_remaining, one_time_scans
    INTO scans_remaining, one_time
    FROM profiles
    WHERE id = use_scan.user_id;
  END IF;
  
  -- Use one-time scans first, then monthly scans
  IF one_time > 0 THEN
    UPDATE profiles
    SET one_time_scans = one_time_scans - 1
    WHERE id = use_scan.user_id;
    RETURN true;
  ELSIF scans_remaining > 0 THEN
    UPDATE profiles
    SET monthly_scans_remaining = monthly_scans_remaining - 1
    WHERE id = use_scan.user_id;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- Function to upgrade user tier
CREATE OR REPLACE FUNCTION upgrade_tier(
  user_id uuid,
  new_tier subscription_tier,
  expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tier_limits RECORD;
BEGIN
  -- Get limits for new tier
  SELECT * INTO tier_limits FROM get_tier_limits(new_tier);
  
  -- Update user profile
  UPDATE profiles
  SET 
    subscription_tier = new_tier,
    subscription_expires_at = expires_at,
    monthly_scans_limit = tier_limits.scans_per_month,
    monthly_scans_remaining = tier_limits.scans_per_month,
    comic_storage_limit = tier_limits.storage_limit,
    scans_reset_date = date_trunc('month', now()) + interval '1 month'
  WHERE id = user_id;
END;
$$;

-- Function to add one-time scan pack
CREATE OR REPLACE FUNCTION add_scan_pack(user_id uuid, scan_count integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET one_time_scans = one_time_scans + scan_count
  WHERE id = user_id;
END;
$$;

-- Function to get user scan status
CREATE OR REPLACE FUNCTION get_scan_status(user_id uuid)
RETURNS TABLE(
  monthly_remaining integer,
  monthly_limit integer,
  one_time_remaining integer,
  reset_date timestamptz,
  tier subscription_tier
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.monthly_scans_remaining,
    p.monthly_scans_limit,
    p.one_time_scans,
    p.scans_reset_date,
    p.subscription_tier
  FROM profiles p
  WHERE p.id = user_id;
END;
$$;

-- Remove old free_scans_remaining column (replaced by monthly system)
ALTER TABLE profiles DROP COLUMN IF EXISTS free_scans_remaining;