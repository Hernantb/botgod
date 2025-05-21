// Importar helper de fechas relativas
const relativeDate = require('../utils/relative-date');
const { DateTime } = require('luxon');

// Endpoint para obtener fechas relativas (para el asistente)
router.get('/date/relative', async (req, res) => {
  try {
    // Obtener fecha actual en México
    const today = relativeDate.getTodayInMexico();
    const tomorrow = relativeDate.getTomorrowInMexico();
    const dayAfterTomorrow = relativeDate.getDayAfterTomorrowInMexico();
    const nextWeek = relativeDate.getNextWeekInMexico();
    
    // Formatear fechas en español
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    
    const formatDate = (isoDate) => {
      const dt = DateTime.fromISO(isoDate).setZone('America/Mexico_City');
      return {
        iso: isoDate,
        day: dt.day,
        month: dt.month,
        year: dt.year,
        day_of_week: dt.weekday % 7,
        day_name: dayNames[dt.weekday % 7],
        month_name: monthNames[dt.month - 1],
        formatted: `${dt.day} de ${monthNames[dt.month - 1]} de ${dt.year}`,
        day_formatted: `${dayNames[dt.weekday % 7]}, ${dt.day} de ${monthNames[dt.month - 1]}`
      };
    };
    
    res.json({
      success: true,
      timezone: 'America/Mexico_City',
      today: formatDate(today),
      tomorrow: formatDate(tomorrow), 
      day_after_tomorrow: formatDate(dayAfterTomorrow),
      next_week: formatDate(nextWeek)
    });
  } catch (error) {
    console.error('Error en endpoint de fechas relativas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}); 