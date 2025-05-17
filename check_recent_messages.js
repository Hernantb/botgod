const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentMessages() {
    try {
        console.log('🔍 Verificando mensajes recientes en Supabase...');
        
        // Obtener los 15 mensajes más recientes
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(15);
            
        if (error) {
            console.error('❌ Error al obtener mensajes:', error);
            return;
        }
        
        console.log(`✅ Encontrados ${messages.length} mensajes recientes:`);
        
        // Mostrar los mensajes
        messages.forEach((msg, index) => {
            console.log(`\n📝 Mensaje #${index + 1}:`);
            console.log(`ID: ${msg.id}`);
            console.log(`Tipo: ${msg.sender_type}`);
            console.log(`Contenido: ${msg.content}`);
            console.log(`Fecha: ${msg.created_at}`);
            console.log(`Conversación ID: ${msg.conversation_id}`);
        });
        
        // Buscar específicamente el mensaje "Ntp así déjalo"
        console.log('\n🔍 Buscando mensaje específico "Ntp así déjalo"...');
        const { data: specificMessages, error: specificError } = await supabase
            .from('messages')
            .select('*')
            .ilike('content', '%Ntp así déjalo%')
            .order('created_at', { ascending: false });
            
        if (specificError) {
            console.error('❌ Error al buscar mensaje específico:', specificError);
            return;
        }
        
        if (specificMessages.length === 0) {
            console.log('⚠️ No se encontró el mensaje "Ntp así déjalo" en la base de datos');
        } else {
            console.log(`✅ Se encontraron ${specificMessages.length} coincidencias:`);
            specificMessages.forEach((msg, index) => {
                console.log(`\n📝 Coincidencia #${index + 1}:`);
                console.log(`ID: ${msg.id}`);
                console.log(`Tipo: ${msg.sender_type}`);
                console.log(`Contenido: ${msg.content}`);
                console.log(`Fecha: ${msg.created_at}`);
                console.log(`Conversación ID: ${msg.conversation_id}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

checkRecentMessages(); 