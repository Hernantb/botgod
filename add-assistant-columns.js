const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumns() {
  try {
    console.log('🔧 Verificando y creando columnas necesarias en la base de datos...');

    // Verificar si la columna assistant_instructions existe
    const { data: columnsData, error: columnsError } = await supabase
      .from('business_config')
      .select('assistant_instructions')
      .limit(1)
      .maybeSingle();

    if (columnsError && columnsError.code === 'PGRST204') {
      console.log('❌ La columna assistant_instructions no existe. Creándola...');
      
      // Ejecutar SQL directamente para agregar la columna
      const { error: alterError } = await supabase.rpc('execute_sql', {
        query: `ALTER TABLE business_config ADD COLUMN IF NOT EXISTS assistant_instructions TEXT;`
      });

      if (alterError) {
        console.error('❌ Error al agregar la columna assistant_instructions:', alterError);
      } else {
        console.log('✅ Columna assistant_instructions creada correctamente');
      }
    } else {
      console.log('✅ La columna assistant_instructions ya existe');
    }

    console.log('✅ Verificación y creación de columnas completada');
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar la función
addColumns()
  .then(() => {
    console.log('✅ Proceso completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error en el proceso:', error);
    process.exit(1);
  }); 