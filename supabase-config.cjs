// supabase-config.cjs - Configuración del cliente de Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Obtener URL y Key de Supabase desde variables de entorno
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Verificar configuración
console.log(`🔄 Configuración de Supabase:`);
console.log(`🔄 URL configurada: ${SUPABASE_URL ? '✅ SÍ' : '❌ NO'}`);
console.log(`🔄 KEY configurada: ${SUPABASE_KEY ? '✅ SÍ' : '❌ NO'}`);

// Si no hay configuración, mostrar advertencia
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('⚠️ ADVERTENCIA: Variables de entorno SUPABASE_URL y/o SUPABASE_KEY no configuradas');
}

// Crear cliente de Supabase (incluso si las variables están vacías, para evitar errores)
const supabase = createClient(
  SUPABASE_URL || 'https://example.supabase.co',
  SUPABASE_KEY || 'fallback-key-for-development'
);

// Exportar cliente y configuración
module.exports = {
  supabase,
  supabaseConfig: {
    url: SUPABASE_URL,
    key: SUPABASE_KEY
  }
}; 