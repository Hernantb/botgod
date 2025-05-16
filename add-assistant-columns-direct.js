const { Pool } = require('pg');
require('dotenv').config();

// Conexión a Postgres usando la URL de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Extraer información de conexión del URL de Supabase
const extractDbInfoFromUrl = (url) => {
  if (!url) {
    console.error('❌ URL de Supabase no proporcionada');
    return null;
  }
  
  try {
    // Formato típico: https://[project].supabase.co
    const hostname = new URL(url).hostname;
    const projectId = hostname.split('.')[0];
    
    // La conexión de PostgreSQL generalmente es:
    return {
      host: `db.${hostname}`,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: supabaseKey,
      ssl: { rejectUnauthorized: false }
    };
  } catch (error) {
    console.error('❌ Error al extraer información de conexión:', error);
    return null;
  }
};

async function addColumns() {
  const dbConfig = extractDbInfoFromUrl(supabaseUrl);
  if (!dbConfig) {
    console.error('❌ No se pudo obtener la configuración de la base de datos');
    return;
  }

  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔧 Conectando a PostgreSQL directamente...');
    const client = await pool.connect();
    console.log('✅ Conexión exitosa a PostgreSQL');
    
    console.log('🔧 Agregando columna assistant_instructions si no existe...');
    await client.query(`
      ALTER TABLE IF EXISTS business_config 
      ADD COLUMN IF NOT EXISTS assistant_instructions TEXT;
    `);
    
    console.log('✅ Columna assistant_instructions agregada o ya existía');
    
    client.release();
  } catch (error) {
    console.error('❌ Error al ejecutar SQL directo:', error);
  } finally {
    await pool.end();
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