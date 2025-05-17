require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Verificar las variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Variables de entorno no encontradas');
  console.error('Necesitas definir SUPABASE_URL y SUPABASE_ANON_KEY en el archivo .env');
  process.exit(1);
}

console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey.substring(0, 10) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function showMessageStats() {
  const { data, error } = await supabase
    .rpc('count_messages_by_period');

  if (error) {
    console.error('Error al obtener estadísticas:', error);
    return;
  }

  console.log('\nEstadísticas de mensajes:');
  console.log('------------------------');
  let totalMessages = 0;
  data.forEach(({ period, message_count, storage_size_bytes }) => {
    console.log(`${period}:`);
    console.log(`  - Mensajes: ${message_count}`);
    console.log(`  - Tamaño: ${(storage_size_bytes / 1024 / 1024).toFixed(2)} MB`);
    totalMessages += message_count;
  });
  console.log('\nTotal de mensajes:', totalMessages);
  return totalMessages;
}

async function deleteOldMessages(messagesToKeep = 50, batchSize = 1000) {
  console.log(`\nBorrando mensajes antiguos, manteniendo los últimos ${messagesToKeep} mensajes...`);
  
  let totalDeleted = 0;
  let deletedInBatch;

  do {
    const { data, error } = await supabase
      .rpc('delete_old_messages_keep_last_n', {
        messages_to_keep: messagesToKeep,
        batch_size: batchSize
      });

    if (error) {
      console.error('Error al borrar mensajes:', error);
      break;
    }

    deletedInBatch = data;
    totalDeleted += deletedInBatch;
    
    if (deletedInBatch > 0) {
      console.log(`Borrados ${deletedInBatch} mensajes...`);
    }
  } while (deletedInBatch === batchSize);

  console.log(`\nTotal de mensajes borrados: ${totalDeleted}`);
}

async function main() {
  console.log('=== Limpieza de Mensajes ===');
  
  // Mostrar estadísticas antes
  console.log('\nEstadísticas antes de la limpieza:');
  const totalMessages = await showMessageStats();

  // Preguntar si desea continuar
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question(`\n¿Cuántos mensajes desea mantener? (Enter para 50, hay ${totalMessages} mensajes en total): `, async (count) => {
    const messagesToKeep = parseInt(count) || 50;
    
    readline.question(`¿Desea proceder con el borrado de mensajes, manteniendo los últimos ${messagesToKeep}? (s/N): `, async (answer) => {
      if (answer.toLowerCase() === 's') {
        await deleteOldMessages(messagesToKeep);
        
        console.log('\nEstadísticas después de la limpieza:');
        await showMessageStats();
      } else {
        console.log('\nOperación cancelada.');
      }
      
      readline.close();
      process.exit(0);
    });
  });
}

main().catch(console.error); 