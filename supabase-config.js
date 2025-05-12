/**
 * Configuración para Supabase
 * 
 * Este archivo contiene las credenciales para conectarse a Supabase.
 * IMPORTANTE: Reemplazar la clave anónima con la correcta.
 */

// URL de tu proyecto Supabase - ¡CONFIRMADO COMO EXISTENTE!
const SUPABASE_URL = 'https://wscijkxwevgxbgwhbqtm.supabase.co';

// Clave anónima de tu proyecto Supabase
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';

// ID del negocio para las conversaciones
const BUSINESS_ID = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

module.exports = {
  SUPABASE_URL,
  SUPABASE_KEY,
  BUSINESS_ID
}; 