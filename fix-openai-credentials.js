const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
require('dotenv').config();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuración de OpenAI
const openaiApiKey = process.env.OPENAI_API_KEY;

async function validateOpenAICredentials() {
  try {
    console.log('🔧 Verificando credenciales y configuración de OpenAI...');

    // 1. Obtener configuración actual
    const { data: businessConfig, error: configError } = await supabase
      .from('business_config')
      .select('id, business_name, openai_api_key, openai_assistant_id')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (configError) {
      console.error('❌ Error al obtener configuración:', configError);
      return;
    }

    console.log(`🔍 Encontradas ${businessConfig.length} configuraciones de negocio`);

    // 2. Verificar cada configuración
    for (const config of businessConfig) {
      console.log(`\n📋 Verificando negocio: ${config.business_name} (${config.id})`);
      
      // Verificar API Key
      const apiKey = config.openai_api_key || openaiApiKey;
      if (!apiKey) {
        console.log('⚠️ No hay API Key de OpenAI configurada');
        continue;
      }
      
      console.log(`🔑 API Key encontrada: ${apiKey.substring(0, 10)}...`);

      // Verificar Assistant ID
      if (!config.openai_assistant_id) {
        console.log('⚠️ No hay ID de asistente configurado');
        continue;
      }
      
      console.log(`👤 Asistente ID: ${config.openai_assistant_id}`);

      // Verificar conexión con OpenAI
      try {
        const openai = new OpenAI({ apiKey });
        console.log('🔄 Probando conexión con OpenAI...');
        
        const models = await openai.models.list();
        console.log('✅ Conexión a OpenAI exitosa');
        
        // Verificar asistente
        try {
          console.log(`🔄 Verificando asistente ${config.openai_assistant_id}...`);
          const assistant = await openai.beta.assistants.retrieve(config.openai_assistant_id);
          console.log(`✅ Asistente verificado: ${assistant.name}`);
          
          // Actualizar asistente si es necesario
          if (!assistant.instructions) {
            console.log('🔄 Actualizando instrucciones del asistente...');
            await openai.beta.assistants.update(config.openai_assistant_id, {
              instructions: "Instrucciones predeterminadas para el asistente."
            });
            console.log('✅ Instrucciones del asistente actualizadas');
          }
        } catch (assistantError) {
          console.error('❌ Error al verificar asistente:', assistantError.message);
          
          // Si el asistente no existe, crear uno nuevo
          if (assistantError.status === 404) {
            console.log('🔄 Creando nuevo asistente...');
            const newAssistant = await openai.beta.assistants.create({
              name: `${config.business_name} Assistant`,
              instructions: "Asistente predeterminado creado automáticamente.",
              model: "gpt-4-turbo-preview"
            });
            
            console.log(`✅ Nuevo asistente creado: ${newAssistant.id}`);
            
            // Actualizar la base de datos con el nuevo ID
            const { error: updateError } = await supabase
              .from('business_config')
              .update({ openai_assistant_id: newAssistant.id })
              .eq('id', config.id);
              
            if (updateError) {
              console.error('❌ Error al actualizar ID de asistente:', updateError);
            } else {
              console.log('✅ ID de asistente actualizado en la base de datos');
            }
          }
        }
      } catch (openaiError) {
        console.error('❌ Error de conexión con OpenAI:', openaiError.message);
      }
    }

    console.log('\n✅ Verificación de OpenAI completada');
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
validateOpenAICredentials()
  .then(() => {
    console.log('✅ Proceso completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error en el proceso:', error);
    process.exit(1);
  }); 