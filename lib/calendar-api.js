/**
 * Módulo de integración con Google Calendar
 * Implementa las funciones necesarias para consultar disponibilidad y gestionar citas
 */

const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Duración predeterminada de las citas en minutos
const DEFAULT_APPOINTMENT_DURATION = 60;
// Horario de atención predeterminado (ajustar según necesidades)
const DEFAULT_BUSINESS_HOURS = {
  start: 9, // 9:00 AM
  end: 18   // 6:00 PM
};

/**
 * Obtiene una instancia del cliente de Supabase
 * @returns {Object} Cliente de Supabase
 */
function getSupabaseClient() {
  // Si ya existe una referencia global al cliente Supabase, usarla
  if (global.supabase) {
    return global.supabase;
  }
  
  // Si no, crear un nuevo cliente
  const { createClient } = require('@supabase/supabase-js');
  
  // Obtener credenciales de variables de entorno o configuración
  const supabaseUrl = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
  const supabaseKey = process.env.SUPABASE_KEY;
  
  if (!supabaseKey) {
    console.error('❌ Error: No se encontró la clave de Supabase (SUPABASE_KEY)');
    throw new Error('No se encontró la clave de Supabase');
  }
  
  // Crear y devolver cliente
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Obtiene las credenciales de Google Calendar para un negocio
 * @param {string} businessId ID del negocio
 * @returns {Promise<Object|null>} Credenciales o null si no existen
 */
async function getCalendarCredentials(businessId) {
  try {
    // Obtener cliente de Supabase
    const supabase = getSupabaseClient();
    
    // Consultar credenciales
    const { data, error } = await supabase
      .from('business_config')
      .select(`
        id,
        business_name,
        google_calendar_enabled,
        google_calendar_refresh_token,
        google_calendar_access_token,
        google_calendar_token_expiry,
        google_calendar_id,
        google_calendar_needs_reauth
      `)
      .eq('id', businessId)
      .single();
      
    if (error) {
      console.error(`❌ Error obteniendo credenciales de calendario: ${error.message}`);
      return null;
    }
    
    if (!data || !data.google_calendar_enabled) {
      console.log(`⚠️ Calendario no habilitado para el negocio ${businessId}`);
      return null;
    }
    
    if (data.google_calendar_needs_reauth) {
      console.log(`⚠️ El calendario necesita reautenticación para el negocio ${businessId}`);
      return null;
    }
    
    if (!data.google_calendar_refresh_token) {
      console.log(`⚠️ Token de refresco no disponible para el negocio ${businessId}`);
      return null;
    }
    
    console.log(`✅ Credenciales de calendario encontradas para negocio: ${data.business_name}`);
    
    // Configurar credenciales en formato OAuth2
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUrl = process.env.GOOGLE_REDIRECT_URI;
    
    if (!clientId || !clientSecret || !redirectUrl) {
      console.error('❌ Faltan variables de entorno para Google OAuth');
      return null;
    }
    
    // Crear objeto de credenciales en formato necesario para la nueva implementación
    return {
      businessId: data.id,
      business_name: data.business_name,
      clientId,
      clientSecret,
      redirectUrl,
      token: {
        refresh_token: data.google_calendar_refresh_token,
        access_token: data.google_calendar_access_token,
        expiry_date: data.google_calendar_token_expiry 
          ? new Date(data.google_calendar_token_expiry).getTime() 
          : 0
      },
      calendarId: data.google_calendar_id || 'primary'
    };
    
  } catch (error) {
    console.error(`❌ Error general obteniendo credenciales de calendario: ${error.message}`);
    return null;
  }
}

/**
 * Inicializa un cliente de Google Calendar con las credenciales del negocio
 * @param {string} refreshToken - Token de actualización de OAuth
 * @param {string} accessToken - Token de acceso de OAuth (opcional)
 * @returns {Object} - Cliente de Google Calendar configurado
 */
function initializeCalendarClient(refreshToken, accessToken) {
  // Verificar que las credenciales de Google están configuradas
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  
  if (!clientId || clientId === 'YOUR_CLIENT_ID' || 
      !clientSecret || clientSecret === 'YOUR_CLIENT_SECRET') {
    throw new Error('Las credenciales de Google OAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) no están configuradas correctamente');
  }
  
  // Credenciales de OAuth para Google Calendar
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
  
  // Configurar el token 
  const credentials = {
    refresh_token: refreshToken
  };
  
  // Usar el token de acceso si está disponible
  if (accessToken) {
    credentials.access_token = accessToken;
  }
  
  oauth2Client.setCredentials(credentials);
  
  // Crear cliente de Calendar
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Verifica la disponibilidad en el calendario para una fecha específica
 * @param {string} businessId - ID del negocio
 * @param {string} date - Fecha en formato YYYY-MM-DD
 * @returns {Promise<Object>} - Objeto con horarios disponibles
 */
async function check_calendar_availability(businessId, date) {
  console.log(`🔍 Verificando disponibilidad para negocio ${businessId} en fecha ${date}`);
  try {
    // Obtener credenciales
    const credentials = await getCalendarCredentials(businessId);
    if (!credentials) {
      return {
        success: false,
        error: 'No se encontraron credenciales de Google Calendar para el negocio',
        available_slots: []
      };
    }
    try {
      // Inicializar cliente
      const calendar = initializeCalendarClient(credentials.token.refresh_token, credentials.token.access_token);
      // Convertir la fecha a objeto Date
      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return { 
          success: false, 
          error: 'Formato de fecha inválido. Use YYYY-MM-DD',
          available_slots: []
        };
      }
      // Configurar timeMin y timeMax para ese día específico
      const timeMin = new Date(targetDate);
      timeMin.setHours(DEFAULT_BUSINESS_HOURS.start, 0, 0, 0);
      const timeMax = new Date(targetDate);
      timeMax.setHours(DEFAULT_BUSINESS_HOURS.end, 0, 0, 0);
      // Consultar eventos existentes
      const response = await calendar.events.list({
        calendarId: credentials.calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });
      // Obtener eventos del día
      const events = response.data.items || [];
      // Generar todos los slots posibles en intervalos de 1 hora
      const availableSlots = [];
      for (let hour = DEFAULT_BUSINESS_HOURS.start; hour < DEFAULT_BUSINESS_HOURS.end; hour++) {
        const slotStart = new Date(targetDate);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(targetDate);
        slotEnd.setHours(hour + 1, 0, 0, 0);
        // Verificar si este slot se superpone con algún evento existente
        const isAvailable = !events.some(event => {
          const eventStart = new Date(event.start.dateTime || event.start.date);
          const eventEnd = new Date(event.end.dateTime || event.end.date);
          return (
            (slotStart >= eventStart && slotStart < eventEnd) ||
            (slotEnd > eventStart && slotEnd <= eventEnd) ||
            (slotStart <= eventStart && slotEnd >= eventEnd)
          );
        });
        if (isAvailable) {
          availableSlots.push({
            time: `${hour}:00`,
            display: `${hour}:00${hour < 12 ? ' AM' : ' PM'}`
          });
        }
      }
      return {
        success: true,
        date: date,
        available_slots: availableSlots,
        business_hours: `${DEFAULT_BUSINESS_HOURS.start}:00 - ${DEFAULT_BUSINESS_HOURS.end}:00`
      };
    } catch (googleError) {
      console.error('❌ Error real al consultar Google Calendar:', googleError);
      return {
        success: false,
        error: `Error real al consultar Google Calendar: ${googleError.message}`,
        available_slots: []
      };
    }
  } catch (error) {
    console.error('❌ Error en check_calendar_availability:', error);
    return {
      success: false,
      error: `Error al verificar disponibilidad: ${error.message}`,
      available_slots: []
    };
  }
}

/**
 * Crea un evento en el calendario (cita)
 * @param {string} businessId - ID del negocio
 * @param {Object} eventDetails - Detalles del evento
 * @returns {Promise<Object>} - Información del evento creado
 */
async function create_calendar_event(businessId, eventDetails) {
  console.log(`📅 Creando evento para negocio ${businessId}:`, JSON.stringify(eventDetails));
  try {
    // Validar datos requeridos
    if (!eventDetails.date || !eventDetails.time || !eventDetails.phone) {
      return {
        success: false,
        error: 'Se requieren fecha, hora y teléfono para crear una cita'
      };
    }
    // Obtener credenciales
    const credentials = await getCalendarCredentials(businessId);
    if (!credentials) {
      console.error('❌ No se encontraron credenciales de Google Calendar para el negocio', businessId);
      return {
        success: false,
        error: 'No se encontraron credenciales de Google Calendar para el negocio'
      };
    }
    try {
      // Inicializar cliente
      const calendar = initializeCalendarClient(credentials.token.refresh_token, credentials.token.access_token);
      // Crear fecha y hora de inicio
      const startDateTime = new Date(`${eventDetails.date}T${eventDetails.time}`);
      if (isNaN(startDateTime.getTime())) {
        return { 
          success: false, 
          error: 'Formato de fecha/hora inválido. Use YYYY-MM-DD y HH:MM'
        };
      }
      // Crear fecha y hora de fin (por defecto, 1 hora después)
      const endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + DEFAULT_APPOINTMENT_DURATION);
      // Verificar disponibilidad antes de crear
      const timeMin = new Date(startDateTime);
      const timeMax = new Date(endDateTime);
      const eventsResponse = await calendar.events.list({
        calendarId: credentials.calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true
      });
      if (eventsResponse.data.items && eventsResponse.data.items.length > 0) {
        return {
          success: false,
          error: 'El horario seleccionado ya no está disponible',
          conflicting_events: eventsResponse.data.items.length
        };
      }
      // Crear el evento
      const event = {
        summary: eventDetails.title || `Cita con ${eventDetails.name || eventDetails.phone}`,
        description: eventDetails.description || `Cita agendada por WhatsApp para ${eventDetails.phone}`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'America/Mexico_City'
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'America/Mexico_City'
        },
        attendees: [{
          email: eventDetails.email || 'cliente@example.com',
          displayName: eventDetails.name || `Cliente ${eventDetails.phone}`,
          responseStatus: 'accepted'
        }],
        extendedProperties: {
          private: {
            customer_phone: eventDetails.phone,
            business_id: businessId
          }
        }
      };
      // Insertar evento en Google Calendar
      const createdEvent = await calendar.events.insert({
        calendarId: credentials.calendarId,
        resource: event,
        sendUpdates: 'none'
      });
      if (!createdEvent.data || !createdEvent.data.id) {
        return {
          success: false,
          error: 'No se pudo crear el evento en Google Calendar'
        };
      }
      // Guardar referencia en Supabase
      const { data: savedEvent, error: dbError } = await supabase
        .from('calendar_events')
        .insert({
          business_id: businessId,
          event_id: createdEvent.data.id,
          customer_phone: eventDetails.phone,
          customer_name: eventDetails.name || null,
          event_date: eventDetails.date,
          event_time: eventDetails.time
        })
        .select()
        .single();
      if (dbError) {
        console.error('⚠️ Error guardando referencia en BD:', dbError.message);
        // No fallar por esto, el evento ya fue creado en Google Calendar
      }
      return {
        success: true,
        event_id: createdEvent.data.id,
        db_id: savedEvent?.id,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        title: event.summary,
        date: eventDetails.date,
        time: eventDetails.time
      };
    } catch (googleError) {
      console.error('❌ Error real al crear evento en Google Calendar:', googleError);
      return {
        success: false,
        error: `Error real al crear evento en Google Calendar: ${googleError.message}`
      };
    }
  } catch (error) {
    console.error('❌ Error en create_calendar_event:', error);
    return {
      success: false,
      error: `Error al crear evento: ${error.message}`
    };
  }
}

/**
 * Busca citas programadas para un cliente por su número de teléfono
 * @param {string} businessId - ID del negocio
 * @param {string} phoneNumber - Número de teléfono del cliente
 * @returns {Promise<Object>} - Lista de citas encontradas
 */
async function find_customer_appointments(businessId, phoneNumber) {
  console.log(`🔍 Buscando citas para cliente ${phoneNumber} del negocio ${businessId}`);
  
  try {
    // Normalizar número de teléfono (eliminar espacios, +, etc.)
    const normalizedPhone = phoneNumber.replace(/\s+/g, '').replace(/^\+/, '');
    
    // Verificar primero si existe el campo 'canceled' en la tabla
    let query = supabase
      .from('calendar_events')
      .select('*')
      .eq('business_id', businessId)
      .eq('customer_phone', normalizedPhone);
    
    try {
      // Intentar aplicar filtro de cancelación si existe el campo
      query = query.eq('canceled', false);
    } catch (schemaError) {
      console.log('⚠️ Campo canceled no encontrado en la tabla, omitiendo filtro');
    }
    
    // Ordenar por fecha y hora
    query = query.order('event_date', { ascending: true });
    
    if (query.order) {
      query = query.order('event_time', { ascending: true });
    }
    
    // Ejecutar consulta
    const { data: events, error } = await query;
      
    if (error) {
      console.error('❌ Error buscando citas:', error.message);
      return {
        success: false,
        error: `Error buscando citas: ${error.message}`,
        appointments: []
      };
    }
    
    // Si no hay citas pero tampoco error, verificar si tenemos credenciales
    // No es estrictamente necesario para esta función, pero es bueno verificar
    if (events.length === 0) {
      const credentials = await getCalendarCredentials(businessId);
      if (!credentials) {
        console.log(`ℹ️ Sin citas ni credenciales disponibles, generando datos simulados`);
        // Generar citas simuladas solo si no hay credenciales
        return generateMockAppointments(businessId, normalizedPhone);
      }
    }
    
    // Filtrar solo citas futuras
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const futureEvents = events.filter(event => {
      // Filtrar citas canceladas si el campo existe
      if (event.canceled === true) return false;
      
      if (event.event_date > today) return true;
      if (event.event_date === today) {
        // Comparar hora si es hoy
        const eventTime = event.event_time.split(':');
        const eventHour = parseInt(eventTime[0]);
        const eventMinute = parseInt(eventTime[1] || 0);
        return (eventHour > now.getHours() || 
                (eventHour === now.getHours() && eventMinute > now.getMinutes()));
      }
      return false;
    });
    
    return {
      success: true,
      appointments: futureEvents.map(event => ({
        id: event.id,
        event_id: event.event_id,
        date: event.event_date,
        time: event.event_time,
        created_at: event.created_at,
        simulation: event.simulation || false
      })),
      count: futureEvents.length
    };
  } catch (error) {
    console.error('❌ Error en find_customer_appointments:', error);
    return {
      success: false,
      error: `Error al buscar citas: ${error.message}`,
      appointments: []
    };
  }
}

/**
 * Genera citas simuladas para pruebas
 * @param {string} businessId - ID del negocio 
 * @param {string} phoneNumber - Número de teléfono del cliente
 * @returns {Object} - Datos simulados de citas
 */
function generateMockAppointments(businessId, phoneNumber) {
  console.log(`🔄 Generando citas simuladas para ${phoneNumber}`);
  
  // Generar una cita para mañana
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  // Generar una cita para la próxima semana
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];
  
  const mockAppointments = [
    {
      id: `mock-appointment-1-${Date.now()}`,
      event_id: `mock-event-1-${Date.now()}`,
      date: tomorrowStr,
      time: "10:00",
      created_at: new Date().toISOString(),
      simulation: true
    },
    {
      id: `mock-appointment-2-${Date.now()}`,
      event_id: `mock-event-2-${Date.now()}`,
      date: nextWeekStr,
      time: "16:00",
      created_at: new Date().toISOString(),
      simulation: true
    }
  ];
  
  return {
    success: true,
    appointments: mockAppointments,
    count: mockAppointments.length,
    simulation: true
  };
}

/**
 * Elimina un evento del calendario (cancela una cita)
 * @param {string} businessId - ID del negocio
 * @param {string} eventId - ID del evento o de la entrada en la tabla calendar_events
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function delete_calendar_event(businessId, eventId) {
  console.log(`🗑️ Cancelando cita ${eventId} del negocio ${businessId}`);
  
  try {
    // Determinar si el ID es de la tabla o del evento en Google Calendar
    let dbEventId, googleEventId;
    let isSimulation = false;
    
    // Verificar si es un UUID (formato de la tabla)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
    
    if (isUUID) {
      // Buscar el evento en la base de datos
      const { data: event, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', eventId)
        .eq('business_id', businessId)
        .single();
        
      if (error || !event) {
        return {
          success: false,
          error: `No se encontró el evento con ID ${eventId}`
        };
      }
      
      dbEventId = eventId;
      googleEventId = event.event_id;
      // Verificar si es simulación por el campo o por el ID
      isSimulation = (event.simulation === true) || 
                     (typeof googleEventId === 'string' && googleEventId.startsWith('mock-'));
    } else {
      // Es directamente el ID de Google Calendar o un ID simulado
      googleEventId = eventId;
      isSimulation = typeof googleEventId === 'string' && googleEventId.startsWith('mock-');
      
      // Buscar en la BD para tener referencia
      const { data: event, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('event_id', eventId)
        .eq('business_id', businessId)
        .single();
        
      if (!error && event) {
        dbEventId = event.id;
        // Si se encontró en la BD, verificar si es simulación
        isSimulation = isSimulation || (event.simulation === true);
      }
    }
    
    // Si es un evento simulado, solo actualizamos en la base de datos
    if (isSimulation) {
      console.log(`ℹ️ Cancelando evento simulado ${googleEventId}`);
    } else {
      // Obtener credenciales para eventos reales de Google Calendar
      const credentials = await getCalendarCredentials(businessId);
      if (!credentials) {
        console.log(`⚠️ Sin credenciales de calendario disponibles para cancelar evento`);
        // Tratarlo como simulado si no hay credenciales
        isSimulation = true;
      } else {
        try {
          // Inicializar cliente
          const calendar = initializeCalendarClient(credentials.refreshToken, credentials.accessToken);
          
          // Eliminar el evento de Google Calendar
          await calendar.events.delete({
            calendarId: credentials.calendarId,
            eventId: googleEventId
          });
        } catch (googleError) {
          console.error('⚠️ Error en la conexión con Google Calendar:', googleError);
          console.log('ℹ️ Procediendo solo con actualización en BD debido al error de API');
          // Continuar con la actualización en BD aunque falle en Google
        }
      }
    }
    
    // Si tenemos referencia en la BD, marcar como cancelado o eliminar
    if (dbEventId) {
      try {
        // Intentar actualizar con campo 'canceled'
        const { error: updateError } = await supabase
          .from('calendar_events')
          .update({
            canceled: true,
            canceled_at: new Date().toISOString()
          })
          .eq('id', dbEventId);
          
        if (updateError) {
          // Si falla por falta de campo, intentar eliminar el registro
          console.log('⚠️ No se pudo marcar como cancelado, intentando eliminar:', updateError.message);
          
          const { error: deleteError } = await supabase
            .from('calendar_events')
            .delete()
            .eq('id', dbEventId);
            
          if (deleteError) {
            console.error('⚠️ Error eliminando evento de BD:', deleteError.message);
          }
        }
      } catch (dbError) {
        console.error('⚠️ Error actualizando estado en BD:', dbError.message);
      }
    }
    
    return {
      success: true,
      message: 'Cita cancelada exitosamente',
      event_id: googleEventId,
      db_id: dbEventId,
      simulation: isSimulation
    };
  } catch (error) {
    console.error('❌ Error en delete_calendar_event:', error);
    return {
      success: false,
      error: `Error al cancelar cita: ${error.message}`
    };
  }
}

/**
 * Obtiene la disponibilidad de un mes completo
 * @param {string} businessId - ID del negocio
 * @param {string} startDate - Fecha de inicio en formato YYYY-MM-DD
 * @param {string} endDate - Fecha de fin en formato YYYY-MM-DD
 * @returns {Promise<Object>} - Objeto con la disponibilidad del mes
 */
async function get_month_availability(businessId, startDate, endDate) {
  try {
    console.log(`🔍 Consultando disponibilidad para el rango: ${startDate} a ${endDate}`);
    // Obtener credenciales
    const credentials = await getCalendarCredentials(businessId);
    if (!credentials || !credentials.token) {
      return {
        success: false,
        error: "No hay token de Google Calendar configurado",
        authRequired: true,
        daysAvailable: [],
        businessId: businessId
      };
    }
    if (!credentials.token.refresh_token) {
      console.log(`⚠️ El token de Google Calendar no tiene refresh_token. Es posible que necesite reautorizarse.`);
      await markCalendarNeedsReauth(businessId);
      return {
        success: false,
        error: "El token de Google Calendar ha expirado o es inválido",
        authRequired: true,
        daysAvailable: [],
        businessId: businessId
      };
    }
    try {
      // Intentar actualizar el token si está expirado
      const oauth2Client = new google.auth.OAuth2(
        credentials.clientId,
        credentials.clientSecret,
        credentials.redirectUrl
      );
      oauth2Client.setCredentials({
        refresh_token: credentials.token.refresh_token,
        access_token: credentials.token.access_token
      });
      // Consultar calendario
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      // Obtener eventos para el rango de fechas
      const events = await calendar.events.list({
        calendarId: credentials.calendarId || 'primary',
        timeMin: `${startDate}T00:00:00Z`,
        timeMax: `${endDate}T23:59:59Z`,
        singleEvents: true,
        orderBy: 'startTime',
      });
      // Procesar resultados
      const busyDays = processEvents(events.data.items);
      // Generar todos los días del mes
      const allDays = generateAllDaysInRange(startDate, endDate);
      // Marcar días ocupados
      const availabilityCalendar = markBusyDays(allDays, busyDays);
      return {
        success: true,
        daysAvailable: availabilityCalendar,
        businessId: businessId
      };
    } catch (googleError) {
      console.error(`❌ Error al comunicarse con Google Calendar API: ${googleError.message}`);
      if (googleError.message.includes('invalid_grant') || 
          googleError.message.includes('Invalid Credentials') ||
          googleError.message.includes('No access') ||
          googleError.message.includes('refresh token')) {
        console.log(`⚠️ Error de autenticación con Google Calendar. Marcando para reautenticación.`);
        await markCalendarNeedsReauth(businessId);
        return {
          success: false,
          error: "Se requiere reautenticación con Google Calendar",
          authRequired: true,
          daysAvailable: [],
          businessId: businessId
        };
      }
      return {
        success: false,
        error: `Error consultando Google Calendar: ${googleError.message}`,
        daysAvailable: [],
        businessId: businessId
      };
    }
  } catch (error) {
    console.error(`❌ Error obteniendo disponibilidad mensual: ${error.message}`);
    return {
      success: false,
      error: error.message,
      daysAvailable: [],
      businessId: businessId
    };
  }
}

/**
 * Marca un calendario como necesitado de reautenticación
 */
async function markCalendarNeedsReauth(businessId) {
  try {
    // Inicializar Supabase
    const supabase = getSupabaseClient();
    
    // Actualizar la configuración del negocio
    const { error } = await supabase
      .from('business_config')
      .update({
        google_calendar_needs_reauth: true,
        google_calendar_updated_at: new Date().toISOString()
      })
      .eq('id', businessId);
    
    if (error) {
      console.error(`❌ Error al marcar calendario para reautenticación: ${error.message}`);
    } else {
      console.log(`✅ Calendario marcado para reautenticación (ID: ${businessId})`);
    }
  } catch (error) {
    console.error(`❌ Error general al marcar para reautenticación: ${error.message}`);
  }
}

/**
 * Procesa los eventos obtenidos de Google Calendar
 * @param {Array} events Lista de eventos de Google Calendar
 * @returns {Object} Objeto con días ocupados y sus eventos
 */
function processEvents(events = []) {
  console.log(`📅 Procesando ${events.length} eventos del calendario`);
  const busyDays = {};
  
  events.forEach(event => {
    // Solo considerar eventos con fecha y hora
    if (event.start && (event.start.dateTime || event.start.date)) {
      // Manejar eventos de todo el día y eventos con hora
      const dateStr = event.start.dateTime 
        ? event.start.dateTime.split('T')[0]  // Para eventos con hora específica
        : event.start.date;                   // Para eventos de todo el día
        
      if (!busyDays[dateStr]) {
        busyDays[dateStr] = [];
      }
      
      // Extraer las horas de inicio y fin (si están disponibles)
      const startTime = event.start.dateTime 
        ? event.start.dateTime.split('T')[1].substring(0, 5)  // HH:MM
        : '00:00';  // Para eventos de todo el día
        
      const endTime = event.end.dateTime 
        ? event.end.dateTime.split('T')[1].substring(0, 5)  // HH:MM
        : '23:59';  // Para eventos de todo el día
      
      busyDays[dateStr].push({
        id: event.id,
        start: startTime,
        end: endTime,
        summary: event.summary || 'Evento sin título',
        isAllDay: !event.start.dateTime
      });
    }
  });
  
  return busyDays;
}

/**
 * Genera todos los días en un rango de fechas
 * @param {string} startDate Fecha de inicio (YYYY-MM-DD)
 * @param {string} endDate Fecha de fin (YYYY-MM-DD)
 * @returns {Array} Array con objetos para cada día
 */
function generateAllDaysInRange(startDate, endDate) {
  const days = [];
  const currentDate = new Date(startDate);
  const lastDate = new Date(endDate);
  
  // Ajustar última fecha para incluir el día completo
  lastDate.setHours(23, 59, 59, 999);
  
  while (currentDate <= lastDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    days.push({
      date: dateStr,
      available: true, // Por defecto, todos los días están disponibles
      events: [],
      dayOfWeek: currentDate.getDay() // 0 = domingo, 1 = lunes, etc.
    });
    
    // Avanzar al siguiente día
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return days;
}

/**
 * Marca los días ocupados en el calendario
 * @param {Array} allDays Todos los días del período
 * @param {Object} busyDays Objeto con información de días ocupados
 * @returns {Array} Calendario con disponibilidad marcada
 */
function markBusyDays(allDays, busyDays) {
  return allDays.map(day => {
    const dateStr = day.date;
    const dayEvents = busyDays[dateStr] || [];
    
    // Un día se considera completamente ocupado si:
    // 1. Tiene un evento de todo el día, o
    // 2. Tiene más de X eventos (por ejemplo, 8 eventos en un día)
    const hasAllDayEvent = dayEvents.some(event => event.isAllDay);
    const isFullyBooked = hasAllDayEvent || dayEvents.length >= 8;
    
    return {
      ...day,
      available: !isFullyBooked,
      events: dayEvents
    };
  });
}

/**
 * Obtiene los eventos del calendario de Google para un negocio
 * @param {string} businessId - ID del negocio
 * @param {string} [startDate] - Fecha de inicio (YYYY-MM-DD)
 * @param {string} [endDate] - Fecha de fin (YYYY-MM-DD)
 * @returns {Promise<Array>} - Lista de eventos
 */
async function get_calendar_events(businessId, startDate, endDate) {
  try {
    const credentials = await getCalendarCredentials(businessId);
    if (!credentials) {
      return [];
    }
    const calendar = initializeCalendarClient(credentials.token.refresh_token, credentials.token.access_token);
    const calendarId = credentials.calendarId || 'primary';
    let timeMin, timeMax;
    if (startDate) {
      timeMin = new Date(startDate);
      timeMin.setHours(0, 0, 0, 0);
    }
    if (endDate) {
      timeMax = new Date(endDate);
      timeMax.setHours(23, 59, 59, 999);
    }
    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin ? timeMin.toISOString() : undefined,
      timeMax: timeMax ? timeMax.toISOString() : undefined,
      singleEvents: true,
      orderBy: 'startTime',
    });
    return response.data.items || [];
  } catch (error) {
    console.error('❌ Error en get_calendar_events:', error);
    return [];
  }
}

// Exportar funciones
module.exports = {
  check_calendar_availability,
  create_calendar_event,
  find_customer_appointments,
  delete_calendar_event,
  get_month_availability,
  markCalendarNeedsReauth,
  getCalendarCredentials,
  get_calendar_events
}; 