/**
 * Módulo para cargar y gestionar configuraciones de negocios
 * 
 * Este módulo implementa un sistema de caché para las configuraciones de empresas
 * y proporciona funciones para acceder a ellas de forma eficiente.
 */

const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_KEY } = require('./supabase-config');

// Inicializar cliente de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Caché para configuraciones de negocios, mapeado por número de WhatsApp
const businessConfigCache = new Map();

/**
 * Carga todas las configuraciones activas de negocios desde Supabase
 * @returns {Promise<boolean>} true si se cargaron correctamente, false si hubo error
 */
async function loadAllBusinessConfigs() {
  try {
    console.log('🔄 Cargando configuraciones de negocios desde Supabase...');
    
    const { data, error } = await supabase
      .from('business_config')
      .select('*')
      .eq('is_active', true);
      
    if (error) {
      console.error('❌ Error al cargar configuraciones:', error.message);
      return false;
    }
    
    // Limpiar caché actual
    businessConfigCache.clear();
    
    // Poblar caché con nuevos datos
    data.forEach(config => {
      // Mapear por número de WhatsApp para búsqueda rápida
      businessConfigCache.set(config.gupshup_number, config);
      console.log(`✅ Configuración cargada para: ${config.business_name} (${config.gupshup_number})`);
    });
    
    console.log(`📊 Total de negocios configurados: ${businessConfigCache.size}`);
    return true;
  } catch (e) {
    console.error('❌ Error crítico cargando configuraciones:', e.message);
    return false;
  }
}

/**
 * Obtiene la configuración de un negocio por su número de WhatsApp
 * @param {string} phoneNumber Número de teléfono de WhatsApp del negocio
 * @returns {Object|null} Configuración del negocio o null si no se encuentra
 */
function getBusinessConfigByNumber(phoneNumber) {
  if (!phoneNumber) return null;
  
  // Normalizar número telefónico (eliminar caracteres no numéricos)
  const normalizedPhone = phoneNumber.replace(/\D/g, '');
  
  // Intentar búsqueda exacta primero
  if (businessConfigCache.has(phoneNumber)) {
    return businessConfigCache.get(phoneNumber);
  }
  
  // Intentar búsqueda exacta con número normalizado
  if (businessConfigCache.has(normalizedPhone)) {
    return businessConfigCache.get(normalizedPhone);
  }
  
  // Búsqueda flexible (el número podría tener prefijo o formato diferente)
  for (const [cachedNumber, config] of businessConfigCache.entries()) {
    const normalizedCached = cachedNumber.replace(/\D/g, '');
    // Si el número normalizado termina con el otro número normalizado
    if (normalizedPhone.endsWith(normalizedCached) || normalizedCached.endsWith(normalizedPhone)) {
      return config;
    }
  }
  
  // No se encontró configuración
  return null;
}

/**
 * Obtiene la configuración de un negocio por su ID
 * @param {string} businessId ID del negocio
 * @returns {Object|null} Configuración del negocio o null si no se encuentra
 */
function getBusinessConfigById(businessId) {
  if (!businessId) return null;
  
  for (const config of businessConfigCache.values()) {
    if (config.id === businessId) {
      return config;
    }
  }
  
  return null;
}

/**
 * Recarga las configuraciones de negocios desde Supabase
 * @returns {Promise<void>}
 */
async function reloadBusinessConfigs() {
  console.log('🔄 Recargando configuraciones de negocios...');
  await loadAllBusinessConfigs();
}

// Cargar configuraciones al inicio
console.log('🚀 Iniciando carga de configuraciones de negocios...');
loadAllBusinessConfigs();

// Programar recarga periódica (cada 15 minutos)
setInterval(reloadBusinessConfigs, 15 * 60 * 1000);

module.exports = {
  getBusinessConfigByNumber,
  getBusinessConfigById,
  reloadBusinessConfigs,
  loadAllBusinessConfigs,
  businessConfigCache
}; 