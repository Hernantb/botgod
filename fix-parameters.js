/**
 * Script para corregir problemas de parámetros en las APIs de calendario
 * Este script modifica los archivos relevantes para estandarizar el uso 
 * de parámetros id/businessId en las consultas a la API
 */

const fs = require('fs');
const path = require('path');

// Rutas de los archivos que necesitan modificación
const API_FILES = [
  'lib/calendar-api.js',
  'index.js'
];

// Función principal
async function main() {
  console.log('🔧 Corrección de parámetros en APIs de calendario');
  console.log('-'.repeat(70));
  
  let filesModified = 0;
  
  for (const filePath of API_FILES) {
    const fullPath = path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️ Archivo no encontrado: ${filePath}. Saltando...`);
      continue;
    }
    
    console.log(`📄 Procesando: ${filePath}`);
    
    // Leer el contenido del archivo
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    let updatedContent = fileContent;
    
    // Aplicar reemplazos según el archivo
    if (filePath.includes('calendar-api.js')) {
      updatedContent = fixCalendarApiFile(updatedContent);
    } else if (filePath.includes('index.js')) {
      updatedContent = fixIndexFile(updatedContent);
    }
    
    // Sólo guardar si hay cambios
    if (updatedContent !== fileContent) {
      // Crear una copia de seguridad
      const backupPath = `${fullPath}.backup-${Date.now()}`;
      fs.writeFileSync(backupPath, fileContent, 'utf8');
      console.log(`  ✅ Respaldo creado: ${path.basename(backupPath)}`);
      
      // Guardar la versión modificada
      fs.writeFileSync(fullPath, updatedContent, 'utf8');
      console.log(`  ✅ Modificaciones guardadas`);
      filesModified++;
    } else {
      console.log(`  ℹ️ No se requieren cambios`);
    }
  }
  
  console.log('-'.repeat(70));
  console.log(`✅ Proceso completado. Archivos modificados: ${filesModified}`);
  
  if (filesModified > 0) {
    console.log('\nRecomendación: Reinicia el servidor Node.js para aplicar los cambios');
    console.log('Comando: PORT=3095 node index.js');
  }
}

// Funciones específicas para cada archivo

function fixCalendarApiFile(content) {
  let updated = content;
  
  // 1. Buscar y corregir la función getCalendarCredentials
  const getCalCredPattern = /async function getCalendarCredentials\(businessId\)\s*{[\s\S]*?\.from\('business_config'\)[\s\S]*?\.select\([^)]*\)[\s\S]*?\.eq\([^)]*\)/;
  
  updated = updated.replace(getCalCredPattern, (match) => {
    console.log('  🔍 Modificando función getCalendarCredentials');
    
    // Versión modificada que acepta tanto id como business_id
    return match.replace(
      /\.eq\('([^']+)', businessId\)/,
      `.eq(businessId.includes('business_id=') ? 'business_id' : 'id', businessId.replace('business_id=', ''))`
    );
  });
  
  return updated;
}

function fixIndexFile(content) {
  let updated = content;
  
  // 1. Corregir endpoint /api/calendar/status
  const calendarStatusPattern = /app\.get\(['"]\/api\/calendar\/status['"],[^{]*{[\s\S]*?}/;
  
  updated = updated.replace(calendarStatusPattern, (match) => {
    console.log('  🔍 Modificando endpoint GET /api/calendar/status');
    
    if (match.includes('business_id') && !match.includes('let businessId = req.query.business_id || req.query.id;')) {
      return match.replace(
        /const businessId = ([^;]+);/,
        'let businessId = req.query.business_id || req.query.id;\n  if (!businessId) {\n    return res.status(400).json({ success: false, error: "Se requiere business_id o id" });\n  }'
      );
    }
    
    return match;
  });
  
  // 2. Corregir endpoint /api/calendar/availability
  const calendarAvailabilityPattern = /app\.post\(['"]\/api\/calendar\/availability['"],[^{]*{[\s\S]*?}/;
  
  updated = updated.replace(calendarAvailabilityPattern, (match) => {
    console.log('  🔍 Modificando endpoint POST /api/calendar/availability');
    
    if (match.includes('business_id') && !match.includes('let businessId = req.body.business_id || req.body.businessId;')) {
      return match.replace(
        /const (?:businessId|business_id) = ([^;]+);/,
        'let businessId = req.body.business_id || req.body.businessId || req.body.id;\n  if (!businessId) {\n    return res.status(400).json({ success: false, error: "Se requiere business_id, businessId o id" });\n  }'
      );
    }
    
    return match;
  });
  
  // 3. Corregir endpoint /api/calendar/auth
  const calendarAuthPattern = /app\.post\(['"]\/api\/calendar\/auth['"],[^{]*{[\s\S]*?}/;
  
  updated = updated.replace(calendarAuthPattern, (match) => {
    console.log('  🔍 Modificando endpoint POST /api/calendar/auth');
    
    if (match.includes('business_id') && !match.includes('let businessId = req.body.business_id || req.body.businessId;')) {
      return match.replace(
        /const (?:businessId|business_id) = ([^;]+);/,
        'let businessId = req.body.business_id || req.body.businessId || req.body.id;\n  if (!businessId) {\n    return res.status(400).json({ success: false, error: "Se requiere business_id, businessId o id" });\n  }'
      );
    }
    
    return match;
  });
  
  return updated;
}

// Ejecutar el script
main().catch(err => {
  console.error('Error general en el script:', err);
}); 