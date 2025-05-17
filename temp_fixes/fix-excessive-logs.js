/**
 * Fix-Excessive-Logs - Script para solucionar problemas de logs infinitos
 * en la aplicación.
 */

const fs = require('fs');
const path = require('path');

// Definir rutas de archivos que tienen logs problemáticos
const MESSAGES_SERVICE_PATH = path.join(__dirname, '..', 'services', 'messages.ts');
const SUPABASE_CLIENT_PATH = path.join(__dirname, '..', 'lib', 'supabase.ts');
const API_CLIENT_PATH = path.join(__dirname, '..', 'lib', 'api-client.ts');
const CHAT_VIEW_PATH = path.join(__dirname, '..', 'components', 'minimal-chat-view.tsx');

// Función para leer un archivo
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`❌ Error leyendo archivo ${filePath}:`, error.message);
    return null;
  }
}

// Función para escribir un archivo
function writeFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Archivo modificado correctamente: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error escribiendo archivo ${filePath}:`, error.message);
    return false;
  }
}

// Crear copia de seguridad de un archivo
function backupFile(filePath) {
  const backupPath = `${filePath}.backup-${Date.now()}`;
  try {
    const content = readFile(filePath);
    if (content) {
      writeFile(backupPath, content);
      console.log(`✅ Copia de seguridad creada: ${backupPath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error creando backup de ${filePath}:`, error.message);
    return false;
  }
}

// Función para fijar logs excesivos en el servicio de mensajes
function fixMessagesService() {
  console.log('\n=== Corrigiendo logs excesivos en services/messages.ts ===');
  
  // Crear backup antes de modificar
  if (!backupFile(MESSAGES_SERVICE_PATH)) {
    console.error('❌ Error: No se pudo crear backup antes de modificar services/messages.ts');
    return false;
  }
  
  let content = readFile(MESSAGES_SERVICE_PATH);
  if (!content) return false;
  
  // Patrones de logs problemáticos
  const problematicLogs = [
    { pattern: /console\.log\(\s*['"`]🔍 Transformando mensaje original:['"`]/, count: 0 },
    { pattern: /console\.log\(\s*[`'"]💬 Transformando mensaje tipo:/, count: 0 },
    { pattern: /console\.log\(\s*[`'"]💬 Contenido del mensaje transformado:/, count: 0 },
    { pattern: /console\.log\(\s*[`'"]✅ Mensajes transformados:/, count: 0 },
    { pattern: /console\.log\(\s*[`'"]📊 Mensajes filtrados finales:/, count: 0 },
    { pattern: /console\.log\(\s*[`'"]🔄 Obteniendo mensajes para conversación:/, count: 0 },
  ];
  
  let fixed = false;
  
  // Modificar cada patrón para agregar verificación de entorno
  problematicLogs.forEach(log => {
    const replacement = `if (process.env.NODE_ENV === 'development' && process.env.DEBUG_MESSAGES) console.log(`;
    
    // Contar ocurrencias
    const matches = content.match(new RegExp(log.pattern, 'g')) || [];
    log.count = matches.length;
    
    if (log.count > 0) {
      content = content.replace(new RegExp(log.pattern, 'g'), replacement);
      fixed = true;
    }
  });
  
  // Mostrar resumen de cambios
  let totalFixed = problematicLogs.reduce((sum, log) => sum + log.count, 0);
  if (totalFixed > 0) {
    console.log(`✅ Se modificaron ${totalFixed} logs en services/messages.ts:`);
    problematicLogs.forEach(log => {
      if (log.count > 0) {
        console.log(`   - ${log.count} ocurrencias de ${log.pattern}`);
      }
    });
    
    // Añadir variable de entorno para control
    if (!content.includes('DEBUG_MESSAGES')) {
      const envComment = `
// Variable de control para logs detallados de mensajes
// Para habilitar los logs: process.env.DEBUG_MESSAGES = "true" en desarrollo
const DEBUG_MESSAGES = process.env.NODE_ENV === 'development' && process.env.DEBUG_MESSAGES === 'true';
`;
      content = envComment + content;
      console.log('✅ Añadida variable de control DEBUG_MESSAGES');
    }
    
    if (writeFile(MESSAGES_SERVICE_PATH, content)) {
      console.log('✅ Archivo services/messages.ts corregido con éxito');
      return true;
    }
  } else {
    console.log('ℹ️ No se encontraron logs problemáticos en services/messages.ts');
  }
  
  return false;
}

// Función para fijar logs excesivos en el cliente de Supabase
function fixSupabaseClient() {
  console.log('\n=== Corrigiendo logs excesivos en lib/supabase.ts ===');
  
  // Crear backup antes de modificar
  if (!backupFile(SUPABASE_CLIENT_PATH)) {
    console.error('❌ Error: No se pudo crear backup antes de modificar lib/supabase.ts');
    return false;
  }
  
  let content = readFile(SUPABASE_CLIENT_PATH);
  if (!content) return false;
  
  // Modificar la variable DEBUG
  const debugVarPattern = /const\s+DEBUG\s*=\s*false\s*;/;
  if (content.match(debugVarPattern)) {
    content = content.replace(
      debugVarPattern,
      "const DEBUG = process.env.NODE_ENV === 'development' && process.env.DEBUG_SUPABASE === 'true';"
    );
    console.log('✅ Variable DEBUG modificada para usar variable de entorno');
  }
  
  // Modificar función de log en subscribeToConversationMessages
  const logFunctionPattern = /const\s+log\s*=\s*\(message:\s*string\)\s*=>\s*{\s*if\s*\(isDev\)/;
  if (content.match(logFunctionPattern)) {
    content = content.replace(
      logFunctionPattern,
      "const log = (message: string) => {\n    if (isDev && process.env.DEBUG_SUPABASE === 'true'"
    );
    console.log('✅ Función log modificada para usar variable de entorno');
  }
  
  // Buscar comentarios estresantes en el archivo
  const stressfulLogs = [
    { pattern: /console\.log\(\s*[`'"]🔔/, count: 0 },
    { pattern: /console\.log\(\s*[`'"]ℹ️/, count: 0 },
    { pattern: /console\.log\(\s*[`'"]⚠️/, count: 0 },
    { pattern: /console\.log\(\s*[`'"]🟢/, count: 0 },
  ];
  
  let logCount = 0;
  stressfulLogs.forEach(log => {
    const matches = content.match(new RegExp(log.pattern, 'g')) || [];
    log.count = matches.length;
    logCount += log.count;
  });
  
  console.log(`ℹ️ Se encontraron ${logCount} logs potencialmente excesivos en lib/supabase.ts`);
  
  if (writeFile(SUPABASE_CLIENT_PATH, content)) {
    console.log('✅ Archivo lib/supabase.ts corregido con éxito');
    return true;
  }
  
  return false;
}

// Función para fijar logs excesivos en el cliente de API
function fixApiClient() {
  console.log('\n=== Corrigiendo logs excesivos en lib/api-client.ts ===');
  
  // Crear backup antes de modificar
  if (!backupFile(API_CLIENT_PATH)) {
    console.error('❌ Error: No se pudo crear backup antes de modificar lib/api-client.ts');
    return false;
  }
  
  let content = readFile(API_CLIENT_PATH);
  if (!content) return false;
  
  // Patrones de logs problemáticos
  const problematicLogs = [
    { pattern: /console\.log\(\s*[`'"]📱 Obteniendo mensajes para:/, count: 0 },
    { pattern: /console\.log\(\s*[`'"]✅ Se recibieron/, count: 0 },
    { pattern: /console\.log\(\s*[`'"]ℹ️ Conversación confirmada:/, count: 0 },
  ];
  
  let fixed = false;
  
  // Modificar cada patrón para agregar verificación de entorno
  problematicLogs.forEach(log => {
    const replacement = `if (process.env.NODE_ENV === 'development' && process.env.DEBUG_API) console.log(`;
    
    // Contar ocurrencias
    const matches = content.match(new RegExp(log.pattern, 'g')) || [];
    log.count = matches.length;
    
    if (log.count > 0) {
      content = content.replace(new RegExp(log.pattern, 'g'), replacement);
      fixed = true;
    }
  });
  
  // Mostrar resumen de cambios
  let totalFixed = problematicLogs.reduce((sum, log) => sum + log.count, 0);
  if (totalFixed > 0) {
    console.log(`✅ Se modificaron ${totalFixed} logs en lib/api-client.ts:`);
    
    // Añadir variable de entorno para control
    if (!content.includes('DEBUG_API')) {
      const envComment = `
// Variable de control para logs detallados de API
// Para habilitar los logs: process.env.DEBUG_API = "true" en desarrollo
// const DEBUG_API = process.env.NODE_ENV === 'development' && process.env.DEBUG_API === 'true';
`;
      content = envComment + content;
      console.log('✅ Añadida variable de control DEBUG_API');
    }
    
    if (writeFile(API_CLIENT_PATH, content)) {
      console.log('✅ Archivo lib/api-client.ts corregido con éxito');
      return true;
    }
  } else {
    console.log('ℹ️ No se encontraron logs problemáticos en lib/api-client.ts');
  }
  
  return false;
}

// Función para fijar logs excesivos en MinimalChatView
function fixChatView() {
  console.log('\n=== Corrigiendo logs excesivos en components/minimal-chat-view.tsx ===');
  
  // Crear backup antes de modificar
  if (!backupFile(CHAT_VIEW_PATH)) {
    console.error('❌ Error: No se pudo crear backup antes de modificar components/minimal-chat-view.tsx');
    return false;
  }
  
  let content = readFile(CHAT_VIEW_PATH);
  if (!content) return false;
  
  // Patrones de logs problemáticos
  const problematicLogs = [
    { pattern: /console\.log\(\s*[`'"]Formateando \$\{filteredMessages/, count: 0 },
    { pattern: /console\.log\(\s*[`'"]Mensajes agrupados en/, count: 0 },
    { pattern: /console\.log\(\s*[`'"]Resultado final:/, count: 0 },
  ];
  
  let fixed = false;
  
  // Modificar cada patrón para agregar verificación de entorno
  problematicLogs.forEach(log => {
    const replacement = `if (process.env.NODE_ENV === 'development' && process.env.DEBUG_UI) console.log(`;
    
    // Contar ocurrencias
    const matches = content.match(new RegExp(log.pattern, 'g')) || [];
    log.count = matches.length;
    
    if (log.count > 0) {
      content = content.replace(new RegExp(log.pattern, 'g'), replacement);
      fixed = true;
    }
  });
  
  // Mostrar resumen de cambios
  let totalFixed = problematicLogs.reduce((sum, log) => sum + log.count, 0);
  if (totalFixed > 0) {
    console.log(`✅ Se modificaron ${totalFixed} logs en components/minimal-chat-view.tsx`);
    
    // Añadir variable de entorno para control
    if (!content.includes('DEBUG_UI')) {
      const envComment = `
  // Variable de control para logs de UI
  // const DEBUG_UI = process.env.NODE_ENV === 'development' && process.env.DEBUG_UI === 'true';
`;
      
      // Insertar después del primer useState
      content = content.replace(
        /const \[[\w]+, set[\w]+\] = useState\([^)]*\)/,
        match => match + `;\n${envComment}`
      );
      
      console.log('✅ Añadida variable de control DEBUG_UI');
    }
    
    if (writeFile(CHAT_VIEW_PATH, content)) {
      console.log('✅ Archivo components/minimal-chat-view.tsx corregido con éxito');
      return true;
    }
  } else {
    console.log('ℹ️ No se encontraron logs problemáticos en components/minimal-chat-view.tsx');
  }
  
  return false;
}

// Función principal que ejecuta todas las correcciones
function main() {
  console.log('=== INICIANDO CORRECCIÓN DE LOGS EXCESIVOS ===');
  
  // Verificar que los archivos existen
  const files = [
    { path: MESSAGES_SERVICE_PATH, name: 'services/messages.ts' },
    { path: SUPABASE_CLIENT_PATH, name: 'lib/supabase.ts' },
    { path: API_CLIENT_PATH, name: 'lib/api-client.ts' },
    { path: CHAT_VIEW_PATH, name: 'components/minimal-chat-view.tsx' },
  ];
  
  let allFilesExist = true;
  files.forEach(file => {
    if (!fs.existsSync(file.path)) {
      console.error(`❌ Error: No se encontró el archivo ${file.name}`);
      allFilesExist = false;
    }
  });
  
  if (!allFilesExist) {
    console.error('❌ Error: Faltan archivos importantes. Verifica la estructura del proyecto.');
    return;
  }
  
  // Aplicar correcciones
  const messagesFixed = fixMessagesService();
  const supabaseFixed = fixSupabaseClient();
  const apiClientFixed = fixApiClient();
  const chatViewFixed = fixChatView();
  
  console.log('\n=== RESUMEN DE CORRECCIONES ===');
  console.log(`services/messages.ts: ${messagesFixed ? '✅ Corregido' : 'ℹ️ Sin cambios'}`);
  console.log(`lib/supabase.ts: ${supabaseFixed ? '✅ Corregido' : 'ℹ️ Sin cambios'}`);
  console.log(`lib/api-client.ts: ${apiClientFixed ? '✅ Corregido' : 'ℹ️ Sin cambios'}`);
  console.log(`components/minimal-chat-view.tsx: ${chatViewFixed ? '✅ Corregido' : 'ℹ️ Sin cambios'}`);
  
  if (messagesFixed || supabaseFixed || apiClientFixed || chatViewFixed) {
    console.log('\n=== INSTRUCCIONES PARA APLICAR LOS CAMBIOS ===');
    console.log('1. Detén el servidor de desarrollo (Ctrl+C)');
    console.log('2. Inicia el servidor nuevamente con: npm run dev');
    console.log('3. Para habilitar logs selectivamente en desarrollo, puedes usar:');
    console.log('   DEBUG_MESSAGES=true DEBUG_SUPABASE=true DEBUG_API=true DEBUG_UI=true npm run dev');
    console.log('\n4. Si los problemas persisten, revisa las copias de seguridad en:');
    if (messagesFixed) console.log(`   - ${MESSAGES_SERVICE_PATH}.backup-*`);
    if (supabaseFixed) console.log(`   - ${SUPABASE_CLIENT_PATH}.backup-*`);
    if (apiClientFixed) console.log(`   - ${API_CLIENT_PATH}.backup-*`);
    if (chatViewFixed) console.log(`   - ${CHAT_VIEW_PATH}.backup-*`);
    
    console.log('\n✅ ¡Correcciones aplicadas con éxito! El rendimiento de la aplicación debería mejorar significativamente.');
  } else {
    console.log('\n⚠️ No se realizaron cambios automáticos, pero podrían existir otros problemas con los logs.');
  }
}

// Ejecutar la función principal
main(); 