// Script para probar las notificaciones por palabras clave
require('dotenv').config();
const { processMessageForNotification } = require('./notification-patch.cjs');

// ID de negocio de Hernán Tenorio 
const businessId = '2d385aa5-40e0-4ec9-9360-19281bc605e4';

// Configuración de pruebas - grupos por categoría para facilitar el análisis
const testGroups = [
  {
    name: "Patrones predeterminados",
    messages: [
      "¡Perfecto! tu cita ha sido confirmada para hoy a las 3 para ver el CUPRA León.",
      "¡Perfecto! un asesor te llamará en los próximos 30 minutos",
      "¡Perfecto! un asesor te contactará mañana a las 10 AM",
      "¡Perfecto! una persona te contactará para resolver tu problema"
    ]
  },
  {
    name: "Variaciones de patrones predeterminados",
    messages: [
      "Perfecto tu cita ha sido confirmada",
      "Un asesor te llamará",
      "Un asesor te contactará pronto",
      "Una persona te contactará mañana"
    ]
  },
  {
    name: "Mensajes que no deberían activar notificaciones",
    messages: [
      "Gracias por tu paciencia",
      "Quiero un helado",
      "Mi auto necesita servicio",
      "Me gustaría agendar una cita"
    ]
  },
  {
    name: "Mensajes de urgencia (no configurados por defecto)",
    messages: [
      "Necesito hablar con un representante humano urgentemente",
      "Es una emergencia",
      "Por favor, necesito ayuda ahora mismo",
      "¿Puedo hablar con un humano?"
    ]
  }
];

// Función para probar cada mensaje
async function testNotifications() {
  console.log('🧪 INICIANDO PRUEBA DE NOTIFICACIONES');
  console.log(`🏢 ID de negocio usado para pruebas: ${businessId}`);
  
  // Estadísticas de prueba
  const stats = {
    total: 0,
    requierenNotificacion: 0,
    noRequierenNotificacion: 0,
    errores: 0,
    resultadosPorGrupo: {}
  };
  
  // Procesar cada grupo de pruebas
  for (const [groupIndex, group] of testGroups.entries()) {
    console.log(`\n\n===== GRUPO ${groupIndex + 1}: ${group.name} =====`);
    
    // Inicializar estadísticas para este grupo
    stats.resultadosPorGrupo[group.name] = {
      total: group.messages.length,
      requierenNotificacion: 0,
      noRequierenNotificacion: 0,
      errores: 0
    };
    
    // Procesar cada mensaje en el grupo
    for (const [messageIndex, message] of group.messages.entries()) {
      stats.total++;
      console.log(`\n----- MENSAJE ${groupIndex + 1}.${messageIndex + 1} -----`);
      console.log(`📱 Mensaje: "${message}"`);
      
      // Generar un ID de conversación aleatorio para la prueba
      const conversationId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const phoneNumber = `+5215512345${Math.floor(Math.random() * 1000)}`;
      
      try {
        console.log(`🔍 Procesando mensaje con ID de conversación: ${conversationId}`);
        
        // Procesar el mensaje para ver si genera notificación
        const result = await processMessageForNotification(
          message,
          conversationId,
          phoneNumber
        );
        
        console.log(`✅ RESULTADO: ${result.requiresNotification ? 'NOTIFICACIÓN REQUERIDA' : 'NO REQUIERE NOTIFICACIÓN'}`);
        
        if (result.requiresNotification) {
          stats.requierenNotificacion++;
          stats.resultadosPorGrupo[group.name].requierenNotificacion++;
          console.log('🔔 NOTIFICACIÓN REQUERIDA');
          
          if (result.notificationSent) {
            console.log('📧 CORREO ENVIADO EXITOSAMENTE');
          } else {
            console.log('❌ FALLO AL ENVIAR CORREO: ' + (result.error || 'Error desconocido'));
          }
        } else {
          stats.noRequierenNotificacion++;
          stats.resultadosPorGrupo[group.name].noRequierenNotificacion++;
          console.log('❌ NO SE REQUIERE NOTIFICACIÓN PARA ESTE MENSAJE');
        }
      } catch (error) {
        console.error('❌ Error durante la prueba:', error);
        stats.errores++;
        stats.resultadosPorGrupo[group.name].errores++;
      }
      
      // Esperar un segundo entre pruebas
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Mostrar resumen de resultados
  console.log('\n\n📊 RESUMEN DE RESULTADOS DE PRUEBAS');
  console.log('==============================');
  console.log(`Total de mensajes probados: ${stats.total}`);
  console.log(`Mensajes que requieren notificación: ${stats.requierenNotificacion} (${Math.round(stats.requierenNotificacion/stats.total*100)}%)`);
  console.log(`Mensajes que NO requieren notificación: ${stats.noRequierenNotificacion} (${Math.round(stats.noRequierenNotificacion/stats.total*100)}%)`);
  console.log(`Errores durante las pruebas: ${stats.errores}`);
  
  console.log('\nResultados por grupo:');
  for (const [groupName, groupStats] of Object.entries(stats.resultadosPorGrupo)) {
    console.log(`\n📝 Grupo: ${groupName}`);
    console.log(`  - Total: ${groupStats.total}`);
    console.log(`  - Requieren notificación: ${groupStats.requierenNotificacion} (${Math.round(groupStats.requierenNotificacion/groupStats.total*100)}%)`);
    console.log(`  - NO requieren notificación: ${groupStats.noRequierenNotificacion} (${Math.round(groupStats.noRequierenNotificacion/groupStats.total*100)}%)`);
    console.log(`  - Errores: ${groupStats.errores}`);
  }
  
  console.log('\n\n🏁 PRUEBAS FINALIZADAS');
}

// Ejecutar pruebas
testNotifications()
  .then(() => {
    console.log('✅ Proceso de prueba completado');
  })
  .catch(error => {
    console.error('❌ Error en proceso de prueba:', error);
  })
  .finally(() => {
    // Esperar 5 segundos antes de terminar para permitir que los logs se completen
    setTimeout(() => process.exit(0), 5000);
  }); 