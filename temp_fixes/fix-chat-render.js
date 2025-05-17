/**
 * Fix-Chat-Render - Script para diagnosticar y corregir problemas de renderización
 * del componente de chat principal.
 */

const fs = require('fs');
const path = require('path');

// Definir rutas de archivos importantes para revisar
const CHAT_INTERFACE_PATH = path.join(__dirname, '..', 'components', 'minimal-chat-interface.tsx');
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

// Función para diagnosticar problemas en el componente MinimalChatInterface
function diagnoseChatInterface() {
  console.log('\n=== Diagnóstico de MinimalChatInterface ===');
  
  const content = readFile(CHAT_INTERFACE_PATH);
  if (!content) return false;
  
  // Verificar si se manejan correctamente las referencias al chat seleccionado
  if (!content.includes('selectedChat ? (')) {
    console.error('❌ Error: No se encontró la condición correcta para renderizar el chat seleccionado');
    return false;
  }
  
  // Verificar que se está manejando correctamente la carga inicial de la conversación
  if (!content.includes('fetchMessagesForChat(conversationId)')) {
    console.error('❌ Error: No se encontró la función para cargar mensajes del chat');
    return false;
  }
  
  console.log('✅ La estructura básica de MinimalChatInterface parece correcta');
  
  // Buscar posibles problemas en la lógica de renderización
  const potentialIssues = [
    {
      pattern: 'selectedChat && typeof selectedChat !== "string" && !selectedChat.id',
      message: 'Posible problema con el tipo de selectedChat (puede ser null o no tener id)'
    },
    {
      pattern: 'conversations.find((c) => c.id === selectedChat)',
      message: 'La comparación directa puede fallar si selectedChat es un objeto en lugar de string'
    }
  ];
  
  let hasIssues = false;
  potentialIssues.forEach(issue => {
    if (content.includes(issue.pattern)) {
      console.log(`⚠️ Advertencia: ${issue.message}`);
      hasIssues = true;
    }
  });
  
  return !hasIssues;
}

// Función para diagnosticar problemas en el componente MinimalChatView
function diagnoseChatView() {
  console.log('\n=== Diagnóstico de MinimalChatView ===');
  
  const content = readFile(CHAT_VIEW_PATH);
  if (!content) return false;
  
  // Verificar que se manejan correctamente las referencias a la conversación
  if (!content.includes('conversation?.id') && content.includes('conversation.id')) {
    console.log('⚠️ Advertencia: Acceso directo a conversation.id sin verificación de nulo');
  }
  
  // Verificar que se renderiza el contenido correctamente
  if (!content.includes('messages.map')) {
    console.error('❌ Error: No se encontró el mapeo para renderizar los mensajes');
    return false;
  }
  
  console.log('✅ La estructura básica de MinimalChatView parece correcta');
  
  return true;
}

// Función para corregir problemas comunes en MinimalChatInterface
function fixChatInterface() {
  console.log('\n=== Corrigiendo MinimalChatInterface ===');
  
  // Crear backup antes de modificar
  if (!backupFile(CHAT_INTERFACE_PATH)) {
    console.error('❌ Error: No se pudo crear backup antes de modificar MinimalChatInterface');
    return false;
  }
  
  let content = readFile(CHAT_INTERFACE_PATH);
  if (!content) return false;
  
  // Corregir problema común: selectedChat puede ser un objeto o un string
  let fixed = false;
  
  // 1. Corregir la condición para encontrar la conversación seleccionada
  const oldFindPattern = /conversation={conversations\.find\(\(c\) => c\.id === selectedChat\)/;
  const newFindCode = 'conversation={conversations.find((c) => c.id === (typeof selectedChat === "string" ? selectedChat : selectedChat?.id))';
  
  if (content.match(oldFindPattern)) {
    content = content.replace(oldFindPattern, newFindCode);
    fixed = true;
    console.log('✅ Corregida la lógica para encontrar conversación seleccionada');
  }
  
  // 2. Asegurarse de que la referencia al ID es segura
  const oldIdPattern = /id: typeof selectedChat === 'string' \? selectedChat : selectedChat\.id,/;
  const newIdCode = 'id: typeof selectedChat === "string" ? selectedChat : selectedChat?.id || "unknown",';
  
  if (content.match(oldIdPattern)) {
    content = content.replace(oldIdPattern, newIdCode);
    fixed = true;
    console.log('✅ Corregida la referencia segura al ID de conversación');
  }
  
  // 3. Asegurarse de que se maneja correctamente cuando no hay chat seleccionado
  if (content.includes('<MinimalChatView') && !content.includes('selectedChat && <MinimalChatView')) {
    content = content.replace(
      '<MinimalChatView',
      'selectedChat && <MinimalChatView'
    );
    fixed = true;
    console.log('✅ Añadida comprobación adicional antes de renderizar MinimalChatView');
  }
  
  if (fixed) {
    if (writeFile(CHAT_INTERFACE_PATH, content)) {
      console.log('✅ Archivo MinimalChatInterface corregido con éxito');
      return true;
    }
  } else {
    console.log('ℹ️ No se encontraron problemas específicos para corregir en MinimalChatInterface');
  }
  
  return false;
}

// Función para corregir problemas comunes en MinimalChatView
function fixChatView() {
  console.log('\n=== Corrigiendo MinimalChatView ===');
  
  // Crear backup antes de modificar
  if (!backupFile(CHAT_VIEW_PATH)) {
    console.error('❌ Error: No se pudo crear backup antes de modificar MinimalChatView');
    return false;
  }
  
  let content = readFile(CHAT_VIEW_PATH);
  if (!content) return false;
  
  // Corregir accesos directos a propiedades que podrían ser nulas
  let fixed = false;
  
  // 1. Asegurar acceso seguro a ID de conversación
  const directIdAccess = /conversation\.id/g;
  const safeIdAccess = 'conversation?.id';
  
  let count = 0;
  content = content.replace(directIdAccess, (match) => {
    count++;
    return safeIdAccess;
  });
  
  if (count > 0) {
    fixed = true;
    console.log(`✅ Corregidos ${count} accesos directos a conversation.id`);
  }
  
  // 2. Asegurar comprobación de mensajes vacíos
  if (!content.includes('messages?.length') && content.includes('messages.length')) {
    content = content.replace(/messages\.length/g, 'messages?.length');
    fixed = true;
    console.log('✅ Corregida referencia segura a messages.length');
  }
  
  // 3. Verificar manejo de messages.map
  if (content.includes('messages.map') && !content.includes('messages?.map')) {
    content = content.replace(/messages\.map/g, 'messages?.map || []');
    fixed = true;
    console.log('✅ Corregido mapeo seguro de mensajes');
  }
  
  if (fixed) {
    if (writeFile(CHAT_VIEW_PATH, content)) {
      console.log('✅ Archivo MinimalChatView corregido con éxito');
      return true;
    }
  } else {
    console.log('ℹ️ No se encontraron problemas específicos para corregir en MinimalChatView');
  }
  
  return false;
}

// Función principal que ejecuta el diagnóstico y las correcciones
function main() {
  console.log('=== INICIANDO DIAGNÓSTICO Y CORRECCIÓN DEL CHAT ===');
  
  // Verificar que los archivos existen
  if (!fs.existsSync(CHAT_INTERFACE_PATH)) {
    console.error(`❌ Error: No se encontró el archivo ${CHAT_INTERFACE_PATH}`);
    return;
  }
  
  if (!fs.existsSync(CHAT_VIEW_PATH)) {
    console.error(`❌ Error: No se encontró el archivo ${CHAT_VIEW_PATH}`);
    return;
  }
  
  // Ejecutar diagnóstico
  const chatInterfaceOk = diagnoseChatInterface();
  const chatViewOk = diagnoseChatView();
  
  console.log('\n=== RESULTADOS DEL DIAGNÓSTICO ===');
  console.log(`MinimalChatInterface: ${chatInterfaceOk ? '✅ OK' : '⚠️ Posibles problemas'}`);
  console.log(`MinimalChatView: ${chatViewOk ? '✅ OK' : '⚠️ Posibles problemas'}`);
  
  // Preguntar si se quieren aplicar correcciones
  console.log('\n=== APLICANDO CORRECCIONES ===');
  
  // Aplicar correcciones
  const chatInterfaceFixed = fixChatInterface();
  const chatViewFixed = fixChatView();
  
  console.log('\n=== RESUMEN DE CORRECCIONES ===');
  console.log(`MinimalChatInterface: ${chatInterfaceFixed ? '✅ Corregido' : 'ℹ️ Sin cambios'}`);
  console.log(`MinimalChatView: ${chatViewFixed ? '✅ Corregido' : 'ℹ️ Sin cambios'}`);
  
  if (chatInterfaceFixed || chatViewFixed) {
    console.log('\n=== INSTRUCCIONES PARA APLICAR LOS CAMBIOS ===');
    console.log('1. Detén el servidor de desarrollo (Ctrl+C)');
    console.log('2. Inicia el servidor nuevamente con: npm run dev');
    console.log('3. Si los problemas persisten, revisa las copias de seguridad en:');
    if (chatInterfaceFixed) console.log(`   - ${CHAT_INTERFACE_PATH}.backup-*`);
    if (chatViewFixed) console.log(`   - ${CHAT_VIEW_PATH}.backup-*`);
  } else {
    console.log('\n⚠️ No se realizaron cambios automáticos, pero podrían existir otros problemas.');
    console.log('Recomendaciones:');
    console.log('1. Verifica que el servidor del bot (WhatsApp) esté funcionando correctamente');
    console.log('2. Asegúrate de que la conexión con Supabase esté funcionando');
    console.log('3. Revisa la consola del navegador para ver errores específicos');
  }
}

// Ejecutar la función principal
main(); 