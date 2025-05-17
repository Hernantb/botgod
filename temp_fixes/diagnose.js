const { createClient } = require('@supabase/supabase-js');
const http = require('http');

// Configuración de Supabase
const SUPABASE_URL = 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';
const BUSINESS_ID = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

// Crear cliente de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Función para verificar la conexión a Supabase
async function checkSupabaseConnection() {
  console.log('Verificando conexión a Supabase...');
  
  try {
    const { data, error } = await supabase.from('conversations').select('count');
    
    if (error) {
      console.error('❌ Error conectando a Supabase:', error.message);
      return false;
    }
    
    console.log('✅ Conexión a Supabase exitosa');
    return true;
  } catch (err) {
    console.error('❌ Excepción al conectar a Supabase:', err.message);
    return false;
  }
}

// Función para verificar el servidor WhatsApp
async function checkWhatsAppServer() {
  console.log('Verificando servidor de WhatsApp en puerto 3010...');
  
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3010/api/status', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Servidor WhatsApp respondiendo OK');
          try {
            const json = JSON.parse(data);
            console.log('Respuesta:', json);
            resolve(true);
          } catch (e) {
            console.log('Respuesta no es JSON válido:', data);
            resolve(true); // El servidor responde, aunque con formato incorrecto
          }
        } else {
          console.log(`❌ Servidor WhatsApp respondió con código ${res.statusCode}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('❌ Error conectando al servidor WhatsApp:', err.message);
      resolve(false);
    });
    
    req.setTimeout(3000, () => {
      console.error('❌ Timeout conectando al servidor WhatsApp');
      req.destroy();
      resolve(false);
    });
  });
}

// Función para obtener conversaciones
async function fetchConversations() {
  console.log('Intentando obtener conversaciones...');
  
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('business_id', BUSINESS_ID)
      .limit(5);
    
    if (error) {
      console.error('❌ Error obteniendo conversaciones:', error.message);
      return false;
    }
    
    console.log(`✅ Se obtuvieron ${data.length} conversaciones`);
    if (data.length > 0) {
      console.log('Primera conversación:', {
        id: data[0].id,
        user_id: data[0].user_id,
        last_message: data[0].last_message
      });
    }
    
    return true;
  } catch (err) {
    console.error('❌ Excepción al obtener conversaciones:', err.message);
    return false;
  }
}

// Función para verificar el servidor Next.js
async function checkNextServer() {
  console.log('Verificando servidor Next.js en puerto 3000...');
  
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000', (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Servidor Next.js respondiendo OK');
        resolve(true);
      } else {
        console.log(`❌ Servidor Next.js respondió con código ${res.statusCode}`);
        resolve(false);
      }
      
      // Consumir el cuerpo para liberar la conexión
      res.resume();
    });
    
    req.on('error', (err) => {
      console.error('❌ Error conectando al servidor Next.js:', err.message);
      resolve(false);
    });
    
    req.setTimeout(3000, () => {
      console.error('❌ Timeout conectando al servidor Next.js');
      req.destroy();
      resolve(false);
    });
  });
}

// Ejecutar todas las verificaciones
async function runDiagnostics() {
  console.log('=== INICIANDO DIAGNÓSTICO ===');
  
  const supabaseOk = await checkSupabaseConnection();
  const conversationsOk = supabaseOk ? await fetchConversations() : false;
  const whatsappServerOk = await checkWhatsAppServer();
  const nextServerOk = await checkNextServer();
  
  console.log('\n=== RESUMEN DIAGNÓSTICO ===');
  console.log(`Conexión a Supabase: ${supabaseOk ? '✅ OK' : '❌ ERROR'}`);
  console.log(`Obtención de conversaciones: ${conversationsOk ? '✅ OK' : '❌ ERROR'}`);
  console.log(`Servidor WhatsApp (3010): ${whatsappServerOk ? '✅ OK' : '❌ ERROR'}`);
  console.log(`Servidor Next.js (3000): ${nextServerOk ? '✅ OK' : '❌ ERROR'}`);
  
  console.log('\n=== RECOMENDACIONES ===');
  if (!supabaseOk) {
    console.log('- Verificar conexión a internet');
    console.log('- Verificar las credenciales de Supabase en lib/supabase.ts');
  }
  
  if (!whatsappServerOk) {
    console.log('- Iniciar el servidor WhatsApp con: cd whatsapp-bot-main && node index.js');
    console.log('- Verificar que el puerto 3010 no esté ocupado');
  }
  
  if (!nextServerOk) {
    console.log('- Iniciar el servidor Next.js con: npm run dev');
    console.log('- Verificar que el puerto 3000 no esté ocupado');
  }
  
  if (supabaseOk && !conversationsOk) {
    console.log('- Verificar que existan conversaciones para el business_id');
    console.log('- Revisar permisos de acceso en las políticas de seguridad de Supabase');
  }
}

runDiagnostics(); 