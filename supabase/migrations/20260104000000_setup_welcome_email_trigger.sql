-- Create email queue table to handle rate limiting
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  email_type TEXT NOT NULL DEFAULT 'welcome',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'failed'))
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_queue_status_created ON public.email_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON public.email_queue(user_id);

-- Function to add new users to email queue
CREATE OR REPLACE FUNCTION public.queue_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Try to get user name from raw_user_meta_data or email
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(user_email, '@', 1)
  );

  -- Add to email queue
  INSERT INTO public.email_queue (user_id, email, name, email_type, status)
  VALUES (NEW.id, user_email, user_name, 'welcome', 'pending');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_welcome_email();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.email_queue TO postgres, service_role;
GRANT SELECT ON TABLE public.email_queue TO authenticated;
GRANT ALL ON FUNCTION public.queue_welcome_email() TO postgres, service_role;

-- Enable RLS on email_queue (users can only see their own)
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email queue"
  ON public.email_queue
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Comment
COMMENT ON TABLE public.email_queue IS 'Queue for sending welcome emails to stay within rate limits';
COMMENT ON FUNCTION public.queue_welcome_email() IS 'Adds newly registered users to email queue for batch processing';
