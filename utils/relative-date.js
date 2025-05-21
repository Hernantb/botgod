const { DateTime } = require('luxon');

function getTodayInMexico() {
  return DateTime.now().setZone('America/Mexico_City').toISODate();
}

function getTomorrowInMexico() {
  return DateTime.now().setZone('America/Mexico_City').plus({ days: 1 }).toISODate();
}

function getDayAfterTomorrowInMexico() {
  return DateTime.now().setZone('America/Mexico_City').plus({ days: 2 }).toISODate();
}

function getNextWeekInMexico() {
  return DateTime.now().setZone('America/Mexico_City').plus({ days: 7 }).toISODate();
}

function parseRelativeDate(text) {
  const now = DateTime.now().setZone('America/Mexico_City');
  if (/pasado\s?mañana/i.test(text)) return now.plus({ days: 2 }).toISODate();
  if (/mañana/i.test(text)) return now.plus({ days: 1 }).toISODate();
  if (/hoy/i.test(text)) return now.toISODate();
  if (/próxima\s?semana|proxima\s?semana/i.test(text)) return now.plus({ days: 7 }).toISODate();
  // Puedes agregar más reglas aquí
  return null;
}

module.exports = {
  getTodayInMexico,
  getTomorrowInMexico,
  getDayAfterTomorrowInMexico,
  getNextWeekInMexico,
  parseRelativeDate
}; 