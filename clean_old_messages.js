const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';
const CONVERSATION_ID = '4a42aa05-2ffd-418b-aa52-29e7c571eee8'; // ID de la conversación que tiene más de 1000 mensajes
const KEEP_RECENT = 200; // Número de mensajes recientes a mantener

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanOldMessages() {
    try {
        console.log('🔍 Iniciando limpieza de mensajes antiguos...');
        
        // 1. Contar el total de mensajes para esta conversación
        const { count, error: countError } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', CONVERSATION_ID);
            
        if (countError) {
            console.error('❌ Error contando mensajes:', countError);
            return;
        }
        
        console.log(`📊 Total de mensajes para la conversación: ${count}`);
        
        if (count <= KEEP_RECENT) {
            console.log('✅ No es necesario eliminar mensajes, hay menos que el límite de retención');
            return;
        }
        
        const toDelete = count - KEEP_RECENT;
        console.log(`🗑️ Se eliminarán ${toDelete} mensajes antiguos, manteniendo los ${KEEP_RECENT} más recientes`);
        
        // 2. Obtener los IDs de los mensajes a eliminar (los más antiguos)
        const { data: oldMessages, error: fetchError } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', CONVERSATION_ID)
            .order('created_at', { ascending: true })
            .limit(toDelete);
            
        if (fetchError) {
            console.error('❌ Error obteniendo mensajes antiguos:', fetchError);
            return;
        }
        
        console.log(`🔍 Encontrados ${oldMessages.length} mensajes antiguos para eliminar`);
        
        if (oldMessages.length === 0) {
            console.log('✅ No hay mensajes para eliminar');
            return;
        }
        
        // Extraer solo los IDs para eliminar
        const idsToDelete = oldMessages.map(msg => msg.id);
        
        // 3. Eliminar los mensajes antiguos
        const { error: deleteError } = await supabase
            .from('messages')
            .delete()
            .in('id', idsToDelete);
            
        if (deleteError) {
            console.error('❌ Error eliminando mensajes:', deleteError);
            return;
        }
        
        console.log(`✅ Se eliminaron ${idsToDelete.length} mensajes antiguos exitosamente`);
        console.log('🔄 Ahora deberías poder ver los mensajes más recientes en el dashboard');
        
    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

// Ejecutar la función principal
cleanOldMessages(); 