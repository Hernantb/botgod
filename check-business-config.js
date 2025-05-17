const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBusinessConfig() {
  try {
    console.log('Consultando tabla business_config...');
    
    // Obtener una entrada de ejemplo para ver la estructura
    const { data, error } = await supabase
      .from('business_config')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('Error consultando business_config:', error.message);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No hay entradas en la tabla business_config');
      return;
    }
    
    // Mostrar las columnas de la tabla
    console.log('Estructura de business_config:');
    const columns = Object.keys(data[0]);
    columns.forEach(column => {
      const value = data[0][column];
      const valueType = value === null ? 'null' : typeof value;
      console.log(`- ${column}: ${valueType}`);
    });
    
    // Mostrar un ejemplo de registro
    console.log('\nEjemplo de configuración:');
    console.log(JSON.stringify(data[0], null, 2));
    
  } catch (error) {
    console.error('Error en consulta:', error);
  }
}

checkBusinessConfig(); 