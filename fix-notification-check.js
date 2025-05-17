const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando corrección definitiva de la función checkForNotificationPhrases...');

// Ruta al archivo index.js
const indexPath = path.join(__dirname, 'whatsapp-bot-main', 'index.js');

// Crear copia de seguridad
const timestamp = Date.now();
const backupPath = `${indexPath}.backup-${timestamp}`;
fs.copyFileSync(indexPath, backupPath);
console.log(`✅ Copia de seguridad creada: ${backupPath}`);

// Leer el contenido del archivo
let content = fs.readFileSync(indexPath, 'utf8');

// Buscar todas las líneas que declaran la función
const lines = content.split('\n');
const functionDeclarationLines = [];

lines.forEach((line, index) => {
  if (line.includes('function checkForNotificationPhrases') || line.match(/checkForNotificationPhrases\s*=\s*function/)) {
    functionDeclarationLines.push(index);
    console.log(`🔍 Encontrada declaración en línea ${index + 1}: ${line.trim()}`);
  }
});

console.log(`📊 Total de declaraciones encontradas: ${functionDeclarationLines.length}`);

if (functionDeclarationLines.length <= 1) {
  console.log('✅ No se necesitan correcciones. Solo hay una o ninguna declaración.');
  process.exit(0);
}

// Enfoque de solución más agresivo: reemplazar completamente el archivo
// Identificar mejor la función first checkForNotificationPhrases
const functionPattern = /function\s+checkForNotificationPhrases\s*\(\s*message\s*\)\s*\{[\s\S]+?(?=\n\s*function|\n\s*\/\/\s*End|\n\s*module\.exports|\n\s*\/\/\s*Endpoint|\n\s*export|\n\s*$)/g;
const functionMatches = [...content.matchAll(functionPattern)];

if (functionMatches.length >= 1) {
  console.log(`✅ Encontrada la declaración principal de la función. Longitud: ${functionMatches[0][0].length} caracteres`);
  
  // Extraer la función correcta para mantenerla
  const correctFunction = functionMatches[0][0];
  
  // Método agresivo: buscar y reemplazar todas las ocurrencias que puedan ser la función
  // Esto incluye variaciones en la declaración
  const variationPatterns = [
    /function\s+checkForNotificationPhrases\s*\([^)]*\)\s*\{[\s\S]+?(?=\n\s*function|\n\s*\/\/|\n\s*module|\n\s*$)/g,
    /const\s+checkForNotificationPhrases\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]+?(?=\n\s*function|\n\s*\/\/|\n\s*module|\n\s*$)/g,
    /const\s+checkForNotificationPhrases\s*=\s*function\s*\([^)]*\)\s*\{[\s\S]+?(?=\n\s*function|\n\s*\/\/|\n\s*module|\n\s*$)/g,
    /checkForNotificationPhrases\s*=\s*function\s*\([^)]*\)\s*\{[\s\S]+?(?=\n\s*function|\n\s*\/\/|\n\s*module|\n\s*$)/g
  ];
  
  // Almacenar posiciones de todas las ocurrencias para comentarlas
  const allMatches = [];
  
  for (const pattern of variationPatterns) {
    const matches = [...content.matchAll(pattern)];
    matches.forEach(match => {
      // Obtener la posición del match
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;
      
      // Verificar si ya tenemos un match que se superpone con este
      const overlapping = allMatches.some(([start, end]) => 
        (matchStart >= start && matchStart <= end) || (matchEnd >= start && matchEnd <= end)
      );
      
      if (!overlapping) {
        allMatches.push([matchStart, matchEnd, match[0]]);
      }
    });
  }
  
  // Ordenar matches por posición (importante para reemplazar desde el final hacia el principio)
  allMatches.sort((a, b) => b[0] - a[0]);
  
  console.log(`📊 Total de ocurrencias para comentar: ${allMatches.length}`);
  
  // Mantener solo la primera ocurrencia (la correcta)
  const firstMatch = functionMatches[0];
  const firstMatchStart = firstMatch.index;
  const firstMatchEnd = firstMatchStart + firstMatch[0].length;
  
  // Reemplazar todas las otras ocurrencias con comentarios
  for (const [start, end, matchText] of allMatches) {
    // Saltarse la primera ocurrencia (la que queremos mantener)
    if (start === firstMatchStart && end === firstMatchEnd) {
      console.log('✅ Manteniendo la primera declaración correcta de la función');
      continue;
    }
    
    const replaced = `// FUNCIÓN DUPLICADA ELIMINADA AUTOMÁTICAMENTE - ${new Date().toISOString()}\n/*\n${matchText}\n*/`;
    content = content.substring(0, start) + replaced + content.substring(end);
    console.log(`✅ Comentada función duplicada en posición ${start}-${end}`);
  }
  
  // Guardar los cambios
  fs.writeFileSync(indexPath, content);
  console.log('✅ Archivo guardado con las correcciones aplicadas');
  
  // Verificación final: contar cuántas declaraciones sin comentar quedan
  const newContent = fs.readFileSync(indexPath, 'utf8');
  const newLines = newContent.split('\n');
  let activeCount = 0;
  
  newLines.forEach(line => {
    if (line.includes('function checkForNotificationPhrases') && 
        !line.includes('//') && 
        !line.includes('ELIMINADA')) {
      activeCount++;
    }
  });
  
  console.log(`📊 Declaraciones activas después de la corrección: ${activeCount}`);
  
  if (activeCount > 1) {
    console.log('⚠️ ALERTA: Todavía pueden quedar declaraciones duplicadas. Se recomienda una revisión manual.');
  } else if (activeCount === 1) {
    console.log('✅ ÉXITO: Solo queda una declaración activa de la función.');
  } else {
    console.log('⚠️ ALERTA: No se encontró ninguna declaración activa después de la corrección. Es posible que todas hayan sido comentadas.');
  }
} else {
  console.log('❌ No se pudo encontrar la función principal. Se necesita revisión manual.');
}

console.log('🔧 Proceso de corrección finalizado'); 