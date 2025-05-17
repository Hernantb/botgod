/**
 * Helper de Integración para Asistente de OpenAI
 * Permite al Asistente de OpenAI interactuar con funciones externas
 */

const calendarApi = require('./calendar-api');

/**
 * Procesa las llamadas a funciones del Asistente de OpenAI
 * @param {string} functionName - Nombre de la función a llamar
 * @param {Object} parameters - Parámetros para la función
 * @returns {Promise<Object>} - Resultado de la función
 */
async function processFunctionCall(functionName, parameters) {
  console.log(`🔄 Llamada a función externa: ${functionName}`, parameters);

  try {
    // Funciones de calendario
    if (functionName === 'check_calendar_availability') {
      return await calendarApi.check_calendar_availability(
        parameters.businessId,
        parameters.date
      );
    }
    
    if (functionName === 'create_calendar_event') {
      return await calendarApi.create_calendar_event(
        parameters.businessId,
        parameters.eventDetails
      );
    }
    
    if (functionName === 'find_customer_appointments') {
      return await calendarApi.find_customer_appointments(
        parameters.businessId,
        parameters.phoneNumber
      );
    }
    
    if (functionName === 'delete_calendar_event') {
      return await calendarApi.delete_calendar_event(
        parameters.businessId,
        parameters.eventId
      );
    }
    
    // Función no encontrada
    return {
      success: false,
      error: `Función no implementada: ${functionName}`
    };
  } catch (error) {
    console.error(`❌ Error procesando función ${functionName}:`, error);
    return {
      success: false,
      error: `Error ejecutando ${functionName}: ${error.message}`
    };
  }
}

// Definiciones de las funciones disponibles para OpenAI
const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "check_calendar_availability",
      description: "Verifica qué horarios están disponibles en una fecha específica",
      parameters: {
        type: "object",
        properties: {
          businessId: {
            type: "string",
            description: "ID del negocio asociado al calendario (string/UUID)"
          },
          date: {
            type: "string",
            description: "Fecha en formato YYYY-MM-DD"
          }
        },
        required: ["businessId", "date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Crea un evento (cita) en el calendario del negocio",
      parameters: {
        type: "object",
        properties: {
          businessId: {
            type: "string",
            description: "ID del negocio (string/UUID)"
          },
          eventDetails: {
            type: "object",
            properties: {
              date: {
                type: "string",
                description: "Fecha de la cita (YYYY-MM-DD)"
              },
              time: {
                type: "string",
                description: "Hora de la cita (HH:MM o simplemente la hora)"
              },
              phone: {
                type: "string",
                description: "Teléfono del cliente"
              },
              name: {
                type: "string",
                description: "Nombre del cliente (opcional)"
              },
              email: {
                type: "string",
                description: "Email del cliente (opcional)"
              },
              title: {
                type: "string",
                description: "Título de la cita (opcional)"
              },
              description: {
                type: "string",
                description: "Descripción adicional (opcional)"
              },
              location: {
                type: "string",
                description: "Ubicación de la cita (opcional)"
              }
            },
            required: ["date", "time", "phone"]
          }
        },
        required: ["businessId", "eventDetails"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "find_customer_appointments",
      description: "Busca todas las citas programadas para un cliente por su número de teléfono",
      parameters: {
        type: "object",
        properties: {
          businessId: {
            type: "string",
            description: "ID del negocio (string/UUID)"
          },
          phoneNumber: {
            type: "string",
            description: "Número de teléfono del cliente (string)"
          }
        },
        required: ["businessId", "phoneNumber"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_calendar_event",
      description: "Elimina un evento del calendario (cancela una cita)",
      parameters: {
        type: "object",
        properties: {
          businessId: {
            type: "string",
            description: "ID del negocio (string/UUID)"
          },
          eventId: {
            type: "string",
            description: "ID del evento a eliminar (string)"
          }
        },
        required: ["businessId", "eventId"]
      }
    }
  }
];

// Instrucciones para guiar al asistente en el uso de las funciones
const toolInstructions = `
Para manejar citas y consultar disponibilidad, debes usar las funciones de calendario cuando el usuario pregunte por disponibilidad o quiera agendar, modificar o cancelar una cita.

Instrucciones:
1. Cuando un usuario pregunte por disponibilidad ("¿qué horarios hay disponibles?", "¿tienen citas para mañana?"), usa check_calendar_availability con la fecha mencionada.
2. Si el usuario quiere agendar una cita, primero verifica disponibilidad con check_calendar_availability y luego usa create_calendar_event.
3. Si el usuario pregunta por sus citas, usa find_customer_appointments.
4. Si el usuario quiere cancelar una cita, usa delete_calendar_event.

Importante:
- Siempre confirma los detalles antes de agendar (fecha, hora, nombre).
- Usa el formato correcto para fechas (YYYY-MM-DD) y horas (HH:MM).
- Para agendar citas, SIEMPRE usa el número de teléfono del usuario que está haciendo la consulta.
- NO inventes horarios disponibles. SIEMPRE consulta primero con check_calendar_availability.
`;

module.exports = {
  processFunctionCall,
  toolDefinitions,
  toolInstructions
}; 