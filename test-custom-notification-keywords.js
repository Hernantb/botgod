// Script para probar notificaciones con palabras clave personalizadas
require('dotenv').config();
console.log('Script iniciado...');
const { processMessageForNotification } = require('./notification-patch.cjs');
console.log('Módulo cargado...');

// ID de negocio de Hernán Tenorio 
const businessId = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

// Palabras clave personalizadas a probar
const customKeywords = [
  // Frases de confirmación
  "tu cita ha sido confirmada",
  "se ha confirmado tu cita",
  "tu reserva está confirmada",
  
  // Frases de contacto
  "un asesor te contactará",
  "un representante se comunicará",
  "nos pondremos en contacto",
  
  // Frases de urgencia
  "necesito hablar con un humano",
  "es urgente",
  "emergencia",
  
  // Frases de conclusión
  "gracias por tu paciencia",
  "ha sido un placer atenderte"
];

// Mensajes de prueba agrupados por categoría
const testGroups = [
  {
    name: "Frases de confirmación",
    messages: [
      "Tu cita ha sido confirmada para mañana a las 3 PM",
      "Se ha confirmado tu cita con el Dr. González",
      "Tu reserva está confirmada para el día 15 de mayo",
      "Reservamos tu cita para el próximo lunes"
    ]
  },
  {
    name: "Frases de contacto",
    messages: [
      "Un asesor te contactará en breve",
      "Un representante se comunicará contigo en 24 horas",
      "Nos pondremos en contacto para finalizar tu pedido",
      "Te llamaremos para confirmar los detalles"
    ]
  },
  {
    name: "Frases de urgencia",
    messages: [
      "Necesito hablar con un humano ahora mismo",
      "Es urgente, necesito ayuda",
      "Tengo una emergencia con mi pedido",
      "No puedo esperar, es importante"
    ]
  },
  {
    name: "Frases de conclusión",
    messages: [
      "Gracias por tu paciencia durante este proceso",
      "Ha sido un placer atenderte hoy",
      "Esperamos haber resuelto tu consulta",
      "Tu satisfacción es nuestra prioridad"
    ]
  }
];

// Función para mostrar el encabezado de configuración
function mostrarConfiguracion() {
  console.log('🧪 PRUEBA DE NOTIFICACIONES CON PALABRAS CLAVE PERSONALIZADAS');
  console.log('======================================================');
  console.log('📝 Palabras clave a probar:');
  customKeywords.forEach((keyword, index) => {
    console.log(`  ${index + 1}. "${keyword}"`);
  });
  console.log('\n🔍 Esta prueba verificará qué mensajes activarían notificaciones si estas palabras');
  console.log('   clave estuvieran configuradas en el sistema.');
  console.log('======================================================\n');
}

// Función para probar cada mensaje contra las palabras clave personalizadas
function verificarCoincidencia(mensaje, palabrasClave) {
  const mensajeLowerCase = mensaje.toLowerCase();
  const coincidencias = [];
  
  for (const palabraClave of palabrasClave) {
    if (mensajeLowerCase.includes(palabraClave.toLowerCase())) {
      coincidencias.push(palabraClave);
    }
  }
  
  return {
    requiereNotificacion: coincidencias.length > 0,
    coincidencias
  };
}

// Función principal para probar mensajes
async function testNotificationsWithCustomKeywords() {
  console.log('Iniciando testNotificationsWithCustomKeywords...');
  mostrarConfiguracion();
  
  // Estadísticas
  const stats = {
    total: 0,
    coincidenciasCustom: 0,
    coincidenciasSistema: 0,
    soloCustom: 0,
    soloSistema: 0,
    ninguna: 0,
    resultadosPorGrupo: {}
  };
  
  // Procesar cada grupo de pruebas
  for (const [groupIndex, group] of testGroups.entries()) {
    console.log(`\n===== GRUPO ${groupIndex + 1}: ${group.name} =====`);
    
    // Inicializar estadísticas para este grupo
    stats.resultadosPorGrupo[group.name] = {
      total: group.messages.length,
      coincidenciasCustom: 0,
      coincidenciasSistema: 0,
      soloCustom: 0,
      soloSistema: 0,
      ninguna: 0
    };
    
    // Procesar cada mensaje en el grupo
    for (const [messageIndex, message] of group.messages.entries()) {
      stats.total++;
      console.log(`\n----- MENSAJE ${groupIndex + 1}.${messageIndex + 1} -----`);
      console.log(`📱 Mensaje: "${message}"`);
      
      // Verificar coincidencias con palabras clave personalizadas
      const resultadoCustom = verificarCoincidencia(message, customKeywords);
      
      // Generar ID de conversación y teléfono para la prueba
      const conversationId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const phoneNumber = `+5215512345${Math.floor(Math.random() * 1000)}`;
      
      try {
        console.log(`Procesando mensaje con sistema actual: "${message}"`);
        // Procesar el mensaje con el sistema actual para comparar
        const resultadoSistema = await processMessageForNotification(
          message,
          conversationId,
          phoneNumber
        );
        
        // Mostrar resultado de coincidencias personalizadas
        if (resultadoCustom.requiereNotificacion) {
          console.log('✅ COINCIDENCIA CON PALABRAS CLAVE PERSONALIZADAS:');
          resultadoCustom.coincidencias.forEach(coincidencia => {
            console.log(`   - "${coincidencia}"`);
          });
          stats.coincidenciasCustom++;
          stats.resultadosPorGrupo[group.name].coincidenciasCustom++;
        } else {
          console.log('❌ NO HAY COINCIDENCIAS CON PALABRAS CLAVE PERSONALIZADAS');
        }
        
        // Mostrar resultado del sistema actual
        if (resultadoSistema.requiresNotification) {
          console.log('✅ DETECTADO POR EL SISTEMA ACTUAL DE NOTIFICACIONES');
          stats.coincidenciasSistema++;
          stats.resultadosPorGrupo[group.name].coincidenciasSistema++;
        } else {
          console.log('❌ NO DETECTADO POR EL SISTEMA ACTUAL DE NOTIFICACIONES');
        }
        
        // Comparar ambos resultados
        if (resultadoCustom.requiereNotificacion && resultadoSistema.requiresNotification) {
          console.log('🟢 COINCIDE EN AMBOS SISTEMAS');
        } else if (resultadoCustom.requiereNotificacion) {
          console.log('🟠 SOLO DETECTADO CON PALABRAS CLAVE PERSONALIZADAS');
          stats.soloCustom++;
          stats.resultadosPorGrupo[group.name].soloCustom++;
        } else if (resultadoSistema.requiresNotification) {
          console.log('🟠 SOLO DETECTADO POR EL SISTEMA ACTUAL');
          stats.soloSistema++;
          stats.resultadosPorGrupo[group.name].soloSistema++;
        } else {
          console.log('🔴 NO DETECTADO POR NINGÚN SISTEMA');
          stats.ninguna++;
          stats.resultadosPorGrupo[group.name].ninguna++;
        }
      } catch (error) {
        console.error(`❌ Error procesando mensaje: ${error.message}`);
      }
      
      // Esperar un segundo entre pruebas
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Mostrar resumen de resultados
  console.log('\n\n📊 RESUMEN DE RESULTADOS');
  console.log('==============================');
  console.log(`Total de mensajes probados: ${stats.total}`);
  console.log(`Detectados con palabras clave personalizadas: ${stats.coincidenciasCustom} (${Math.round(stats.coincidenciasCustom/stats.total*100)}%)`);
  console.log(`Detectados por el sistema actual: ${stats.coincidenciasSistema} (${Math.round(stats.coincidenciasSistema/stats.total*100)}%)`);
  console.log(`Solo detectados con palabras clave personalizadas: ${stats.soloCustom} (${Math.round(stats.soloCustom/stats.total*100)}%)`);
  console.log(`Solo detectados por el sistema actual: ${stats.soloSistema} (${Math.round(stats.soloSistema/stats.total*100)}%)`);
  console.log(`No detectados por ningún sistema: ${stats.ninguna} (${Math.round(stats.ninguna/stats.total*100)}%)`);
  
  console.log('\nResultados por grupo:');
  for (const [groupName, groupStats] of Object.entries(stats.resultadosPorGrupo)) {
    console.log(`\n📝 Grupo: ${groupName}`);
    console.log(`  - Total: ${groupStats.total}`);
    console.log(`  - Detectados con palabras clave personalizadas: ${groupStats.coincidenciasCustom} (${Math.round(groupStats.coincidenciasCustom/groupStats.total*100)}%)`);
    console.log(`  - Detectados por el sistema actual: ${groupStats.coincidenciasSistema} (${Math.round(groupStats.coincidenciasSistema/groupStats.total*100)}%)`);
    console.log(`  - Solo palabras clave personalizadas: ${groupStats.soloCustom} (${Math.round(groupStats.soloCustom/groupStats.total*100)}%)`);
    console.log(`  - Solo sistema actual: ${groupStats.soloSistema} (${Math.round(groupStats.soloSistema/groupStats.total*100)}%)`);
    console.log(`  - Ninguno: ${groupStats.ninguna} (${Math.round(groupStats.ninguna/groupStats.total*100)}%)`);
  }
  
  console.log('\n\n🏁 PRUEBAS FINALIZADAS');
}

console.log('Llamando a testNotificationsWithCustomKeywords...');
// Ejecutar pruebas
testNotificationsWithCustomKeywords()
  .then(() => {
    console.log('✅ Proceso de prueba completado');
  })
  .catch(error => {
    console.error('❌ Error en proceso de prueba:', error);
    console.error(error.stack);
  })
  .finally(() => {
    // Esperar 5 segundos antes de terminar para permitir que los logs se completen
    setTimeout(() => process.exit(0), 5000);
  }); 