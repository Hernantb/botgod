/**
 * Herramienta de diagnóstico para verificar la conexión con Supabase
 * Este script puede ejecutarse de manera independiente para comprobar
 * si hay acceso a Supabase desde el entorno donde se ejecuta.
 */

const axios = require('axios');

// Configuración de Supabase
const SUPABASE_URL = 'https://ecnimzwygbbumxdcilsb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbmltend5Z2JidW14ZGNpbHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDM3MTkxMTEsImV4cCI6MjAxOTI5NTExMX0.KGnGBMq0nEG6BRE2CojwhqiOIzvgEvbQ-eKlnQrIaGs';

// Información del sistema
console.log('📊 DIAGNÓSTICO DE CONEXIÓN A SUPABASE');
console.log('📊 Fecha y hora actual:', new Date().toISOString());
console.log('📊 Entorno Node.js:', process.version);
console.log('📊 Sistema operativo:', process.platform, process.arch);
console.log('📊 Directorio de ejecución:', process.cwd());
console.log('📊 Variables de entorno relevantes:');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'no definido');
console.log('   RENDER:', process.env.RENDER || 'no definido (no estamos en Render?)');

// Probar resolución de DNS para Supabase
console.log('\n🔍 VERIFICANDO RESOLUCIÓN DNS PARA SUPABASE...');

// Usar el módulo dns de Node.js para verificar la resolución del hostname
const dns = require('dns');
dns.lookup('ecnimzwygbbumxdcilsb.supabase.co', (err, address, family) => {
  if (err) {
    console.error('❌ ERROR DE DNS:', err.message);
    console.error('❌ No se puede resolver el hostname de Supabase - Problema de DNS');
  } else {
    console.log('✅ Resolución DNS exitosa:');
    console.log('   Dirección IP:', address);
    console.log('   Familia IP:', family === 4 ? 'IPv4' : 'IPv6');
  }
});

// Función principal para verificar todas las conexiones
async function checkSupabaseConnections() {
  console.log('\n📡 VERIFICANDO ACCESO HTTP A SUPABASE...');
  
  // 1. Probar con Axios (HTTP/HTTPS)
  try {
    console.log('\n🔍 Intentando acceder a Supabase con Axios...');
    const startTime = Date.now();
    
    const axiosResponse = await axios.get(`${SUPABASE_URL}/rest/v1/conversations?limit=1`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      timeout: 10000 // 10 segundos
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ CONEXIÓN EXITOSA VIA AXIOS (${duration}ms):`);
    console.log('   Código de estado:', axiosResponse.status);
    console.log('   Tipo de contenido:', axiosResponse.headers['content-type']);
    console.log('   Tamaño de respuesta:', JSON.stringify(axiosResponse.data).length, 'bytes');
    console.log('   Vista previa de datos:', JSON.stringify(axiosResponse.data).substring(0, 100) + '...');
  } catch (axiosError) {
    console.error('❌ ERROR CON AXIOS:', axiosError.message);
    
    // Diagnóstico detallado según el tipo de error
    if (axiosError.code === 'ENOTFOUND') {
      console.error('❌ NO SE PUEDE RESOLVER EL HOSTNAME - PROBLEMA DE DNS');
    } else if (axiosError.code === 'ECONNREFUSED') {
      console.error('❌ CONEXIÓN RECHAZADA - FIREWALL O PUERTO BLOQUEADO');
    } else if (axiosError.code === 'ETIMEDOUT') {
      console.error('❌ TIMEOUT DE CONEXIÓN - RED LENTA O BLOQUEADA');
    } else if (axiosError.response) {
      console.error('⚠️ SERVIDOR RESPONDIÓ CON ERROR:', axiosError.response.status, axiosError.response.statusText);
    }
    
    // Información de red adicional si hay un error
    try {
      const os = require('os');
      const networkInterfaces = os.networkInterfaces();
      console.log('\n📡 INFORMACIÓN DE RED:');
      for (const ifaceName in networkInterfaces) {
        console.log(`   Interfaz: ${ifaceName}`);
        for (const iface of networkInterfaces[ifaceName]) {
          if (iface.family === 'IPv4' || iface.family === 4) {
            console.log(`      IPv4: ${iface.address}, Máscara: ${iface.netmask}`);
          }
        }
      }
    } catch (netError) {
      console.error('❌ No se pudo obtener información de red:', netError.message);
    }
  }
  
  // 2. Verificar fetch nativo (si está disponible)
  if (global.fetch) {
    try {
      console.log('\n🔍 Intentando acceder a Supabase con Fetch nativo...');
      const startTime = Date.now();
      
      const fetchResponse = await fetch(`${SUPABASE_URL}/rest/v1/conversations?limit=1`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      
      const data = await fetchResponse.json();
      const duration = Date.now() - startTime;
      
      console.log(`✅ CONEXIÓN EXITOSA VIA FETCH NATIVO (${duration}ms):`);
      console.log('   Código de estado:', fetchResponse.status);
      console.log('   OK:', fetchResponse.ok);
      console.log('   Vista previa de datos:', JSON.stringify(data).substring(0, 100) + '...');
    } catch (fetchError) {
      console.error('❌ ERROR CON FETCH NATIVO:', fetchError.message);
      console.error('   Stack:', fetchError.stack);
    }
  } else {
    console.log('\n⚠️ FETCH NATIVO NO DISPONIBLE EN ESTE ENTORNO DE NODE.JS');
  }
  
  // 3. Verificar node-fetch (si está instalado)
  try {
    console.log('\n🔍 Intentando cargar node-fetch...');
    // Intentar cargar node-fetch de manera dinámica
    const nodeFetch = require('node-fetch');
    console.log('✅ node-fetch está instalado correctamente');
    
    try {
      console.log('🔍 Intentando acceder a Supabase con node-fetch...');
      const startTime = Date.now();
      
      const nodeFetchResponse = await nodeFetch(`${SUPABASE_URL}/rest/v1/conversations?limit=1`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      
      const data = await nodeFetchResponse.json();
      const duration = Date.now() - startTime;
      
      console.log(`✅ CONEXIÓN EXITOSA VIA NODE-FETCH (${duration}ms):`);
      console.log('   Código de estado:', nodeFetchResponse.status);
      console.log('   OK:', nodeFetchResponse.ok);
      console.log('   Vista previa de datos:', JSON.stringify(data).substring(0, 100) + '...');
    } catch (nodeFetchError) {
      console.error('❌ ERROR CON NODE-FETCH:', nodeFetchError.message);
      console.error('   Stack:', nodeFetchError.stack);
    }
  } catch (requireError) {
    console.log('⚠️ node-fetch no está instalado o accesible');
    console.log('   Si necesitas instalarlo, ejecuta: npm install node-fetch@2');
  }
  
  // 4. Verificar el cliente Supabase.js (si está instalado)
  try {
    console.log('\n🔍 Intentando cargar el cliente Supabase.js...');
    const { createClient } = require('@supabase/supabase-js');
    console.log('✅ Cliente Supabase.js está instalado correctamente');
    
    try {
      console.log('🔍 Intentando crear cliente Supabase...');
      const startTime = Date.now();
      
      // Crear cliente con opciones por defecto
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      
      // Intentar una operación simple
      const { data, error, count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .limit(1);
      
      const duration = Date.now() - startTime;
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ CONEXIÓN EXITOSA VIA CLIENTE SUPABASE (${duration}ms):`);
      console.log('   Conteo disponible:', count !== undefined);
      console.log('   Estado de la operación: OK');
    } catch (supabaseError) {
      console.error('❌ ERROR CON CLIENTE SUPABASE:', supabaseError.message);
      console.error('   Detalles:', JSON.stringify(supabaseError, null, 2));
      
      // Intentar con configuración alternativa
      try {
        console.log('\n🔍 Intentando configuración alternativa del cliente Supabase...');
        const { createClient } = require('@supabase/supabase-js');
        
        const options = {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        };
        
        // Intentar con fetch personalizado si está disponible
        if (global.fetch) {
          options.global = { fetch: global.fetch };
        }
        
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, options);
        
        // Intentar una operación simple
        const { data, error } = await supabase
          .from('conversations')
          .select('count')
          .limit(1);
        
        if (error) {
          throw error;
        }
        
        console.log('✅ CLIENTE SUPABASE FUNCIONA CON CONFIGURACIÓN ALTERNATIVA');
      } catch (altError) {
        console.error('❌ TAMBIÉN FALLÓ LA CONFIGURACIÓN ALTERNATIVA:', altError.message);
      }
    }
  } catch (requireError) {
    console.log('⚠️ Cliente Supabase.js no está instalado o accesible');
    console.log('   Si necesitas instalarlo, ejecuta: npm install @supabase/supabase-js');
  }
  
  console.log('\n📊 DIAGNÓSTICO FINALIZADO');
  console.log('📊 Fecha y hora:', new Date().toISOString());
  
  const conclusiones = [];
  
  if (global.fetchSuccess) {
    conclusiones.push('✅ Fetch nativo funciona correctamente para Supabase');
  } else if (global.nodeFetchSuccess) {
    conclusiones.push('✅ node-fetch funciona correctamente para Supabase');
  } else if (global.axiosSuccess) {
    conclusiones.push('✅ Axios funciona correctamente para Supabase');
  } else if (global.clientSuccess) {
    conclusiones.push('✅ Cliente Supabase.js funciona correctamente');
  } else {
    conclusiones.push('❌ Ningún método pudo conectarse a Supabase correctamente');
    
    if (global.dnsError) {
      conclusiones.push('❌ PROBLEMA PRINCIPAL: No se puede resolver el hostname de Supabase (DNS)');
      conclusiones.push('   Verifica la conectividad a Internet o configura DNS alternativos');
    } else if (global.connectionRefused) {
      conclusiones.push('❌ PROBLEMA PRINCIPAL: Conexión rechazada - Firewall o reglas de red bloqueando la conexión');
    } else if (global.timeout) {
      conclusiones.push('❌ PROBLEMA PRINCIPAL: Timeout - Red lenta o bloqueada');
    } else {
      conclusiones.push('❌ PROBLEMA PRINCIPAL: Error desconocido - Revisa los detalles arriba');
    }
    
    conclusiones.push('⚠️ RECOMENDACIÓN: Usa el sistema de fallback para guardar mensajes localmente');
  }
  
  console.log('\n📝 CONCLUSIONES:');
  for (const conclusion of conclusiones) {
    console.log(conclusion);
  }
}

// Ejecutar todas las verificaciones
checkSupabaseConnections()
  .catch(err => {
    console.error('❌ ERROR GENERAL EN LA VERIFICACIÓN:', err);
  }); 