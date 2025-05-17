-- Script para crear la tabla calendar_events que almacenará las referencias a eventos de Google Calendar
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Crear la tabla calendar_events
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  event_id TEXT NOT NULL, -- ID del evento en Google Calendar
  customer_phone TEXT NOT NULL, -- Número de teléfono del cliente
  customer_name TEXT, -- Nombre del cliente (opcional)
  event_date DATE NOT NULL, -- Fecha del evento
  event_time TEXT NOT NULL, -- Hora del evento (HH:MM)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  canceled BOOLEAN DEFAULT FALSE, -- Flag para marcar si la cita fue cancelada
  canceled_at TIMESTAMPTZ -- Cuándo se canceló la cita
);

-- 2. Añadir índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_calendar_events_business_id ON public.calendar_events(business_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_customer_phone ON public.calendar_events(customer_phone);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_date ON public.calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_id ON public.calendar_events(event_id);

-- 3. Añadir comentarios
COMMENT ON TABLE public.calendar_events IS 'Almacena referencias a eventos creados en Google Calendar';
COMMENT ON COLUMN public.calendar_events.id IS 'ID único de la entrada en la tabla';
COMMENT ON COLUMN public.calendar_events.business_id IS 'ID del negocio propietario del calendario';
COMMENT ON COLUMN public.calendar_events.event_id IS 'ID del evento en Google Calendar';
COMMENT ON COLUMN public.calendar_events.customer_phone IS 'Número de teléfono del cliente que solicitó la cita';
COMMENT ON COLUMN public.calendar_events.customer_name IS 'Nombre del cliente (opcional)';
COMMENT ON COLUMN public.calendar_events.event_date IS 'Fecha del evento en formato YYYY-MM-DD';
COMMENT ON COLUMN public.calendar_events.event_time IS 'Hora del evento en formato HH:MM';
COMMENT ON COLUMN public.calendar_events.created_at IS 'Fecha y hora de creación del registro';
COMMENT ON COLUMN public.calendar_events.updated_at IS 'Fecha y hora de última actualización del registro';
COMMENT ON COLUMN public.calendar_events.canceled IS 'Indica si la cita fue cancelada';
COMMENT ON COLUMN public.calendar_events.canceled_at IS 'Fecha y hora de cancelación de la cita';

-- 4. Crear políticas de seguridad RLS (Row Level Security)
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Política para que los administradores puedan ver todos los eventos
CREATE POLICY admin_select_calendar_events ON public.calendar_events 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Política para que los administradores puedan crear eventos
CREATE POLICY admin_insert_calendar_events ON public.calendar_events 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Política para que los administradores puedan actualizar eventos
CREATE POLICY admin_update_calendar_events ON public.calendar_events 
  FOR UPDATE 
  TO authenticated 
  USING (true);

-- Política para que los administradores puedan eliminar eventos
CREATE POLICY admin_delete_calendar_events ON public.calendar_events 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- 5. Trigger para actualizar el updated_at
CREATE OR REPLACE FUNCTION public.update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calendar_events_timestamp
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_calendar_events_updated_at(); 