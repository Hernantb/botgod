const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando corrección final de funciones parcialmente comentadas...');

// Ruta al archivo index.js
const indexPath = path.join(__dirname, 'whatsapp-bot-main', 'index.js');

// Crear copia de seguridad
const timestamp = Date.now();
const backupPath = `${indexPath}.backup-${timestamp}`;
fs.copyFileSync(indexPath, backupPath);
console.log(`✅ Copia de seguridad creada: ${backupPath}`);

// Leer el contenido del archivo
const lines = fs.readFileSync(indexPath, 'utf8').split('\n');

// Las líneas donde sabemos que hay problemas
const problematicAreas = [
  {
    functionName: 'checkForNotificationPhrases',
    startLine: 3731, // Línea donde empieza la declaración comentada
    searchPattern: 'function checkForNotificationPhrases'
  },
  {
    functionName: 'sendBusinessNotification',
    startLine: 3805, // Línea donde empieza la declaración comentada
    searchPattern: 'function sendBusinessNotification'
  }
];

// Para cada área problemática, encontrar y comentar el cuerpo completo de la función
problematicAreas.forEach(area => {
  console.log(`🔍 Procesando duplicación de ${area.functionName}...`);
  
  // Verificar que la línea está comentada
  if (!lines[area.startLine].includes('//')) {
    console.log(`⚠️ La línea ${area.startLine + 1} no está comentada. Comentándola...`);
    lines[area.startLine] = `// ELIMINACIÓN MANUAL: ${lines[area.startLine]}`;
  }
  
  // Buscar el cuerpo completo de la función desde la línea de inicio
  let openBraces = 0;
  let inFunction = false;
  let endLine = -1;
  
  for (let i = area.startLine; i < lines.length; i++) {
    const line = lines[i];
    
    // Si encontramos la declaración de la función, empezamos a contar
    if (line.includes(area.searchPattern)) {
      inFunction = true;
    }
    
    if (inFunction) {
      // Contar llaves abiertas
      const openCount = (line.match(/\{/g) || []).length;
      const closeCount = (line.match(/\}/g) || []).length;
      
      openBraces += openCount - closeCount;
      
      // Si ya estamos dentro de la función y no es la línea inicial, comentarla si no lo está
      if (i > area.startLine && !line.includes('//')) {
        lines[i] = `// ELIMINACIÓN MANUAL: ${line}`;
      }
      
      // Si hemos llegado al final de la función
      if (openBraces === 0 && i > area.startLine) {
        endLine = i;
        console.log(`✅ Final de función encontrado en línea ${endLine + 1}`);
        break;
      }
    }
  }
  
  if (endLine === -1) {
    console.log(`⚠️ No se pudo encontrar el final de la función ${area.functionName}`);
  } else {
    console.log(`✅ Comentadas ${endLine - area.startLine + 1} líneas para ${area.functionName}`);
  }
});

// Guardar los cambios
fs.writeFileSync(indexPath, lines.join('\n'));
console.log('✅ Cambios guardados correctamente');

// Verificar la sintaxis
try {
  console.log('🔍 Verificando sintaxis del archivo...');
  require('child_process').execSync(`node --check "${indexPath}"`, { encoding: 'utf8' });
  console.log('✅ Sintaxis correcta. No hay errores en el archivo.');
} catch (error) {
  console.error('❌ Error de sintaxis persistente:', error.message);
  console.log('⚠️ Se requiere una corrección manual adicional');
  
  // Solución manual final
  console.log('🔧 Aplicando solución manual final...');
  const content = fs.readFileSync(indexPath, 'utf8');
  
  // Reemplazar secciones problemáticas específicas
  const fixedContent = content
    // Arreglar secciones con llaves desbalanceadas
    .replace(/\/\/ ELIMINACIÓN MANUAL: }(\s*)(\/\/ ELIMINACIÓN MANUAL: )?/g, '// ELIMINACIÓN MANUAL: }\n')
    // Comentar cualquier fragmento de código que pueda haber quedado suelto después de las funciones
    .replace(/^}(?!\s*\/\/)/gm, '// ELIMINACIÓN MANUAL: }');
  
  fs.writeFileSync(indexPath, fixedContent);
  console.log('✅ Solución manual aplicada');
  
  // Verificar sintaxis una vez más
  try {
    require('child_process').execSync(`node --check "${indexPath}"`, { encoding: 'utf8' });
    console.log('✅ Sintaxis correcta después de la solución manual.');
  } catch (finalError) {
    console.error('❌ Error persistente después de todos los intentos:', finalError.message);
    console.log('⚠️ El archivo requiere revisión manual por un desarrollador');
  }
}

console.log('🔧 Proceso finalizado'); 