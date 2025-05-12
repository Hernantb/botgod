const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableStructure() {
    try {
        console.log('🔍 Verificando estructura de la tabla messages...');

        const sql = `
            SELECT 
                column_name, 
                data_type, 
                is_nullable,
                column_default
            FROM 
                information_schema.columns 
            WHERE 
                table_name = 'messages'
            ORDER BY 
                ordinal_position;
        `;

        const { data, error } = await supabase.rpc('exec_sql', { sql });

        if (error) {
            console.error('❌ Error al verificar estructura:', error);
            return;
        }

        console.log('📋 Estructura actual de la tabla messages:');
        console.log(data);

        // Verificar políticas actuales
        const policiesSql = `
            SELECT *
            FROM pg_policies
            WHERE tablename = 'messages';
        `;

        const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', { sql: policiesSql });

        if (policiesError) {
            console.error('❌ Error al verificar políticas:', policiesError);
            return;
        }

        console.log('\n🔒 Políticas actuales:');
        console.log(policies);

    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

checkTableStructure(); 