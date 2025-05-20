-- Añadir columna para marcar cuando se necesita reautenticación
ALTER TABLE public.business_config 
ADD COLUMN IF NOT EXISTS google_calendar_needs_reauth BOOLEAN DEFAULT FALSE;

-- Asegurarse de que todas las columnas necesarias existen
ALTER TABLE public.business_config 
ADD COLUMN IF NOT EXISTS google_calendar_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS google_calendar_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_calendar_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_calendar_token_expiry TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_calendar_id TEXT DEFAULT 'primary',
ADD COLUMN IF NOT EXISTS google_calendar_updated_at TIMESTAMPTZ; 