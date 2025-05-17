-- Add Google Calendar fields to business_config table
ALTER TABLE public.business_config ADD COLUMN IF NOT EXISTS google_calendar_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.business_config ADD COLUMN IF NOT EXISTS google_calendar_refresh_token TEXT;
ALTER TABLE public.business_config ADD COLUMN IF NOT EXISTS google_calendar_access_token TEXT;
ALTER TABLE public.business_config ADD COLUMN IF NOT EXISTS google_calendar_token_expiry TIMESTAMPTZ;
ALTER TABLE public.business_config ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;
ALTER TABLE public.business_config ADD COLUMN IF NOT EXISTS google_calendar_updated_at TIMESTAMPTZ;

-- Create calendar_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  event_id TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  event_date DATE NOT NULL,
  event_time TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  canceled BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_business_id ON public.calendar_events(business_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_customer_phone ON public.calendar_events(customer_phone);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_date ON public.calendar_events(event_date);

-- Add comment to tables for documentation
COMMENT ON TABLE public.calendar_events IS 'Stores references to events created in Google Calendar';
COMMENT ON COLUMN public.business_config.google_calendar_enabled IS 'Whether Google Calendar integration is enabled for this business';
COMMENT ON COLUMN public.business_config.google_calendar_refresh_token IS 'OAuth refresh token for Google Calendar';
COMMENT ON COLUMN public.business_config.google_calendar_access_token IS 'OAuth access token for Google Calendar (temporary)';
COMMENT ON COLUMN public.business_config.google_calendar_token_expiry IS 'When the access token expires';
COMMENT ON COLUMN public.business_config.google_calendar_id IS 'ID of the Google Calendar to use (primary by default)';
COMMENT ON COLUMN public.business_config.google_calendar_updated_at IS 'When the Google Calendar integration was last updated'; 