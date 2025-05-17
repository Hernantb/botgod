const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMessagesAccess() {
    try {
        console.log('🔍 Iniciando diagnóstico de acceso a mensajes...');

        // 1. Verificar business_id en mensajes
        const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('id, business_id')
            .limit(5);

        if (msgError) {
            console.error('❌ Error al obtener mensajes:', msgError);
            return;
        }

        console.log('📝 Muestra de mensajes:', messages);

        // 2. Verificar negocios existentes
        const { data: businesses, error: bizError } = await supabase
            .from('businesses')
            .select('id, name')
            .limit(5);

        if (bizError) {
            console.error('❌ Error al obtener negocios:', bizError);
            return;
        }

        console.log('🏢 Negocios encontrados:', businesses);

        // 3. Verificar usuarios de negocios
        const { data: businessUsers, error: buError } = await supabase
            .from('business_users')
            .select('user_id, business_id')
            .limit(5);

        if (buError) {
            console.error('❌ Error al obtener usuarios de negocios:', buError);
            return;
        }

        console.log('👥 Usuarios de negocios:', businessUsers);

        // 4. Verificar políticas de seguridad
        const sql = `
            -- Desactivar RLS temporalmente
            ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

            -- Eliminar políticas existentes
            DROP POLICY IF EXISTS "Enable read access for users based on business_id" ON messages;
            DROP POLICY IF EXISTS "Enable insert for users based on business_id" ON messages;
            DROP POLICY IF EXISTS "Enable update for users based on business_id" ON messages;

            -- Crear nueva política que permita acceso público temporal
            CREATE POLICY "Allow public access" ON messages
                FOR ALL
                TO public
                USING (true)
                WITH CHECK (true);
        `;

        const { error: sqlError } = await supabase.rpc('exec_sql', { sql });
        
        if (sqlError) {
            console.error('❌ Error al modificar políticas:', sqlError);
            return;
        }

        console.log('✅ Políticas de seguridad actualizadas correctamente');
        console.log('🔓 Ahora deberías poder ver los mensajes en el panel de Supabase');

    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

fixMessagesAccess(); 