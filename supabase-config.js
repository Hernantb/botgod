/**
 * Configuración para Supabase
 * 
 * Este archivo contiene las credenciales para conectarse a Supabase.
 * IMPORTANTE: Este archivo debe estar en la raíz del proyecto y ser importado por index.js
 */

// URL de tu proyecto Supabase - ¡CONFIRMADO COMO EXISTENTE!
const SUPABASE_URL = 'https://wscijkxwevgxbgwhbqtm.supabase.co';

// Clave de servicio para Supabase (service_role)
// Esta clave tiene permisos completos y debe mantenerse segura
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTgyMjc2OCwiZXhwIjoyMDU3Mzk4NzY4fQ.eAMYqHQ5ma_2tPXOwCYKw3tt_vERE0zhBj2xS1srv9M';

// ID del negocio para las conversaciones
const BUSINESS_ID = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

module.exports = {
  SUPABASE_URL,
  SUPABASE_KEY,
  BUSINESS_ID
}; 