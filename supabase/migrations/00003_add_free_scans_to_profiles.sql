/*
# Add Free Scans to Profiles

## Overview
Give each new user 1 free grading scan to test the feature before purchasing a subscription.

## Changes
1. Add `free_scans_remaining` column to profiles table
   - Type: integer
   - Default: 1 (one free scan for new users)
   - Not null
2. Create function to decrement free scans
3. Update existing users to have 1 free scan

## Business Logic
- New users get 1 free scan automatically
- Free scans are checked before subscription requirement
- Once free scans are used, subscription is required
- Admins can manually adjust free scan count if needed
*/

-- Add free_scans_remaining column to profiles
ALTER TABLE profiles 
ADD COLUMN free_scans_remaining integer DEFAULT 1 NOT NULL;

-- Update existing users to have 1 free scan
UPDATE profiles 
SET free_scans_remaining = 1 
WHERE free_scans_remaining IS NULL;

-- Create function to use a free scan
CREATE OR REPLACE FUNCTION use_free_scan(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  scans_available integer;
BEGIN
  -- Get current free scans
  SELECT free_scans_remaining INTO scans_available
  FROM profiles
  WHERE id = user_id;
  
  -- Check if user has free scans
  IF scans_available > 0 THEN
    -- Decrement free scans
    UPDATE profiles
    SET free_scans_remaining = free_scans_remaining - 1
    WHERE id = user_id;
    
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- Create function to check if user can grade (has subscription OR free scans)
CREATE OR REPLACE FUNCTION can_user_grade(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_subscription boolean;
  has_free_scans boolean;
BEGIN
  -- Check subscription status
  SELECT subscription_active INTO has_subscription
  FROM profiles
  WHERE id = user_id;
  
  -- Check free scans
  SELECT (free_scans_remaining > 0) INTO has_free_scans
  FROM profiles
  WHERE id = user_id;
  
  RETURN (has_subscription OR has_free_scans);
END;
$$;