const { DateTime } = require('luxon');

/**
 * Get the current date in Mexico City timezone
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
function getTodayInMexico() {
  return DateTime.now().setZone('America/Mexico_City').toISODate();
}

/**
 * Get tomorrow's date in Mexico City timezone
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
function getTomorrowInMexico() {
  return DateTime.now().setZone('America/Mexico_City').plus({ days: 1 }).toISODate();
}

/**
 * Get the day after tomorrow's date in Mexico City timezone
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
function getDayAfterTomorrowInMexico() {
  return DateTime.now().setZone('America/Mexico_City').plus({ days: 2 }).toISODate();
}

/**
 * Get the date one week from now in Mexico City timezone
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
function getNextWeekInMexico() {
  return DateTime.now().setZone('America/Mexico_City').plus({ days: 7 }).toISODate();
}

/**
 * Get the current date and time in Mexico City timezone
 * @returns {DateTime} Luxon DateTime object
 */
function getNowInMexico() {
  return DateTime.now().setZone('America/Mexico_City');
}

/**
 * Parse relative date references from text
 * @param {string} text - Text to parse for relative date references
 * @returns {string|null} ISO date string or null if no match found
 */
function parseRelativeDate(text) {
  const now = DateTime.now().setZone('America/Mexico_City');
  
  if (!text) return null;
  
  // Common Spanish relative date expressions
  if (/pasado\s?mañana/i.test(text)) return now.plus({ days: 2 }).toISODate();
  if (/mañana/i.test(text)) return now.plus({ days: 1 }).toISODate();
  if (/\bhoy\b/i.test(text)) return now.toISODate();
  if (/próxima\s?semana|proxima\s?semana/i.test(text)) return now.plus({ days: 7 }).toISODate();
  if (/este\s?fin\s?de\s?semana/i.test(text)) {
    // Get next Saturday
    const daysUntilSaturday = (6 - now.weekday + 7) % 7;
    return now.plus({ days: daysUntilSaturday }).toISODate();
  }
  
  // Parse specific day names
  const dayMapping = {
    'lunes': 1, 
    'martes': 2, 
    'miércoles': 3, 'miercoles': 3,
    'jueves': 4, 
    'viernes': 5, 
    'sábado': 6, 'sabado': 6,
    'domingo': 7
  };
  
  for (const [dayName, dayNumber] of Object.entries(dayMapping)) {
    const regex = new RegExp(`\\b${dayName}\\b`, 'i');
    if (regex.test(text)) {
      // Calculate days to add
      const currentWeekday = now.weekday;
      let daysToAdd = dayNumber - currentWeekday;
      
      // If the day has already passed this week, go to next week
      if (daysToAdd <= 0) {
        daysToAdd += 7;
      }
      
      return now.plus({ days: daysToAdd }).toISODate();
    }
  }
  
  // Couldn't parse a relative date
  return null;
}

/**
 * Get a complete set of relative dates for the assistant
 * @returns {object} Object with all relative dates
 */
function getAllRelativeDates() {
  const now = DateTime.now().setZone('America/Mexico_City');
  
  // Create weekday names in Spanish
  const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  
  // Get dates for the next 14 days
  const next14Days = [];
  for (let i = 0; i < 14; i++) {
    const date = now.plus({ days: i });
    next14Days.push({
      date: date.toISODate(),
      day_of_week: weekdays[date.weekday % 7],
      formatted: date.toFormat('d \'de\' MMMM', { locale: 'es' })
    });
  }
  
  return {
    today: {
      date: now.toISODate(),
      day_of_week: weekdays[now.weekday % 7],
      formatted: now.toFormat('d \'de\' MMMM', { locale: 'es' })
    },
    tomorrow: {
      date: now.plus({ days: 1 }).toISODate(),
      day_of_week: weekdays[now.plus({ days: 1 }).weekday % 7],
      formatted: now.plus({ days: 1 }).toFormat('d \'de\' MMMM', { locale: 'es' })
    },
    day_after_tomorrow: {
      date: now.plus({ days: 2 }).toISODate(),
      day_of_week: weekdays[now.plus({ days: 2 }).weekday % 7],
      formatted: now.plus({ days: 2 }).toFormat('d \'de\' MMMM', { locale: 'es' })
    },
    next_week: {
      date: now.plus({ days: 7 }).toISODate(),
      day_of_week: weekdays[now.plus({ days: 7 }).weekday % 7],
      formatted: now.plus({ days: 7 }).toFormat('d \'de\' MMMM', { locale: 'es' })
    },
    current_time: now.toFormat('HH:mm'),
    timezone: 'America/Mexico_City',
    next_14_days: next14Days
  };
}

module.exports = {
  getTodayInMexico,
  getTomorrowInMexico,
  getDayAfterTomorrowInMexico,
  getNextWeekInMexico,
  getNowInMexico,
  parseRelativeDate,
  getAllRelativeDates
}; 