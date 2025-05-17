/**
 * Script para probar la detección de frases de notificación
 * Uso: node test-phrase.js "¡Perfecto! Un asesor te llamará a las 2:22."
 */

// Obtener el mensaje de la línea de comandos
const testMessage = process.argv[2] || '¡Perfecto! Un asesor te llamará a las 2:22.';

// Implementar la función directamente (copia de server.js)
function checkForNotificationPhrases(message) {
  console.log(`🔔 ANALIZANDO MENSAJE PARA DETECTAR FRASES DE NOTIFICACIÓN:`);
  console.log(`🔔 Mensaje a analizar: "${message}"`);
  
  // Asegurarse de que el mensaje es una cadena
  if (!message || typeof message !== 'string') {
    console.error(`❌ El mensaje no es válido: ${message}`);
    return false;
  }
  
  // Normalizar mensaje (quitar acentos, convertir a minúsculas)
  const normalizedMessage = message.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  console.log(`🔔 Mensaje normalizado: "${normalizedMessage}"`);
  
  // Lista de frases que requieren notificación
  const notificationPhrases = [
    "perfecto! un asesor te llamara", 
    "¡perfecto! un asesor te llamará",
    "perfecto! un asesor te llamará",
    "perfecto un asesor te",
    "un asesor te llamara",
    "un asesor te llamará",
    "un asesor te llamará a las",
    "te llamara manana",
    "te llamará mañana",
    "asesor te llamara manana",
    "asesor te llamará mañana",
    "perfecto! tu cita ha sido confirmada",
    "¡perfecto! tu cita ha sido confirmada",
    "perfecto tu cita ha sido confirmada",
    "¡perfecto! tu cita ha sido registrada",
    "perfecto! tu cita ha sido registrada",
    "hemos registrado tu cita",
    "tu cita ha sido confirmada para las",
    "tu cita ha sido",
    "se ha creado la cita",
    "asesor te contactara",
    "asesor te contactará"
  ];
  
  // Lista de palabras clave para verificación adicional
  const keyWords = ["cita", "asesor", "llamará", "llamara", "contactará", "confirmada", "registrada", "mañana", "manana", "perfecto"];
  
  // Verificar si el mensaje contiene alguna de las frases de notificación
  for (const phrase of notificationPhrases) {
    if (normalizedMessage.includes(phrase)) {
      console.log(`✅ COINCIDENCIA EXACTA detectada con frase: "${phrase}"`);
      return true;
    }
  }
  
  // Verificar coincidencia parcial (al menos 2 palabras clave)
  let keyWordCount = 0;
  let matchedKeywords = [];
  for (const word of keyWords) {
    if (normalizedMessage.includes(word)) {
      keyWordCount++;
      matchedKeywords.push(word);
      console.log(`🔑 Palabra clave "${word}" encontrada (${keyWordCount} palabras clave hasta ahora)`);
    }
  }
  
  if (keyWordCount >= 2) {
    console.log(`✅ COINCIDENCIA PARCIAL: ${keyWordCount} palabras clave encontradas: ${matchedKeywords.join(', ')}`);
    return true;
  }
  
  // Verificar patrones específicos
  if (
    (normalizedMessage.includes("perfecto") && normalizedMessage.includes("asesor")) ||
    (normalizedMessage.includes("perfecto") && normalizedMessage.includes("cita")) ||
    (normalizedMessage.includes("cita") && normalizedMessage.includes("confirmada")) ||
    (normalizedMessage.includes("cita") && normalizedMessage.includes("registrada")) ||
    (normalizedMessage.includes("asesor") && normalizedMessage.includes("llamara")) ||
    (normalizedMessage.includes("asesor") && normalizedMessage.includes("llamará")) ||
    (normalizedMessage.includes("asesor") && normalizedMessage.includes("manana")) ||
    (normalizedMessage.includes("asesor") && normalizedMessage.includes("mañana"))
  ) {
    console.log(`✅ PATRÓN ESPECÍFICO detectado: combinación de palabras clave`);
    return true;
  }
  
  console.log(`ℹ️ El mensaje no contiene ninguna de las frases que requieren notificación`);
  return false;
}

// Ejecutar la prueba
const result = checkForNotificationPhrases(testMessage);
console.log(`\n📝 RESULTADO FINAL: ${result ? '✅ REQUIERE NOTIFICACIÓN' : '❌ NO requiere notificación'}`);

// Probar diferentes frases
const testPhrases = [
  '¡Perfecto! Un asesor te llamará a las 2:22.',
  'Perfecto! Tu cita ha sido confirmada para mañana a las 3pm.',
  'Un asesor te llamará mañana para confirmar los detalles.',
  'Tu cita ha sido registrada exitosamente.',
  'Hemos registrado tu cita para el día 15 a las 10 am.',
  'Este es un mensaje normal que no debería activar notificación.'
];

console.log('\n\n🧪 PRUEBAS ADICIONALES:');
testPhrases.forEach((phrase, index) => {
  if (phrase !== testMessage) {
    console.log(`\n🔍 Prueba #${index + 1}: "${phrase}"`);
    const requiresNotification = checkForNotificationPhrases(phrase);
    console.log(`📝 Resultado: ${requiresNotification ? '✅ REQUIERE NOTIFICACIÓN' : '❌ NO requiere notificación'}`);
  }
}); 