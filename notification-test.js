// Script independiente para probar notificaciones
const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTgyMjc2OCwiZXhwIjoyMDU3Mzk4NzY4fQ.eAMYqHQ5ma_2tPXOwCYKw3tt_vERE0zhBj2xS1srv9M';
const supabase = createClient(supabaseUrl, supabaseKey);

// ID del negocio para las notificaciones
const BUSINESS_ID = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

// Función para verificar si un mensaje contiene frases de notificación
function checkNotificationPhrases(message) {
  console.log(`🔔 Analizando mensaje: "${message}"`);
  
  if (!message || typeof message !== 'string') {
    console.error(`❌ Mensaje inválido`);
    return false;
  }
  
  const normalizedMessage = message.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  console.log(`🔔 Mensaje normalizado: "${normalizedMessage}"`);
  
  const phrases = [
    "perfecto! un asesor te llamara", 
    "perfecto! un asesor te llamará",
    "un asesor te llamará",
    "tu cita ha sido confirmada",
    "tu cita ha sido registrada"
  ];
  
  for (const phrase of phrases) {
    if (normalizedMessage.includes(phrase)) {
      console.log(`✅ Coincidencia encontrada con: "${phrase}"`);
      return true;
    }
  }
  
  // Palabras clave para verificación parcial
  const keywords = ["cita", "asesor", "llamará", "confirmada"];
  let matchCount = 0;
  
  for (const word of keywords) {
    if (normalizedMessage.includes(word)) {
      matchCount++;
      console.log(`🔍 Palabra clave encontrada: "${word}"`);
    }
  }
  
  if (matchCount >= 2) {
    console.log(`✅ Múltiples palabras clave encontradas (${matchCount})`);
    return true;
  }
  
  console.log(`❌ No se detectaron frases de notificación`);
  return false;
}

// Función para actualizar la conversación
async function updateConversation(conversationId, notificationSent) {
  try {
    console.log(`📝 Actualizando conversación ${conversationId}`);
    
    const { data, error } = await supabase
      .from('conversations')
      .update({
        notification_sent: notificationSent,
        notification_timestamp: new Date().toISOString()
      })
      .eq('id', conversationId)
      .select();
    
    if (error) {
      console.error(`❌ Error al actualizar conversación:`, error);
      return false;
    }
    
    console.log(`✅ Conversación actualizada correctamente:`, data);
    return true;
  } catch (error) {
    console.error(`❌ Error general:`, error);
    return false;
  }
}

// Script principal
async function runTest() {
  console.log(`🧪 INICIANDO PRUEBA DE NOTIFICACIÓN`);
  
  // Parámetros de prueba
  const testMessage = "¡Perfecto! tu cita ha sido confirmada para las 3:45.";
  const conversationId = "4a42aa05-2ffd-418b-aa52-29e7c571eee8";
  
  console.log(`\n📝 Mensaje de prueba: "${testMessage}"`);
  console.log(`📝 ID de conversación: ${conversationId}`);
  
  // Comprobar si requiere notificación
  const requiresNotification = checkNotificationPhrases(testMessage);
  console.log(`\n🔔 Requiere notificación: ${requiresNotification ? 'SÍ ✅' : 'NO ❌'}`);
  
  if (requiresNotification) {
    // Actualizar la conversación
    console.log(`\n📤 Enviando actualización a la base de datos...`);
    const updated = await updateConversation(conversationId, true);
    
    console.log(`\n📊 Resultado final: ${updated ? 'ÉXITO ✅' : 'FALLO ❌'}`);
  } else {
    console.log(`\n📊 No se realizaron cambios en la base de datos`);
  }
  
  console.log(`\n🧪 PRUEBA FINALIZADA`);
}

// Ejecutar la prueba
runTest()
  .catch(err => {
    console.error(`❌ ERROR EN PRUEBA:`, err);
  })
  .finally(() => {
    // Salir del proceso cuando termine
    setTimeout(() => process.exit(0), 2000);
  }); 