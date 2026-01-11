-- Fix security and performance issues identified by database linter

-- =====================================================
-- 1. Fix Function Search Path (Security)
-- =====================================================

-- Fix send_welcome_email function
CREATE OR REPLACE FUNCTION send_welcome_email(user_id uuid, email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Function body remains the same, just adding SET search_path
  INSERT INTO email_queue (user_id, recipient_email, email_type, status)
  VALUES (user_id, email, 'welcome', 'pending');
END;
$$;

-- Fix queue_welcome_email function
CREATE OR REPLACE FUNCTION queue_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Queue welcome email for new user
  INSERT INTO email_queue (user_id, recipient_email, email_type, status)
  VALUES (NEW.id, NEW.email, 'welcome', 'pending');
  
  RETURN NEW;
END;
$$;

-- Fix trigger_email_queue_processing function
CREATE OR REPLACE FUNCTION trigger_email_queue_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function is called by trigger on email_queue inserts
  -- Processing would be handled by external service
  RETURN NEW;
END;
$$;

-- =====================================================
-- 2. Fix RLS Policy Performance Issue
-- =====================================================

-- Drop old policy
DROP POLICY IF EXISTS "Users can view their own email queue" ON email_queue;

-- Recreate with optimized query plan
CREATE POLICY "Users can view their own email queue"
  ON email_queue
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- =====================================================
-- 3. Comments
-- =====================================================

COMMENT ON FUNCTION send_welcome_email IS 
  'Sends welcome email to new users. Fixed with SET search_path for security.';

COMMENT ON FUNCTION queue_welcome_email IS 
  'Trigger function to queue welcome emails. Fixed with SET search_path for security.';

COMMENT ON FUNCTION trigger_email_queue_processing IS 
  'Trigger function for email queue processing. Fixed with SET search_path for security.';
