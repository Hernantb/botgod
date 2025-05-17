/**
 * Script completo para diagnosticar y solucionar problemas de integración 
 * con Google Calendar en el sistema
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ID del negocio que estamos viendo en los logs
const BUSINESS_ID = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

async function main() {
  console.log('🔎 DIAGNÓSTICO Y SOLUCIÓN DE PROBLEMAS DE CALENDARIO');
  console.log('-'.repeat(70));
  
  // Paso 1: Verificar variables de entorno
  await checkEnvironmentVariables();
  
  // Paso 2: Verificar la existencia y configuración del negocio
  await checkBusinessConfig();
  
  // Paso 3: Verificar la estructura de la tabla business_config
  await checkTableStructure();
  
  console.log('-'.repeat(70));
  console.log('✅ Diagnóstico y solución completados');
}

async function checkEnvironmentVariables() {
  console.log('\n🔑 Verificando variables de entorno:');
  
  // Variables obligatorias de Google
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI;
  
  // Verificar y alertar sobre problemas
  if (!googleClientId || googleClientId === 'YOUR_CLIENT_ID') {
    console.error('❌ GOOGLE_CLIENT_ID no está configurado correctamente');
    console.log('   - Establece un valor real en .env: GOOGLE_CLIENT_ID=tu_client_id');
  } else {
    console.log('✅ GOOGLE_CLIENT_ID configurado correctamente');
  }
  
  if (!googleClientSecret || googleClientSecret === 'YOUR_CLIENT_SECRET') {
    console.error('❌ GOOGLE_CLIENT_SECRET no está configurado correctamente');
    console.log('   - Establece un valor real en .env: GOOGLE_CLIENT_SECRET=tu_client_secret');
  } else {
    console.log('✅ GOOGLE_CLIENT_SECRET configurado correctamente');
  }
  
  if (!googleRedirectUri) {
    console.error('❌ GOOGLE_REDIRECT_URI no está configurado');
    console.log('   - Establece la URL de redirección en .env: GOOGLE_REDIRECT_URI=http://localhost:3095/google-auth-callback');
  } else {
    console.log('✅ GOOGLE_REDIRECT_URI configurado como:', googleRedirectUri);
  }
}

async function checkBusinessConfig() {
  console.log('\n🏢 Verificando configuración del negocio:');
  
  try {
    // Primero intentar buscar por business_id (formato antiguo)
    const { data: dataOld, error: errorOld } = await supabase
      .from('business_config')
      .select('*')
      .eq('business_id', BUSINESS_ID);
      
    // Luego intentar buscar por id (nuevo formato)
    const { data: dataNew, error: errorNew } = await supabase
      .from('business_config')
      .select('*')
      .eq('id', BUSINESS_ID);
    
    const data = dataOld?.length ? dataOld : dataNew;
    
    if ((!dataOld || dataOld.length === 0) && (!dataNew || dataNew.length === 0)) {
      console.error(`❌ No se encontró configuración para el negocio ${BUSINESS_ID}`);
      
      // Crear una configuración básica
      console.log('   Creando configuración básica para el negocio...');
      
      // Intentar con el formato antiguo primero (business_id)
      const { error: insertError } = await supabase
        .from('business_config')
        .insert({
          business_id: BUSINESS_ID,
          id: BUSINESS_ID, // También asignar como id para compatibilidad
          google_calendar_enabled: false,
          business_name: 'Empresa Original',
          openai_assistant_id: 'asst_temp123456',
          is_bot_active: true,
          created_at: new Date().toISOString()
        });
        
      if (insertError) {
        console.error(`❌ Error creando configuración: ${insertError.message}`);
        
        // Si falla, probar con el nuevo formato (solo id)
        const { error: insertError2 } = await supabase
          .from('business_config')
          .insert({
            id: BUSINESS_ID,
            google_calendar_enabled: false,
            business_name: 'Empresa Original',
            openai_assistant_id: 'asst_temp123456',
            is_bot_active: true,
            created_at: new Date().toISOString()
          });
          
        if (insertError2) {
          console.error(`❌ Error creando configuración (segundo intento): ${insertError2.message}`);
        } else {
          console.log('✅ Configuración básica creada exitosamente (formato nuevo)');
        }
      } else {
        console.log('✅ Configuración básica creada exitosamente');
      }
    } else {
      console.log(`✅ Encontrada configuración para el negocio:`);
      data.forEach((config, index) => {
        console.log(`   - ID: ${config.id}`);
        console.log(`   - Business ID: ${config.business_id || 'No disponible'}`);
        console.log(`   - Nombre: ${config.business_name}`);
        console.log(`   - Google Calendar habilitado: ${config.google_calendar_enabled ? 'SÍ' : 'NO'}`);
        console.log(`   - Google Calendar refresh token: ${config.google_calendar_refresh_token ? 'Configurado' : 'NO CONFIGURADO'}`);
      });
      
      // Si hay más de 1 configuración, advertir
      if (data.length > 1) {
        console.warn('⚠️ Hay múltiples configuraciones para este negocio. Esto puede causar problemas.');
      }
    }
  } catch (error) {
    console.error('❌ Error verificando negocio:', error);
  }
}

async function checkTableStructure() {
  console.log('\n🗄️ Verificando estructura de tabla business_config:');
  
  try {
    // Intentar determinar qué columnas existen
    let columns = [];
    
    try {
      // Método 1: Intentar obtener todas las columnas con una consulta
      const { data: sampleData, error: sampleError } = await supabase
        .from('business_config')
        .select('*')
        .limit(1);
        
      if (!sampleError && sampleData && sampleData.length > 0) {
        columns = Object.keys(sampleData[0]);
      }
    } catch (e) {
      console.error('   Error obteniendo columnas de muestra:', e.message);
    }
    
    if (columns.length === 0) {
      console.log('❌ No se pudo determinar la estructura de la tabla');
    } else {
      console.log('✅ Columnas detectadas:');
      columns.forEach(col => console.log(`   - ${col}`));
      
      // Verificar columnas específicas de calendario
      const calendarColumns = ['google_calendar_enabled', 'google_calendar_refresh_token', 
                              'google_calendar_access_token', 'google_calendar_id'];
                              
      const missingColumns = calendarColumns.filter(col => !columns.includes(col));
      
      if (missingColumns.length > 0) {
        console.warn('⚠️ Faltan columnas necesarias para Google Calendar:');
        missingColumns.forEach(col => console.log(`   - ${col}`));
      } else {
        console.log('✅ Todas las columnas necesarias para Google Calendar están presentes');
      }
      
      // Verificar si se están utilizando 'id' o 'business_id'
      if (columns.includes('id') && columns.includes('business_id')) {
        console.log('ℹ️ La tabla usa tanto "id" como "business_id". Asegúrate de usar el campo correcto en las consultas.');
      } else if (columns.includes('id')) {
        console.log('ℹ️ La tabla usa "id" como identificador principal.');
      } else if (columns.includes('business_id')) {
        console.log('ℹ️ La tabla usa "business_id" como identificador principal.');
      }
    }
  } catch (error) {
    console.error('❌ Error verificando estructura:', error);
  }
}

// Ejecutar el script
main().catch(err => {
  console.error('Error general en el script:', err);
}); 