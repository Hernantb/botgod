const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando corrección de comentarios multilínea en index.js...');

// Ruta al archivo index.js
const indexPath = path.join(__dirname, 'whatsapp-bot-main', 'index.js');

// Crear copia de seguridad
const timestamp = Date.now();
const backupPath = `${indexPath}.backup-${timestamp}`;
fs.copyFileSync(indexPath, backupPath);
console.log(`✅ Copia de seguridad creada: ${backupPath}`);

// Leer el contenido del archivo
let content = fs.readFileSync(indexPath, 'utf8');

// Buscar patrones de comentarios problemáticos
const badPatterns = [
  // Comentario sin cerrar
  /\/\/ FUNCIÓN DUPLICADA COMENTADA AUTOMÁTICAMENTE\n\/\*\n([^*]|\*(?!\/))*$/gm,
  
  // Comentario terminado incorrectamente
  /\/\/ ... existing code ...\n\*\//g,
  
  // Otros problemas detectados
  /\/\/ FUNCIÓN DUPLICADA COMENTADA.*\n\/\*\n/g
];

let modified = false;

// Corregir cada patrón
badPatterns.forEach((pattern, index) => {
  const matches = content.match(pattern);
  if (matches && matches.length > 0) {
    console.log(`🔍 Encontrados ${matches.length} comentarios problemáticos (patrón ${index + 1})`);
    
    // Realizar reemplazo según el tipo de problema
    if (index === 0) {
      // Cerrar comentario sin cerrar
      content = content.replace(pattern, (match) => `${match}\n*/`);
    } else if (index === 1) {
      // Arreglar comentario mal cerrado
      content = content.replace(pattern, '// ... existing code ...');
    } else if (index === 2) {
      // Corregir formato de comentario
      content = content.replace(pattern, (match) => {
        return match.replace('// ... existing code ...', '');
      });
    }
    
    modified = true;
    console.log(`✅ Corregidos comentarios de tipo ${index + 1}`);
  }
});

// Solución específica para línea 3242-3244
let lines = content.split('\n');
const problemLineRange = [3242, 3243, 3244];

// Verificar si hay un problema en esa área específica
const areaBefore = lines.slice(3241, 3245).join('\n');
console.log(`🔍 Analizando área problemática cerca de línea 3242...`);
console.log(areaBefore);

// Corregir el área específica
if (areaBefore.includes('// ... existing code ...') && 
    areaBefore.includes('*/') &&
    areaBefore.includes('// FUNCIÓN DUPLICADA')) {
  
  console.log(`🔧 Corrigiendo comentario problemático en línea 3242-3244...`);
  lines[3242] = '// FUNCIÓN DUPLICADA COMENTADA:';
  lines[3243] = '';
  lines[3244] = '';
  
  modified = true;
  console.log(`✅ Área problemática corregida manualmente`);
}

// Guardamos el archivo si hubo cambios
if (modified) {
  content = lines.join('\n');
  fs.writeFileSync(indexPath, content);
  console.log('✅ Archivo guardado con las correcciones aplicadas');
} else {
  console.log('ℹ️ No se realizaron cambios en el archivo');
}

// Verificación final - intentar cargar el archivo para comprobar sintaxis
try {
  require(indexPath);
  console.log('✅ Verificación de sintaxis exitosa: el archivo se puede cargar sin errores.');
} catch (error) {
  console.error('❌ Error de sintaxis persistente:', error.message);
  console.log('🔧 Se necesita corrección manual adicional');
  
  // Último intento: reemplazo completo de la sección problemática
  const completeLines = fs.readFileSync(indexPath, 'utf8').split('\n');
  
  // Reemplazo directo de la sección problemática
  const problematicSection = completeLines.slice(3240, 3249).join('\n');
  console.log('🔍 Sección problemática completa:');
  console.log(problematicSection);
  
  // Reemplazar con una versión correcta
  const correctedSection = `  return false;
}

async function sendBusinessNotification(conversationId, botMessage, clientPhoneNumber) {
  try {
    console.log(\`📧 INICIANDO PROCESO DE NOTIFICACIÓN para conversación: \${conversationId}\`);
    console.log(\`📧 Mensaje del bot que activó la notificación: "\${botMessage}"\`);`;
  
  // Reemplazar las líneas
  completeLines.splice(3240, 9, ...correctedSection.split('\n'));
  
  // Guardar el archivo corregido
  fs.writeFileSync(indexPath, completeLines.join('\n'));
  console.log('✅ Reemplazo completo de sección problemática aplicado');
}

console.log('🔧 Proceso de corrección finalizado'); 