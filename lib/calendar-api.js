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
    
    // Obtener horarios específicos del negocio
    const businessHoursResult = await get_business_hours(businessId);
    if (!businessHoursResult.success) {
      return {
        success: false,
        error: 'No se pudo obtener la configuración de horarios del negocio',
        available_slots: []
      };
    }
    
    try {
      // Inicializar cliente
      const calendar = initializeCalendarClient(credentials.token.refresh_token, credentials.token.access_token);
      
      // Convertir la fecha a objeto Date con timezone México
      const targetDate = new Date(`${date}T00:00:00`);
      if (isNaN(targetDate.getTime())) {
        return { 
          success: false, 
          error: 'Formato de fecha inválido. Use YYYY-MM-DD',
          available_slots: []
        };
      }
      
      // Asegurar que estamos trabajando con la zona horaria de México
      const targetDateMexico = new Date(targetDate.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
      
      // Obtener el día de la semana (0 = Domingo, 1 = Lunes, etc.) en zona horaria de México
      const dayOfWeek = targetDateMexico.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];
      
      // Log para depuración
      console.log(`📅 Fecha solicitada: ${date}, día de la semana: ${dayName} (${dayOfWeek})`);
      
      // Obtener horarios de atención para ese día de la semana
      const businessHours = businessHoursResult.data.hours || {};
      const dayHours = businessHours[dayName] || [];
      
      // Si no hay horarios configurados para ese día, el negocio está cerrado
      if (!dayHours.length) {
        return {
          success: true,
          date: date,
          available_slots: [],
          message: 'El negocio está cerrado en esta fecha',
          business_hours: 'Cerrado',
          day_of_week: dayName
        };
      }
      
      // Procesar rangos de horarios para ese día
      const availableRanges = [];
      for (const range of dayHours) {
        if (range.start && range.end) {
          const [startHour, startMinute] = range.start.split(':').map(Number);
          const [endHour, endMinute] = range.end.split(':').map(Number);
          
          availableRanges.push({
            startHour,
            startMinute: startMinute || 0,
            endHour,
            endMinute: endMinute || 0
          });
        }
      }
      
      if (availableRanges.length === 0) {
        return {
          success: true,
          date: date,
          available_slots: [],
          message: 'No hay horarios configurados para este día',
          business_hours: 'No configurado',
          day_of_week: dayName
        };
      }
      
      // Configurar timeMin y timeMax para ese día específico en zona horaria de México
      const timeMin = new Date(`${date}T00:00:00`);
      timeMin.setHours(0, 0, 0, 0); // Desde las 00:00 del día
      
      const timeMax = new Date(`${date}T23:59:59`);
      timeMax.setHours(23, 59, 59, 999); // Hasta las 23:59 del día
      
      // Consultar eventos existentes
      const response = await calendar.events.list({
        calendarId: credentials.calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: 'America/Mexico_City',
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      // Obtener eventos del día
      const events = response.data.items || [];
      console.log(`Eventos encontrados para ${date} (zona horaria México): ${events.length}`);
      
      // Configurar si se permiten empalmes de citas
      const allowOverlapping = businessHoursResult.data.allow_overlapping || businessHoursResult.data.allowOverlapping || false;
      const maxOverlapping = businessHoursResult.data.max_overlapping || businessHoursResult.data.maxOverlapping || 1;
      
      // Generar slots disponibles basados en los rangos horarios del negocio
      const availableSlots = [];
      
      // Mapa para contar cuántas citas hay en cada hora
      const hourlyBookingCount = {};
      
      // Inicializar contador para cada hora posible
      for (let h = 0; h < 24; h++) {
        hourlyBookingCount[`${h}:00`] = 0;
      }
      
      // Contar reservaciones existentes por hora
      events.forEach(event => {
        if (event.start && event.start.dateTime) {
          // Convertir hora del evento a hora de México
          const eventStartUTC = new Date(event.start.dateTime);
          const eventStartMexico = new Date(eventStartUTC.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
          const hour = eventStartMexico.getHours();
          const timeKey = `${hour}:00`;
          
          // Incrementar contador para esta hora
          hourlyBookingCount[timeKey] = (hourlyBookingCount[timeKey] || 0) + 1;
          console.log(`Reservación existente a las ${timeKey} (${hourlyBookingCount[timeKey]} citas en este horario)`);
        }
      });
      
      // Para cada rango disponible, generar slots de una hora
      for (const range of availableRanges) {
        // Convertir a minutos totales para facilitar comparaciones
        const startMinutes = range.startHour * 60 + range.startMinute;
        const endMinutes = range.endHour * 60 + range.endMinute;
        
        // Generar slots de hora en hora, considerando que el último slot debe empezar al menos una hora antes del cierre
        for (let minutesFromMidnight = startMinutes; minutesFromMidnight < endMinutes - 59; minutesFromMidnight += 60) {
          const hour = Math.floor(minutesFromMidnight / 60);
          const timeKey = `${hour}:00`;
          
          // Verificar si este slot no excede el límite de citas superpuestas
          const currentBookings = hourlyBookingCount[timeKey] || 0;
          
          // Solo añadir el slot si está dentro del límite o si se permiten empalmes
          if ((allowOverlapping && currentBookings < maxOverlapping) || (!allowOverlapping && currentBookings === 0)) {
            // Formatear hora en 12h AM/PM
            const hour12 = hour % 12 || 12;
            const ampm = hour < 12 ? 'AM' : 'PM';
            
            availableSlots.push({
              time: timeKey,
              display: `${hour12}:00 ${ampm}`
            });
          }
        }
      }
      
      // Construir string de horario de atención legible
      let businessHoursText = '';
      if (dayHours.length > 0) {
        businessHoursText = dayHours.map(range => 
          `${range.start} - ${range.end}`
        ).join(', ');
      } else {
        businessHoursText = 'Cerrado';
      }
      
      return {
        success: true,
        date: date,
        available_slots: availableSlots,
        business_hours: businessHoursText,
        allow_overlapping: allowOverlapping,
        max_overlapping: maxOverlapping,
        day_of_week: dayName,
        timezone: 'America/Mexico_City'
      };
    } catch (googleError) {
      console.error('❌ Error al consultar Google Calendar:', googleError);
      return {
        success: false,
        error: `Error al consultar Google Calendar: ${googleError.message}`,
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

    // Validar businessId
    if (!businessId) {
      console.error('❌ Error: Se intentó crear una cita sin especificar el ID del negocio');
      return {
        success: false,
        error: 'Se requiere ID de negocio para crear una cita'
      };
    }

    // Obtener configuración de horarios y empalmes
    const businessHoursResult = await get_business_hours(businessId);
    if (!businessHoursResult.success) {
      return { success: false, error: 'No se pudo obtener la configuración de horarios del negocio' };
    }

    const { hours, allowOverlapping, allow_overlapping, maxOverlapping, max_overlapping } = businessHoursResult.data;
    const allowEmpalme = allowOverlapping ?? allow_overlapping ?? false;
    const maxEmpalme = Number(maxOverlapping ?? max_overlapping ?? 1);

    // Validar horario de atención
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    
    // Crear fecha con zona horaria de México
    const appointmentDate = new Date(`${eventDetails.date}T00:00:00`);
    const appointmentDateMexico = new Date(appointmentDate.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
    const dayKey = dayNames[appointmentDateMexico.getDay()];
    
    console.log(`📅 Validando día de semana para cita: ${eventDetails.date} corresponde a ${dayKey} en zona México`);
    
    const dayHours = hours && hours[dayKey];

    if (!dayHours || !Array.isArray(dayHours) || dayHours.length === 0) {
      return { success: false, error: 'El negocio no atiende en ese día' };
    }

    // Validar si la hora está dentro de algún rango permitido
    const [hour, minute] = eventDetails.time.split(':').map(Number);
    const isInSchedule = dayHours.some(rango => {
      if (!rango.start || !rango.end) return false;
      const [startHour, startMinute] = rango.start.split(':').map(Number);
      const [endHour, endMinute] = rango.end.split(':').map(Number);
      const start = startHour * 60 + (startMinute || 0);
      const end = endHour * 60 + (endMinute || 0);
      const current = hour * 60 + (minute || 0);
      return current >= start && current < end;
    });

    if (!isInSchedule) {
      return { success: false, error: 'El horario seleccionado está fuera del horario de atención del negocio' };
    }

    // Obtener duración del tipo de cita
    let appointmentDuration = DEFAULT_APPOINTMENT_DURATION;
    let appointmentType = null;
    
    // Si se proporcionó un appointmentTypeId, buscar ese tipo específico
    if (eventDetails.appointmentTypeId) {
      console.log(`🔍 Buscando tipo de cita específico: ${eventDetails.appointmentTypeId}`);
      const { data: appointmentTypeData } = await supabase
        .from('appointment_types')
        .select('id, name, duration')
        .eq('id', eventDetails.appointmentTypeId)
        .eq('business_id', businessId)
        .single();

      if (appointmentTypeData) {
        console.log(`✅ Tipo de cita encontrado: ${appointmentTypeData.name} (${appointmentTypeData.duration} minutos)`);
        appointmentDuration = appointmentTypeData.duration;
        appointmentType = appointmentTypeData;
      } else {
        console.warn(`⚠️ Tipo de cita ${eventDetails.appointmentTypeId} no encontrado para negocio ${businessId}`);
      }
    } 
    // Si se proporcionó un título/nombre de cita, intentar buscar por nombre
    else if (eventDetails.title) {
      console.log(`🔍 Buscando tipo de cita por nombre: "${eventDetails.title}"`);
      const { data: appointmentTypes } = await supabase
        .from('appointment_types')
        .select('id, name, duration')
        .eq('business_id', businessId)
        .order('created_at', { ascending: true });
        
      if (appointmentTypes && appointmentTypes.length > 0) {
        // Buscar una coincidencia aproximada por nombre
        const matchedType = appointmentTypes.find(type => 
          type.name.toLowerCase().includes(eventDetails.title.toLowerCase()) ||
          eventDetails.title.toLowerCase().includes(type.name.toLowerCase())
        );
        
        if (matchedType) {
          console.log(`✅ Tipo de cita encontrado por nombre: ${matchedType.name} (${matchedType.duration} minutos)`);
          appointmentDuration = matchedType.duration;
          appointmentType = matchedType;
          // Asignar el ID para guardar en BD
          eventDetails.appointmentTypeId = matchedType.id;
        } else {
          console.log(`⚠️ No se encontró coincidencia para "${eventDetails.title}" entre los tipos disponibles`);
        }
      }
    }
    
    // Si aún no tenemos un tipo de cita, verificar si hay tipos predeterminados
    if (!appointmentType) {
      console.log(`🔍 Verificando tipos de cita predeterminados para negocio ${businessId}`);
      const { data: defaultTypes } = await supabase
        .from('appointment_types')
        .select('id, name, duration')
        .eq('business_id', businessId)
        .order('created_at', { ascending: true })
        .limit(1);
        
      if (defaultTypes && defaultTypes.length > 0) {
        console.log(`✅ Usando tipo de cita predeterminado: ${defaultTypes[0].name} (${defaultTypes[0].duration} minutos)`);
        appointmentDuration = defaultTypes[0].duration;
        appointmentType = defaultTypes[0];
        eventDetails.appointmentTypeId = defaultTypes[0].id;
      } else {
        console.log(`ℹ️ No hay tipos de cita configurados, usando duración predeterminada: ${DEFAULT_APPOINTMENT_DURATION} minutos`);
      }
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

      // Crear fecha y hora de inicio en zona horaria de México
      // Garantizar que la fecha y hora de inicio estén configuradas para la zona horaria de México
      // Usar formato ISO con T como separador para garantizar interpretación correcta
      const startDateTimeStr = `${eventDetails.date}T${eventDetails.time}:00`;
      console.log(`📅 Fecha y hora original para cita: ${startDateTimeStr}`);
      
      // Crear el objeto Date explícitamente para la zona horaria de México
      const startDateTime = new Date(startDateTimeStr);
      
      if (isNaN(startDateTime.getTime())) {
        return { 
          success: false, 
          error: 'Formato de fecha/hora inválido. Use YYYY-MM-DD y HH:MM'
        };
      }
      
      // Log para depuración
      console.log(`📅 Hora de inicio calculada (UTC): ${startDateTime.toISOString()}`);

      // Crear fecha y hora de fin basada en la duración del tipo de cita
      const endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + appointmentDuration);
      console.log(`📅 Hora de fin calculada (UTC): ${endDateTime.toISOString()}`);

      // Verificar empalmes: contar cuántas citas existen en ese horario
      const timeMin = new Date(startDateTime);
      const timeMax = new Date(endDateTime);

      const eventsResponse = await calendar.events.list({
        calendarId: credentials.calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: 'America/Mexico_City',
        singleEvents: true
      });

      const overlappingCount = eventsResponse.data.items ? eventsResponse.data.items.length : 0;

      if (!allowEmpalme && overlappingCount > 0) {
        return {
          success: false,
          error: 'El horario seleccionado ya no está disponible'
        };
      }

      if (allowEmpalme && overlappingCount >= maxEmpalme) {
        return {
          success: false,
          error: `El máximo de empalmes permitidos (${maxEmpalme}) ya fue alcanzado para este horario.`
        };
      }

      // Determinar el título del evento
      let eventTitle = '';
      if (eventDetails.title) {
        eventTitle = eventDetails.title;
      } else if (appointmentType) {
        eventTitle = `Cita: ${appointmentType.name}`;
      } else {
        eventTitle = `Cita con ${eventDetails.name || eventDetails.phone}`;
      }

      // Crear el evento
      const event = {
        summary: eventTitle,
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
            business_id: businessId,
            appointment_type_id: eventDetails.appointmentTypeId || null,
            duration: appointmentDuration
          }
        }
      };

      // Insertar evento en Google Calendar
      const createdEvent = await calendar.events.insert({
        calendarId: credentials.calendarId,
        resource: event,
        sendUpdates: 'none',
        timeZone: 'America/Mexico_City'
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
          event_time: eventDetails.time,
          appointment_type_id: eventDetails.appointmentTypeId || null,
          duration: appointmentDuration
        })
        .select()
        .single();

      if (dbError) {
        console.error('⚠️ Error guardando referencia en BD:', dbError.message);
        // No fallar por esto, el evento ya fue creado en Google Calendar
      }

      // Construir respuesta
      const response = {
        success: true,
        event_id: createdEvent.data.id,
        db_id: savedEvent?.id,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        title: event.summary,
        date: eventDetails.date,
        time: eventDetails.time,
        duration: appointmentDuration,
        timezone: 'America/Mexico_City'
      };

      // Si hay un tipo de cita, incluirlo en la respuesta
      if (appointmentType) {
        response.appointment_type = {
          id: appointmentType.id,
          name: appointmentType.name,
          duration: appointmentType.duration
        };
      }

      return response;
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
    let dbEventId, googleEventId;
    let isSimulation = false;
    // Buscar el evento en la base de datos por UUID o event_id
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
    let event;
    if (isUUID) {
      const res = await supabase.from('calendar_events').select('*').eq('id', eventId).eq('business_id', businessId).single();
      event = res.data;
      if (!event) return { success: false, error: `No se encontró el evento con ID ${eventId}` };
      dbEventId = eventId;
      googleEventId = event.event_id;
      isSimulation = event.simulation === true || (typeof googleEventId === 'string' && googleEventId.startsWith('mock-'));
    } else {
      googleEventId = eventId;
      const res = await supabase.from('calendar_events').select('*').eq('event_id', eventId).eq('business_id', businessId).single();
      event = res.data;
      if (event) dbEventId = event.id;
      isSimulation = event?.simulation === true || (typeof googleEventId === 'string' && googleEventId.startsWith('mock-'));
    }
    // Si es un evento simulado, solo actualizamos en la base de datos
    if (isSimulation) {
      // ... (igual que antes)
    } else {
      // Obtener credenciales para eventos reales de Google Calendar
      const credentials = await getCalendarCredentials(businessId);
      if (!credentials) {
        return { success: false, error: "No hay credenciales de Google Calendar para este negocio" };
      }
      try {
        // Inicializar cliente
        const calendar = initializeCalendarClient(credentials.token.refresh_token, credentials.token.access_token);
        // Eliminar el evento de Google Calendar
        await calendar.events.delete({
          calendarId: credentials.calendarId,
          eventId: googleEventId
        });
      } catch (googleError) {
        // DEVOLVER ERROR y NO marcar como cancelado en BD
        console.error('❌ Error real al borrar en Google Calendar:', googleError);
        return { success: false, error: `Error al borrar en Google Calendar: ${googleError.message}` };
      }
    }
    // Si tenemos referencia en la BD, marcar como cancelado o eliminar
    if (dbEventId) {
      try {
        const { error: updateError } = await supabase
          .from('calendar_events')
          .update({
            canceled: true,
            canceled_at: new Date().toISOString()
          })
          .eq('id', dbEventId);
        if (updateError) {
          // Si falla por falta de campo, intentar eliminar el registro
          await supabase.from('calendar_events').delete().eq('id', dbEventId);
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

/**
 * Guarda los horarios de atención y la configuración de empalme de citas para un negocio
 * @param {string} businessId - ID del negocio
 * @param {object} hours - Horarios de atención (por día)
 * @param {boolean} allowOverlapping - Si se permite empalmar citas
 * @param {number} maxOverlapping - Máximo de citas empalmadas permitidas
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function save_business_hours(businessId, hours, allowOverlapping = false, maxOverlapping = 1) {
  try {
    console.log('📝 [save_business_hours] Payload recibido:', { businessId, hours, allowOverlapping, maxOverlapping });
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('business_hours')
      .upsert({
        business_id: businessId,
        hours: hours,
        allow_overlapping: allowOverlapping,
        max_overlapping: allowOverlapping ? maxOverlapping : 1,
        updated_at: new Date().toISOString()
      }, { onConflict: ['business_id'] })
      .select()
      .single();
    if (error) {
      console.error('❌ [save_business_hours] Error al guardar en Supabase:', error.message);
      return { success: false, error: error.message };
    }
    console.log('✅ [save_business_hours] Guardado exitoso en Supabase:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error en save_business_hours:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene los horarios de atención y la configuración de empalme de citas para un negocio
 * @param {string} businessId - ID del negocio
 * @returns {Promise<Object>} - Resultado de la consulta
 */
async function get_business_hours(businessId) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('business_hours')
      .select('*')
      .eq('business_id', businessId)
      .single();
    if (error && error.code !== 'PGRST116') {
      return { success: false, error: error.message };
    }
    if (!data) {
      return { success: false, error: 'No hay horarios configurados para este negocio' };
    }
    // Adaptar claves a camelCase para el frontend
    return {
      success: true,
      data: {
        ...data,
        allowOverlapping: data.allow_overlapping,
        maxOverlapping: data.max_overlapping
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Crea o actualiza un tipo de cita para un negocio
 * @param {string} businessId
 * @param {string} typeId (opcional, para editar)
 * @param {string} name
 * @param {number} duration (minutos)
 */
async function save_appointment_type(businessId, typeId, name, duration) {
  try {
    const supabase = getSupabaseClient();
    let data, error;
    if (typeId) {
      // Actualizar
      ({ data, error } = await supabase
        .from('appointment_types')
        .update({ name, duration, updated_at: new Date().toISOString() })
        .eq('id', typeId)
        .eq('business_id', businessId)
        .select()
        .single());
    } else {
      // Crear
      ({ data, error } = await supabase
        .from('appointment_types')
        .insert({ business_id: businessId, name, duration, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .select()
        .single());
    }
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene los tipos de cita de un negocio
 */
async function get_appointment_types(businessId) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('appointment_types')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Elimina un tipo de cita
 */
async function delete_appointment_type(businessId, typeId) {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('appointment_types')
      .delete()
      .eq('id', typeId)
      .eq('business_id', businessId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene toda la información necesaria para que el asistente gestione citas
 * @param {string} businessId - ID del negocio
 * @param {string} [date] - Fecha opcional para consultar disponibilidad (YYYY-MM-DD)
 */
async function get_assistant_calendar_info(businessId, date = null) {
  try {
    console.log(`📋 Obteniendo información de calendario para asistente, negocio: ${businessId}, fecha: ${date || 'no especificada'}`);
    
    // 1. Verificar credenciales del calendario
    const credentials = await getCalendarCredentials(businessId);
    if (!credentials) {
      return {
        success: false,
        error: 'Este negocio no tiene Google Calendar configurado',
        needs_setup: true
      };
    }

    // 2. Obtener horarios de atención y configuración de empalmes
    const businessHoursResult = await get_business_hours(businessId);
    if (!businessHoursResult.success) {
      return businessHoursResult;
    }

    // 3. Obtener todos los tipos de cita disponibles
    const typesResult = await get_appointment_types(businessId);
    let appointmentTypes = [];
    if (typesResult.success) {
      appointmentTypes = typesResult.data;
    }

    // 4. Si se proporciona una fecha, obtener disponibilidad
    let availability = null;
    let availabilityResult = null;
    
    if (date) {
      availabilityResult = await check_calendar_availability(businessId, date);
      if (availabilityResult.success) {
        availability = availabilityResult.available_slots;
      }
    }

    // 5. Calcular fecha actual para dar contexto al asistente - USAR ZONA HORARIA DE MÉXICO
    // Crear fecha actual en la zona horaria de México (America/Mexico_City)
    const today = new Date();
    // Convertir a hora de México  
    const mexicoDate = new Date(today.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
    
    // Formato ISO para México (YYYY-MM-DD)
    const todayFormatted = mexicoDate.toISOString().split('T')[0];
    
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    // Obtener componentes de fecha de la hora de México
    const mexicoDay = mexicoDate.getDate();
    const mexicoMonth = mexicoDate.getMonth();
    const mexicoYear = mexicoDate.getFullYear();
    const mexicoDayOfWeek = mexicoDate.getDay();
    
    // 6. Calcular fechas relativas comunes (mañana, pasado mañana, próxima semana)
    const tomorrow = new Date(mexicoDate);
    tomorrow.setDate(mexicoDate.getDate() + 1);
    const tomorrowFormatted = tomorrow.toISOString().split('T')[0];
    
    const dayAfterTomorrow = new Date(mexicoDate);
    dayAfterTomorrow.setDate(mexicoDate.getDate() + 2);
    const dayAfterTomorrowFormatted = dayAfterTomorrow.toISOString().split('T')[0];
    
    const nextWeek = new Date(mexicoDate);
    nextWeek.setDate(mexicoDate.getDate() + 7);
    const nextWeekFormatted = nextWeek.toISOString().split('T')[0];
    
    // 6. Devolver toda la información unificada
    return {
      success: true,
      business_hours: businessHoursResult.data,
      appointment_types: appointmentTypes,
      availability: availability,
      availability_date: date,
      availability_details: availabilityResult,
      calendar_connected: true,
      current_date: {
        iso: todayFormatted,
        day: mexicoDay,
        month: mexicoMonth + 1,
        year: mexicoYear,
        day_of_week: mexicoDayOfWeek,
        day_name: dayNames[mexicoDayOfWeek],
        month_name: monthNames[mexicoMonth],
        formatted: `${mexicoDay} de ${monthNames[mexicoMonth]} de ${mexicoYear}`,
        day_formatted: `${dayNames[mexicoDayOfWeek]}, ${mexicoDay} de ${monthNames[mexicoMonth]}`,
        timezone: 'America/Mexico_City'
      },
      relative_dates: {
        tomorrow: {
          iso: tomorrowFormatted,
          formatted: `${tomorrow.getDate()} de ${monthNames[tomorrow.getMonth()]} de ${tomorrow.getFullYear()}`,
          day_name: dayNames[tomorrow.getDay()]
        },
        day_after_tomorrow: {
          iso: dayAfterTomorrowFormatted,
          formatted: `${dayAfterTomorrow.getDate()} de ${monthNames[dayAfterTomorrow.getMonth()]} de ${dayAfterTomorrow.getFullYear()}`,
          day_name: dayNames[dayAfterTomorrow.getDay()]
        },
        next_week: {
          iso: nextWeekFormatted,
          formatted: `${nextWeek.getDate()} de ${monthNames[nextWeek.getMonth()]} de ${nextWeek.getFullYear()}`,
          day_name: dayNames[nextWeek.getDay()]
        }
      }
    };

  } catch (error) {
    console.error('❌ Error en get_assistant_calendar_info:', error);
    return {
      success: false,
      error: error.message
    };
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
  get_calendar_events,
  save_business_hours,
  get_business_hours,
  save_appointment_type,
  get_appointment_types,
  delete_appointment_type,
  get_assistant_calendar_info
}; 