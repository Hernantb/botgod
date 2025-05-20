/**
 * Script para actualizar las credenciales de Google OAuth en el archivo .env
 * Este script ayuda a corregir la configuración de Google Calendar
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Crear interfaz para interactuar con el usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ID del negocio que estamos viendo en los logs
const businessId = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

async function updateGoogleOAuthCredentials() {
  console.log('🔄 Actualización de credenciales de Google OAuth');
  console.log('-'.repeat(70));
  
  // Leer el archivo .env actual
  let envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ No se encontró el archivo .env en el directorio actual');
    console.log('Creando un nuevo archivo .env...');
    
    try {
      fs.writeFileSync(envPath, '', 'utf8');
    } catch (err) {
      console.error('Error al crear el archivo .env:', err);
      process.exit(1);
    }
  }
  
  let envContent = fs.readFileSync(envPath, 'utf8');
  let envLines = envContent.split('\n');
  
  // Preguntar por las credenciales de Google OAuth
  try {
    // Google Client ID
    const clientId = await question('Ingresa el GOOGLE_CLIENT_ID: ');
    updateEnvVariable(envLines, 'GOOGLE_CLIENT_ID', clientId);
    
    // Google Client Secret
    const clientSecret = await question('Ingresa el GOOGLE_CLIENT_SECRET: ');
    updateEnvVariable(envLines, 'GOOGLE_CLIENT_SECRET', clientSecret);
    
    // Google Redirect URI
    const redirectUriDefault = 'http://localhost:3095/google-auth-callback';
    const redirectUri = await question(`Ingresa el GOOGLE_REDIRECT_URI (Enter para usar ${redirectUriDefault}): `);
    updateEnvVariable(envLines, 'GOOGLE_REDIRECT_URI', redirectUri.trim() || redirectUriDefault);
    
    // Guardar los cambios
    fs.writeFileSync(envPath, envLines.join('\n'), 'utf8');
    
    console.log('-'.repeat(70));
    console.log('✅ Credenciales actualizadas correctamente en el archivo .env');
    console.log('\nImportante: Asegúrate de que estas credenciales sean válidas y estén');
    console.log('correctamente configuradas en la consola de Google Cloud Platform:');
    console.log('https://console.cloud.google.com/apis/credentials');
    
    // Mostrar instrucciones adicionales
    console.log('\nPara completar la configuración:');
    console.log('1. Ve a Google Cloud Console');
    console.log('2. Configura Pantalla de consentimiento de OAuth');
    console.log('3. Añade ámbitos para Google Calendar API');
    console.log('4. Agrega la URI de redirección configurada:', redirectUri.trim() || redirectUriDefault);
  } catch (error) {
    console.error('❌ Error al actualizar credenciales:', error);
  } finally {
    rl.close();
  }
}

// Función para actualizar o añadir una variable de entorno
function updateEnvVariable(lines, key, value) {
  const regex = new RegExp(`^${key}=.*$`);
  const newLine = `${key}=${value}`;
  
  const index = lines.findIndex(line => regex.test(line));
  
  if (index !== -1) {
    // Actualizar la variable existente
    lines[index] = newLine;
  } else {
    // Añadir la variable si no existe
    lines.push(newLine);
  }
}

// Función para hacer preguntas al usuario
function question(query) {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer);
    });
  });
}

async function fixGoogleOAuth() {
  console.log(`🔄 Reconfigurando OAuth de Google Calendar para business_id: ${businessId}`);
  
  // 1. Verificar credenciales actuales
  console.log("\nCredenciales de Google OAuth en .env:");
  console.log(`- GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID || 'No configurado'}`);
  console.log(`- GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? '****' : 'No configurado'}`);
  console.log(`- GOOGLE_REDIRECT_URI: ${process.env.GOOGLE_REDIRECT_URI || 'No configurado'}`);
  
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    console.error('\n❌ Error: Faltan variables de entorno necesarias para Google OAuth.');
    console.error('Por favor, configura las siguientes variables en el archivo .env:');
    console.error('GOOGLE_CLIENT_ID=tu_id_de_cliente');
    console.error('GOOGLE_CLIENT_SECRET=tu_secreto_de_cliente');
    console.error('GOOGLE_REDIRECT_URI=http://localhost:3095/google-auth-callback');
    return;
  }
  
  try {
    // 2. Limpiar configuración anterior en la BD
    console.log('\nLimpiando configuración anterior de Google Calendar...');
    
    const { error: updateError } = await supabase
      .from('business_config')
      .update({
        google_calendar_enabled: true,
        google_calendar_refresh_token: null,
        google_calendar_access_token: null,
        google_calendar_token_expiry: null,
        google_calendar_id: 'primary',
        google_calendar_needs_reauth: true,
        google_calendar_updated_at: new Date().toISOString()
      })
      .eq('id', businessId);
    
    if (updateError) {
      console.error(`❌ Error actualizando business_config: ${updateError.message}`);
      return;
    }
    
    console.log('✅ Configuración limpiada correctamente');
    
    // 3. Verificar que la columna google_calendar_needs_reauth existe
    console.log('\nVerificando estructura de la tabla business_config...');
    
    let { data: columns, error: columnsError } = await supabase
      .rpc('get_table_definition', { table_name: 'business_config' });
    
    if (columnsError) {
      console.error(`❌ Error consultando estructura de tabla: ${columnsError.message}`);
      console.log('🔄 Intentando método alternativo para verificar columnas...');
      
      // Método alternativo: consultar una fila y ver qué campos tiene
      const { data: sample, error: sampleError } = await supabase
        .from('business_config')
        .select('*')
        .eq('id', businessId)
        .single();
      
      if (sampleError) {
        console.error(`❌ Error consultando ejemplo de business_config: ${sampleError.message}`);
        return;
      }
      
      columns = Object.keys(sample).map(column => ({ column_name: column }));
    }
    
    const hasNeedsReauthColumn = columns.some(col => 
      col.column_name === 'google_calendar_needs_reauth');
    
    if (!hasNeedsReauthColumn) {
      console.log('⚠️ La columna google_calendar_needs_reauth no existe, creándola...');
      
      // Crear la columna
      try {
        await supabase.rpc('run_sql', { 
          query: 'ALTER TABLE public.business_config ADD COLUMN IF NOT EXISTS google_calendar_needs_reauth BOOLEAN DEFAULT FALSE;' 
        });
        console.log('✅ Columna creada correctamente');
      } catch (sqlError) {
        console.error(`❌ Error creando columna: ${sqlError.message}`);
        console.log('Por favor, ejecuta el siguiente SQL manualmente en Supabase:');
        console.log('ALTER TABLE public.business_config ADD COLUMN IF NOT EXISTS google_calendar_needs_reauth BOOLEAN DEFAULT FALSE;');
      }
    }
    
    // 4. Proporcionar instrucciones para continuar
    console.log('\n✅ Configuración de Google Calendar preparada para reautenticación');
    console.log('\nPara completar la configuración:');
    console.log('1. Asegúrate de que las URIs de redirección en Google Cloud Console incluyan:');
    console.log(`   ${process.env.GOOGLE_REDIRECT_URI}`);
    console.log('2. Reinicia el servidor index.js');
    console.log('3. Ve a la página de configuración de Google Calendar');
    console.log('4. Haz clic en "Configurar Google Calendar" y completa el proceso de autenticación\n');
    
  } catch (error) {
    console.error(`❌ Error general: ${error.message}`);
  }
}

// Ejecutar el script
updateGoogleOAuthCredentials();
fixGoogleOAuth().then(() => {
  console.log('Proceso completado');
}); 