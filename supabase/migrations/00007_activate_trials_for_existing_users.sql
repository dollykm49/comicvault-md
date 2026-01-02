
/*
# Activate Trials for Existing Users

This migration activates the 3-day free trial for all existing users who don't have it yet.

## Changes
1. Update all profiles where trial_started_at is NULL
2. Set trial_started_at to now()
3. Set trial_expires_at to 3 days from now
4. Reset trial_scans_used to 0

## Security
- No RLS changes
- Only updates existing user data
*/

-- Activate trial for all existing users who don't have it
UPDATE profiles
SET 
  trial_started_at = now(),
  trial_expires_at = now() + interval '3 days',
  trial_scans_used = 0
WHERE trial_started_at IS NULL;
