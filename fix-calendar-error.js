const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ID del negocio que estamos viendo en los logs
const businessId = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

async function diagnoseCalendarConfig() {
  console.log('Diagnóstico de configuración de Google Calendar');
  console.log(`Verificando business_id: ${businessId}`);
  
  try {
    // 1. Verificar variables de entorno requeridas
    console.log('\nVerificando variables de entorno:');
    const requiredEnvVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error('❌ Faltan las siguientes variables de entorno:');
      missingVars.forEach(varName => console.log(`   - ${varName}`));
    } else {
      console.log('✅ Todas las variables de entorno requeridas están presentes');
    }
    
    // 2. Verificar si el negocio existe y obtener datos de Google Calendar
    const { data, error } = await supabase
      .from('business_config')
      .select('*')
      .eq('id', businessId)
      .single();
      
    if (error) {
      console.error('❌ Error consultando business_config:', error.message);
      return;
    }
    
    if (!data) {
      console.error(`❌ No se encontró configuración para business_id: ${businessId}`);
      
      // Intentar crear una configuración básica
      console.log('Intentando crear configuración básica...');
      const { error: insertError } = await supabase
        .from('business_config')
        .insert({
          id: businessId,
          google_calendar_enabled: false,
          business_name: 'Empresa Original',
          openai_assistant_id: 'asst_temp123456',
          is_bot_active: true,
          created_at: new Date().toISOString()
        });
        
      if (insertError) {
        console.error('❌ Error creando configuración:', insertError.message);
      } else {
        console.log('✅ Configuración básica creada exitosamente');
      }
      return;
    }
    
    // 3. Verificar la configuración de Google Calendar
    console.log('\nConfiguración actual de Google Calendar:');
    console.log(`- Habilitado: ${data.google_calendar_enabled ? 'SÍ' : 'NO'}`);
    console.log(`- Refresh Token: ${data.google_calendar_refresh_token ? 'PRESENTE' : 'NO PRESENTE'}`);
    console.log(`- Access Token: ${data.google_calendar_access_token ? 'PRESENTE' : 'NO PRESENTE'}`);
    console.log(`- Token Expiry: ${data.google_calendar_token_expiry || 'NO CONFIGURADO'}`);
    console.log(`- Calendar ID: ${data.google_calendar_id || 'NO CONFIGURADO'}`);
    
    // 4. Verificar si necesita reautenticación
    if (!data.google_calendar_refresh_token) {
      console.log('\n⚠️ Se requiere autenticación con Google Calendar');
      console.log('El usuario debe completar el proceso de autenticación OAuth');
    }
    
    // 5. Verificar y corregir campos faltantes
    const updates = {};
    if (data.google_calendar_enabled === undefined) updates.google_calendar_enabled = false;
    if (!data.google_calendar_updated_at) updates.google_calendar_updated_at = new Date().toISOString();
    if (!data.google_calendar_id) updates.google_calendar_id = 'primary';
    
    if (Object.keys(updates).length > 0) {
      console.log('\nActualizando campos faltantes...');
      const { error: updateError } = await supabase
        .from('business_config')
        .update(updates)
        .eq('id', businessId);
        
      if (updateError) {
        console.error('❌ Error actualizando campos:', updateError.message);
      } else {
        console.log('✅ Campos actualizados correctamente');
        console.log('Campos actualizados:', updates);
      }
    }
    
  } catch (error) {
    console.error('Error general:', error);
  }
}

// Ejecutar el diagnóstico
diagnoseCalendarConfig().then(() => {
  console.log('\nDiagnóstico completado');
}); 