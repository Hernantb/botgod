const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function decodeUnicode() {
  try {
    console.log('🔧 Decodificando texto Unicode en las instrucciones del asistente...');

    // Obtener configuración
    const { data: configs, error: getError } = await supabase
      .from('business_config')
      .select('id, business_name, assistant_instructions, assistant_name');
    
    if (getError) {
      console.error('❌ Error al obtener configuraciones:', getError);
      return;
    }
    
    console.log(`🔍 Encontradas ${configs.length} configuraciones`);
    
    // Procesar cada configuración
    for (const config of configs) {
      console.log(`\n📋 Procesando negocio: ${config.business_name} (${config.id})`);
      
      let updated = false;
      const updates = {};
      
      // Decodificar assistant_name si contiene caracteres Unicode
      if (config.assistant_name && config.assistant_name.includes('\\u')) {
        try {
          const decodedName = JSON.parse(`"${config.assistant_name}"`);
          console.log(`🔄 Nombre del asistente decodificado: "${decodedName}"`);
          updates.assistant_name = decodedName;
          updated = true;
        } catch (e) {
          console.log(`⚠️ Error al decodificar nombre: ${e.message}`);
        }
      }
      
      // Decodificar assistant_instructions si contiene caracteres Unicode
      if (config.assistant_instructions && config.assistant_instructions.includes('\\u')) {
        try {
          const decodedInstructions = JSON.parse(`"${config.assistant_instructions}"`);
          console.log(`🔄 Instrucciones decodificadas: "${decodedInstructions.substring(0, 30)}..."`);
          updates.assistant_instructions = decodedInstructions;
          updated = true;
        } catch (e) {
          console.log(`⚠️ Error al decodificar instrucciones: ${e.message}`);
        }
      }
      
      // Actualizar si hubo cambios
      if (updated) {
        console.log('🔄 Actualizando configuración...');
        const { error: updateError } = await supabase
          .from('business_config')
          .update(updates)
          .eq('id', config.id);
        
        if (updateError) {
          console.error('❌ Error al actualizar:', updateError);
        } else {
          console.log('✅ Configuración actualizada');
        }
      } else {
        console.log('ℹ️ No se requieren cambios');
      }
    }

    console.log('\n✅ Proceso de decodificación completado');
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
decodeUnicode()
  .then(() => {
    console.log('✅ Proceso completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error en el proceso:', error);
    process.exit(1);
  }); 