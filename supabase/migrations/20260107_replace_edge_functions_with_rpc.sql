-- Migration to replace Edge Functions with Database RPC Functions
-- This eliminates edge function invocations and reduces costs

-- =====================================================
-- 1. RPC Function: Subscribe to Push Notifications
-- =====================================================
CREATE OR REPLACE FUNCTION subscribe_push_notification(
  p_subscription jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_endpoint text;
  v_existing_id uuid;
  v_result jsonb;
BEGIN
  -- Extract endpoint from subscription
  v_endpoint := p_subscription->>'endpoint';
  
  -- Validate subscription data
  IF v_endpoint IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid subscription data - missing endpoint'
    );
  END IF;
  
  IF p_subscription->'keys'->>'p256dh' IS NULL OR p_subscription->'keys'->>'auth' IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid subscription data - missing keys'
    );
  END IF;

  -- Check if subscription already exists
  SELECT id INTO v_existing_id
  FROM push_subscriptions
  WHERE endpoint = v_endpoint;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing subscription
    UPDATE push_subscriptions
    SET 
      p256dh = p_subscription->'keys'->>'p256dh',
      auth = p_subscription->'keys'->>'auth',
      user_id = COALESCE(p_user_id, user_id),
      updated_at = now()
    WHERE id = v_existing_id;
    
    v_result := jsonb_build_object(
      'success', true,
      'action', 'updated',
      'id', v_existing_id
    );
  ELSE
    -- Insert new subscription
    INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id)
    VALUES (
      v_endpoint,
      p_subscription->'keys'->>'p256dh',
      p_subscription->'keys'->>'auth',
      p_user_id
    )
    RETURNING id INTO v_existing_id;
    
    v_result := jsonb_build_object(
      'success', true,
      'action', 'created',
      'id', v_existing_id
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION subscribe_push_notification TO authenticated, anon;

-- =====================================================
-- 2. RPC Function: Close Signal Trades
-- =====================================================
CREATE OR REPLACE FUNCTION close_signal_trades(
  p_signal_id uuid,
  p_signal_result text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signal_record RECORD;
  v_trade_record RECORD;
  v_closed_count integer := 0;
  v_failed_count integer := 0;
  v_result jsonb;
  v_pnl numeric;
  v_pips numeric;
BEGIN
  -- Validate signal exists and get details
  SELECT * INTO v_signal_record
  FROM trading_signals
  WHERE id = p_signal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Signal not found'
    );
  END IF;

  -- Validate signal_result
  IF p_signal_result NOT IN ('WIN', 'LOSS', 'BREAK_EVEN') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid signal result. Must be WIN, LOSS, or BREAK_EVEN'
    );
  END IF;

  -- Loop through all taken trades for this signal
  FOR v_trade_record IN 
    SELECT * FROM journal_entries 
    WHERE signal_id = p_signal_id 
      AND closed_at IS NULL
  LOOP
    BEGIN
      -- Calculate P&L based on signal result
      CASE p_signal_result
        WHEN 'WIN' THEN
          -- Calculate win based on R:R ratio
          v_pnl := v_trade_record.risk_amount * COALESCE(v_signal_record.rr_ratio, 2);
          v_pips := CASE 
            WHEN v_trade_record.entry_price > 0 THEN
              ABS((v_signal_record.take_profit - v_trade_record.entry_price) * 
                  CASE WHEN v_signal_record.pair LIKE '%JPY' THEN 100 ELSE 10000 END)
            ELSE 0
          END;
          
        WHEN 'LOSS' THEN
          -- Full loss of risk amount
          v_pnl := -v_trade_record.risk_amount;
          v_pips := CASE 
            WHEN v_trade_record.entry_price > 0 THEN
              -ABS((v_signal_record.stop_loss - v_trade_record.entry_price) * 
                   CASE WHEN v_signal_record.pair LIKE '%JPY' THEN 100 ELSE 10000 END)
            ELSE 0
          END;
          
        WHEN 'BREAK_EVEN' THEN
          -- No profit or loss
          v_pnl := 0;
          v_pips := 0;
      END CASE;

      -- Update the trade
      UPDATE journal_entries
      SET 
        pnl = v_pnl,
        pips = v_pips,
        closed_at = now(),
        notes = COALESCE(notes || E'\n', '') || 
                'Auto-closed by signal result: ' || p_signal_result
      WHERE id = v_trade_record.id;

      v_closed_count := v_closed_count + 1;

    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      -- Log error but continue processing other trades
      RAISE NOTICE 'Failed to close trade %: %', v_trade_record.id, SQLERRM;
    END;
  END LOOP;

  -- Return summary
  v_result := jsonb_build_object(
    'success', true,
    'closed_count', v_closed_count,
    'failed_count', v_failed_count,
    'signal_id', p_signal_id,
    'signal_result', p_signal_result
  );

  RETURN v_result;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION close_signal_trades TO authenticated;

-- =====================================================
-- 3. Create table for push notification queue (optional)
-- =====================================================
CREATE TABLE IF NOT EXISTS push_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  tag text,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed'))
);

CREATE INDEX idx_push_queue_status ON push_notification_queue(status, created_at);

-- Enable RLS
ALTER TABLE push_notification_queue ENABLE ROW LEVEL SECURITY;

-- Only service role can manage queue
CREATE POLICY "Service role can manage push queue"
  ON push_notification_queue
  FOR ALL
  TO service_role
  USING (true);

-- =====================================================
-- 4. RPC Function: Queue Push Notification
-- =====================================================
CREATE OR REPLACE FUNCTION queue_push_notification(
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
  -- Insert into queue
  INSERT INTO push_notification_queue (title, body, tag, data)
  VALUES (p_title, p_body, p_tag, p_data)
  RETURNING id INTO v_notification_id;

  -- Note: Actual sending would be handled by an external service
  -- monitoring this table, or you can use triggers + pg_net
  
  RETURN jsonb_build_object(
    'success', true,
    'notification_id', v_notification_id,
    'message', 'Notification queued successfully'
  );
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION queue_push_notification TO authenticated;

-- =====================================================
-- 5. Helper function to get active push subscriptions
-- =====================================================
CREATE OR REPLACE FUNCTION get_active_push_subscriptions()
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
  WHERE ps.created_at > now() - interval '90 days'
  ORDER BY ps.created_at DESC;
END;
$$;

-- Grant access to service role only (for external push service)
GRANT EXECUTE ON FUNCTION get_active_push_subscriptions TO service_role;

-- =====================================================
-- 6. Comments
-- =====================================================
COMMENT ON FUNCTION subscribe_push_notification IS 
  'Replaces subscribe-push edge function. Stores push subscription in database.';

COMMENT ON FUNCTION close_signal_trades IS 
  'Replaces close-signal-trades edge function. Closes all trades for a signal with calculated P&L.';

COMMENT ON FUNCTION queue_push_notification IS 
  'Queues a push notification to be sent by external service. Replaces send-push-notification edge function.';

COMMENT ON TABLE push_notification_queue IS 
  'Queue for push notifications. External service can poll this table and send notifications.';
