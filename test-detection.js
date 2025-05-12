/**
 * Script para probar solo la función de detección de notificaciones
 */

// Importar la función directamente
const { checkForNotificationPhrases } = require('./whatsapp-bot-main/manual-endpoint');

// Casos de prueba para verificar la detección de frases de notificación
const testCases = [
  {
    input: "Necesito una cita urgente para mañana",
    expected: true,
    reason: "Contiene palabra clave 'cita' y 'urgente'"
  },
  {
    input: "¿Podrían agendar una cita para el próximo martes?",
    expected: true,
    reason: "Contiene palabra clave 'cita' y 'agendar'"
  },
  {
    input: "Quiero información sobre sus servicios",
    expected: false,
    reason: "No contiene palabras clave de notificación"
  },
  {
    input: "URGENTE: necesito hablar con alguien ahora mismo",
    expected: true,
    reason: "Contiene palabra clave 'URGENTE'"
  },
  {
    input: "agenda por favor una reunión",
    expected: true,
    reason: "Contiene palabra clave 'agenda'"
  },
  {
    input: "Solo quería saludar, gracias",
    expected: false,
    reason: "No contiene palabras clave de notificación"
  },
  {
    input: "Necesito RESERVAR un espacio para consulta",
    expected: true,
    reason: "Contiene palabra clave 'RESERVAR'"
  }
];

// Función para ejecutar todas las pruebas
function testAll() {
  console.log("Iniciando pruebas de detección de frases para notificación...\n");
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((test, index) => {
    const result = checkForNotificationPhrases(test.input);
    const success = result === test.expected;
    
    console.log(`Test #${index + 1}: ${success ? 'PASÓ ✅' : 'FALLÓ ❌'}`);
    console.log(`Mensaje: "${test.input}"`);
    console.log(`Resultado obtenido: ${result}, Esperado: ${test.expected}`);
    console.log(`Razón: ${test.reason}`);
    
    if (!success) {
      console.log(`ERROR: La función ${result ? 'detectó' : 'no detectó'} una frase de notificación cuando ${test.expected ? 'debería' : 'no debería'}`);
      failed++;
    } else {
      passed++;
    }
    
    console.log("----------------------------");
  });
  
  console.log(`\nResumen: ${passed} pruebas pasaron, ${failed} fallaron de un total de ${testCases.length}`);
  
  if (failed === 0) {
    console.log("¡Todas las pruebas pasaron correctamente! 🎉");
  } else {
    console.log("Hay pruebas fallidas que requieren revisión. ⚠️");
  }
}

// Ejecutar las pruebas
testAll(); 