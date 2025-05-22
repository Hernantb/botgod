/**
 * Helper de Integración para Asistente de OpenAI
 * Permite al Asistente de OpenAI interactuar con funciones externas
 */

const calendarApi = require('./calendar-api');
const axios = require('axios');

/**
 * Procesa las llamadas a funciones del Asistente de OpenAI
 * @param {string} functionName - Nombre de la función a llamar
 * @param {Object} parameters - Parámetros para la función
 * @returns {Promise<Object>} - Resultado de la función
 */
async function processFunctionCall(functionName, parameters) {
  console.log(`🔄 Llamada a función externa: ${functionName}`, parameters);

  try {
    // Validar businessId - asegurar que siempre exista
    if (!parameters.businessId) {
      console.error(`❌ Error: No se proporcionó businessId para la función ${functionName}`);
      return {
        success: false,
        error: `Se requiere un ID de negocio para ejecutar esta operación. Por favor, contacta al soporte.`
      };
    }

    // Funciones de calendario
    if (functionName === 'check_calendar_availability') {
      return await calendarApi.check_calendar_availability(
        parameters.businessId,
        parameters.date
      );
    }
    
    if (functionName === 'create_calendar_event') {
      // Asegurarse que el businessId también se incluya en los detalles del evento
      if (parameters.eventDetails && !parameters.eventDetails.businessId) {
        parameters.eventDetails.businessId = parameters.businessId;
      }
      
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
    
    // Nuevas funciones para el asistente
    if (functionName === 'get_calendar_info') {
      return await calendarApi.get_assistant_calendar_info(
        parameters.businessId,
        parameters.date
      );
    }
    
    if (functionName === 'schedule_appointment') {
      // Asegurarse que el businessId también se incluya en los detalles del evento
      if (parameters.eventDetails && !parameters.eventDetails.businessId) {
        parameters.eventDetails.businessId = parameters.businessId;
      }
      
      return await calendarApi.create_calendar_event(
        parameters.businessId,
        parameters.eventDetails
      );
    }
    
    // Agregar nueva función al procesador
    if (functionName === 'get_relative_dates') {
      try {
        // Llamar al endpoint que creamos
        const response = await axios.get('http://localhost:3095/api/date/relative');
        return response.data;
      } catch (error) {
        console.error('❌ Error obteniendo fechas relativas:', error);
        return {
          success: false,
          error: `Error obteniendo fechas relativas: ${error.message}`
        };
      }
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
      description: "Verifica qué horarios están disponibles en una fecha específica (zona horaria: Ciudad de México)",
      parameters: {
        type: "object",
        properties: {
          businessId: {
            type: "string",
            description: "ID del negocio asociado al calendario (string/UUID)"
          },
          date: {
            type: "string",
            description: "Fecha en formato YYYY-MM-DD (considera que usamos la zona horaria de Ciudad de México)"
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
      description: "Crea un evento (cita) en el calendario del negocio (zona horaria: Ciudad de México)",
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
                description: "Fecha de la cita (YYYY-MM-DD) en zona horaria de Ciudad de México"
              },
              time: {
                type: "string",
                description: "Hora de la cita (HH:MM en formato 24h) en zona horaria de Ciudad de México"
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
            description: "Número de teléfono del cliente (se obtiene automáticamente del remitente, no es necesario solicitarlo)"
          }
        },
        required: ["businessId"]
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
  },
  {
    type: "function",
    function: {
      name: "get_calendar_info",
      description: "Obtiene los horarios de atención, tipos de cita y disponibilidad para una fecha específica (zona horaria: Ciudad de México)",
      parameters: {
        type: "object",
        properties: {
          businessId: {
            type: "string",
            description: "El ID del negocio para obtener la información del calendario"
          },
          date: {
            type: "string",
            description: "La fecha para consultar disponibilidad en formato YYYY-MM-DD (zona horaria de Ciudad de México)",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$"
          }
        },
        required: ["businessId", "date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "schedule_appointment",
      description: "Agenda una nueva cita en el calendario del negocio (zona horaria: Ciudad de México)",
      parameters: {
        type: "object",
        properties: {
          businessId: {
            type: "string",
            description: "El ID del negocio donde se agenda la cita"
          },
          eventDetails: {
            type: "object",
            properties: {
              date: {
                type: "string",
                description: "La fecha de la cita en formato YYYY-MM-DD (zona horaria de Ciudad de México)",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$"
              },
              time: {
                type: "string",
                description: "La hora de la cita en formato HH:MM (24 horas) en zona horaria de Ciudad de México",
                pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
              },
              phone: {
                type: "string",
                description: "El número de teléfono del cliente (se obtiene automáticamente del remitente, no es necesario solicitarlo)"
              },
              name: {
                type: "string",
                description: "Opcional. El nombre del cliente"
              },
              email: {
                type: "string",
                description: "Opcional. El email del cliente"
              },
              title: {
                type: "string",
                description: "Opcional. El título o tipo de la cita"
              },
              description: {
                type: "string",
                description: "Opcional. Descripción o notas adicionales para la cita"
              },
              appointmentTypeId: {
                type: "string",
                description: "Opcional. El ID del tipo de cita si aplica"
              }
            },
            required: ["date", "time"]
          }
        },
        required: ["eventDetails"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_relative_dates",
      description: "Obtiene las fechas relativas (hoy, mañana, etc.) en la zona horaria de Ciudad de México. Usa esta función PRIMERO cuando el usuario mencione fechas relativas como 'mañana' o 'próxima semana' para calcular correctamente las fechas.",
      parameters: {
        type: "object",
        properties: {
          businessId: {
            type: "string",
            description: "ID del negocio (opcional, se incluye automáticamente)"
          }
        },
        required: []
      }
    }
  }
];

// Instrucciones para guiar al asistente en el uso de las funciones
const toolInstructions = `
Para manejar citas y consultar disponibilidad, debes usar las funciones de calendario cuando el usuario pregunte por disponibilidad o quiera agendar, modificar o cancelar una cita.

Instrucciones:
1. PRIMERO, cuando un usuario mencione fechas relativas como "mañana", "pasado mañana", o "la próxima semana", SIEMPRE usa la función get_relative_dates para obtener las fechas correctas en la zona horaria de México.
2. Cuando un usuario pregunte por disponibilidad ("¿qué horarios hay disponibles?", "¿tienen citas para mañana?"), usa get_calendar_info con la fecha correcta obtenida de get_relative_dates.
3. Si el usuario quiere agendar una cita, primero verifica disponibilidad con get_calendar_info y luego usa schedule_appointment.
4. Si el usuario pregunta por sus citas, usa find_customer_appointments.
5. Si el usuario quiere cancelar una cita, usa delete_calendar_event.

Importante:
- NUNCA calcules fechas relativas por tu cuenta. SIEMPRE usa get_relative_dates para obtener la fecha correcta.
- Siempre confirma los detalles antes de agendar (fecha, hora, nombre).
- Usa el formato correcto para fechas (YYYY-MM-DD) y horas (HH:MM).
- NUNCA PIDAS EL TELÉFONO DEL USUARIO. El sistema lo captura automáticamente del mensaje de WhatsApp.
- Para agendar citas, NUNCA preguntes por el número de teléfono, el sistema lo inyecta automáticamente.
- NO inventes horarios disponibles. SIEMPRE consulta primero con get_calendar_info.
- TODAS las fechas y horas se manejan en la zona horaria de Ciudad de México (America/Mexico_City).
- Antes de ofrecer un horario, verifica que sea válido para el día de la semana correcto según la fecha.`;

module.exports = {
  processFunctionCall,
  toolDefinitions,
  toolInstructions
}; 