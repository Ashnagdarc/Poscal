-- Migration: Add user-specific push notification support
-- Enables notifications to be sent to specific users instead of all users

-- =====================================================
-- 1. Add user_id column to push_notification_queue
-- =====================================================
ALTER TABLE push_notification_queue
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for efficient user filtering
CREATE INDEX IF NOT EXISTS idx_push_queue_user_id ON push_notification_queue(user_id, status, created_at);

-- =====================================================
-- 2. Create new RPC function for user-specific notifications
-- =====================================================
CREATE OR REPLACE FUNCTION queue_user_push_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_tag text DEFAULT NULL,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Insert into queue with user_id
  INSERT INTO push_notification_queue (title, body, tag, data, user_id)
  VALUES (p_title, p_body, p_tag, p_data, p_user_id)
  RETURNING id INTO v_notification_id;

  RETURN jsonb_build_object(
    'success', true,
    'notification_id', v_notification_id,
    'message', 'User notification queued successfully',
    'user_id', p_user_id
  );
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION queue_user_push_notification TO authenticated;

-- =====================================================
-- 3. Create helper function to get user-specific subscriptions
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_push_subscriptions(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  endpoint text,
  p256dh text,
  auth text,
  user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id,
    ps.endpoint,
    ps.p256dh,
    ps.auth,
    ps.user_id
  FROM push_subscriptions ps
  WHERE ps.user_id = p_user_id
    AND ps.created_at > now() - interval '90 days'
  ORDER BY ps.created_at DESC;
END;
$$;

-- Grant access to service role only (for external push service)
GRANT EXECUTE ON FUNCTION get_user_push_subscriptions TO service_role;

-- =====================================================
-- 4. Update comments
-- =====================================================
COMMENT ON COLUMN push_notification_queue.user_id IS 
  'Optional: If set, notification only goes to this user. If NULL, goes to all subscribers.';

COMMENT ON FUNCTION queue_user_push_notification IS 
  'Queue a push notification for a specific user. Notification only sent to that user''s subscriptions.';

COMMENT ON FUNCTION get_user_push_subscriptions IS 
  'Get all active push subscriptions for a specific user.';
