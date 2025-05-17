const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';
const CONVERSATION_ID = '4a42aa05-2ffd-418b-aa52-29e7c571eee8'; // ID de la conversación que tiene más de 1000 mensajes
const KEEP_RECENT = 200; // Número de mensajes recientes a mantener
const BATCH_SIZE = 50; // Tamaño del lote de eliminación (pequeño para evitar errores)

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteOldMessages() {
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
        
        // 2. Obtener los IDs de los mensajes recientes (que queremos mantener)
        const { data: recentMessages, error: recentError } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', CONVERSATION_ID)
            .order('created_at', { ascending: false })
            .limit(KEEP_RECENT);
            
        if (recentError) {
            console.error('❌ Error obteniendo mensajes recientes:', recentError);
            return;
        }
        
        const recentIds = recentMessages.map(msg => msg.id);
        console.log(`✅ Encontrados ${recentIds.length} mensajes recientes para mantener`);
        
        // 3. Eliminar los mensajes antiguos en lotes
        let deletedCount = 0;
        let hasMore = true;
        
        while (hasMore && deletedCount < toDelete) {
            // Obtener un lote de mensajes antiguos para eliminar
            const { data: oldBatch, error: batchError } = await supabase
                .from('messages')
                .select('id')
                .eq('conversation_id', CONVERSATION_ID)
                .not('id', 'in', `(${recentIds.join(',')})`)
                .order('created_at', { ascending: true })
                .limit(BATCH_SIZE);
                
            if (batchError) {
                console.error('❌ Error obteniendo lote de mensajes antiguos:', batchError);
                break;
            }
            
            if (!oldBatch || oldBatch.length === 0) {
                console.log('✅ No hay más mensajes para eliminar');
                hasMore = false;
                break;
            }
            
            // Extraer solo los IDs para eliminar
            const batchIds = oldBatch.map(msg => msg.id);
            console.log(`🔍 Eliminando lote de ${batchIds.length} mensajes...`);
            
            // Eliminar el lote
            const { error: deleteError } = await supabase
                .from('messages')
                .delete()
                .in('id', batchIds);
                
            if (deleteError) {
                console.error('❌ Error eliminando lote de mensajes:', deleteError);
                break;
            }
            
            deletedCount += batchIds.length;
            console.log(`✅ Progreso: ${deletedCount}/${toDelete} mensajes eliminados`);
            
            // Esperar un poco para no sobrecargar la API
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`✅ Se eliminaron ${deletedCount} mensajes antiguos exitosamente`);
        console.log('🔄 Ahora deberías poder ver los mensajes más recientes en el dashboard');
        
    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

// Ejecutar la función principal
deleteOldMessages(); 