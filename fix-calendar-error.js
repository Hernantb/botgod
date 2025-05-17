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
    // Verificar si el negocio existe y obtener datos de Google Calendar
    const { data, error } = await supabase
      .from('business_config')
      .select('*')
      .eq('business_id', businessId);
      
    if (error) {
      console.error('Error consultando business_config:', error.message);
      return;
    }
    
    if (!data || data.length === 0) {
      console.error(`No se encontró configuración para business_id: ${businessId}`);
      
      // Obtener la estructura de la tabla para verificar columnas requeridas
      console.log('Obteniendo estructura de la tabla business_config...');
      try {
        const { data: tableInfo, error: tableError } = await supabase
          .rpc('get_table_definition', { table_name: 'business_config' });
          
        if (tableError) {
          console.error('Error obteniendo estructura de tabla:', tableError.message);
        } else if (tableInfo) {
          console.log('Columnas requeridas:', tableInfo
            .filter(col => col.is_nullable === 'NO')
            .map(col => col.column_name)
            .join(', '));
        }
      } catch (tableErr) {
        console.error('Error consultando estructura:', tableErr.message);
      }
      
      // Intentar insertar una configuración básica incluyendo todos los campos requeridos
      console.log('Intentando crear configuración básica...');
      const { error: insertError } = await supabase
        .from('business_config')
        .insert({
          business_id: businessId,
          google_calendar_enabled: false,
          business_name: 'Empresa Original', // Nombre de ejemplo
          openai_assistant_id: 'asst_temp123456', // Valor temporal
          is_bot_active: true,
          created_at: new Date().toISOString()
        });
        
      if (insertError) {
        console.error('Error creando configuración:', insertError.message);
      } else {
        console.log('✅ Configuración básica creada exitosamente');
      }
      
      return;
    }
    
    // Mostrar datos encontrados
    console.log(`Encontradas ${data.length} configuraciones para este negocio:`);
    
    data.forEach((config, index) => {
      console.log(`\nConfiguración #${index + 1}:`);
      console.log(`- ID: ${config.id}`);
      console.log(`- Business ID: ${config.business_id}`);
      console.log(`- Nombre: ${config.business_name}`);
      console.log(`- Google Calendar habilitado: ${config.google_calendar_enabled ? 'SÍ' : 'NO'}`);
      console.log(`- Google Calendar refresh token: ${config.google_calendar_refresh_token ? 'Configurado' : 'NO CONFIGURADO'}`);
      console.log(`- Google Calendar ID: ${config.google_calendar_id || 'No configurado'}`);
      console.log(`- Última actualización: ${config.google_calendar_updated_at || 'Nunca'}`);
      console.log(`- OpenAI Assistant ID: ${config.openai_assistant_id}`);
    });
    
    // Verificar si hay demasiadas configuraciones
    if (data.length > 1) {
      console.warn('\n⚠️ ADVERTENCIA: Hay múltiples configuraciones para este negocio.');
      console.warn('Esto puede causar problemas con el endpoint /api/business/:businessId/calendar-status');
      console.warn('que espera un único resultado (usa .single() en la consulta).');
      
      // Sugerir solución
      console.log('\nSugerencia: Conservar solo una configuración y eliminar las demás.');
      console.log('ID a conservar:', data[0].id);
    }
    
    // Verificar Google OAuth
    console.log('\nVerificando variables de entorno para Google OAuth:');
    console.log(`- GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'Configurado' : 'NO CONFIGURADO'}`);
    console.log(`- GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? 'Configurado' : 'NO CONFIGURADO'}`);
    console.log(`- GOOGLE_REDIRECT_URI: ${process.env.GOOGLE_REDIRECT_URI ? 'Configurado' : 'NO CONFIGURADO'}`);
    
  } catch (error) {
    console.error('Error en diagnóstico:', error);
  }
}

diagnoseCalendarConfig(); 