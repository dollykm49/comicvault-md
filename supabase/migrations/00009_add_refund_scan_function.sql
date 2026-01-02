/*
# Add refund_scan RPC function

## Purpose
Refund a scan credit when grading fails or errors occur.

## Function Details
- Name: refund_scan
- Parameters: user_id (uuid)
- Returns: boolean (true if refunded, false otherwise)
- Security: SECURITY DEFINER (runs with elevated privileges)

## Logic
1. Check if user has trial active
   - If trial active: Increment trial_scans_remaining (max 3)
2. If no trial:
   - Check subscription tier
   - If 'pro': Do nothing (unlimited scans)
   - Otherwise: Increment one_time_scans or monthly_scans_remaining

## Notes
- Prevents refunding more than the original trial amount (3)
- Handles different subscription tiers appropriately
- Returns false if refund not possible
*/

CREATE OR REPLACE FUNCTION refund_scan(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trial_active boolean;
  v_trial_scans_remaining integer;
  v_tier text;
  v_one_time_scans integer;
  v_monthly_scans_remaining integer;
BEGIN
  -- Get user's scan status
  SELECT 
    trial_active,
    trial_scans_remaining,
    subscription_tier,
    one_time_scans,
    monthly_scans_remaining
  INTO 
    v_trial_active,
    v_trial_scans_remaining,
    v_tier,
    v_one_time_scans,
    v_monthly_scans_remaining
  FROM profiles
  WHERE id = user_id;

  -- If user not found, return false
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- If trial is active, refund trial scan (max 3)
  IF v_trial_active THEN
    IF v_trial_scans_remaining < 3 THEN
      UPDATE profiles
      SET trial_scans_remaining = trial_scans_remaining + 1
      WHERE id = user_id;
      RETURN true;
    ELSE
      -- Already at max trial scans
      RETURN false;
    END IF;
  END IF;

  -- If pro tier, no need to refund (unlimited)
  IF v_tier = 'pro' THEN
    RETURN true;
  END IF;

  -- Refund to one_time_scans first, then monthly
  IF v_one_time_scans > 0 OR v_monthly_scans_remaining >= 0 THEN
    UPDATE profiles
    SET one_time_scans = one_time_scans + 1
    WHERE id = user_id;
    RETURN true;
  END IF;

  -- If we get here, couldn't refund
  RETURN false;
END;
$$;