const fs = require('fs');
const path = require('path');

// Archivo a modificar
const indexPath = path.join(__dirname, 'index.js');

console.log('🔧 Iniciando búsqueda y corrección de declaraciones duplicadas...');

// Leer el archivo
let content = fs.readFileSync(indexPath, 'utf8');

// Mantener solo la primera declaración de sendTextMessageGupShup
const importPattern = /const\s*{\s*sendTextMessageGupShup\s*}\s*=\s*require\(['"]\.\/(sendTextMessageGupShup)['"]\);/g;

let firstOccurrence = true;
let modifiedContent = content.replace(importPattern, (match) => {
  if (firstOccurrence) {
    firstOccurrence = false;
    return match; // Mantener la primera ocurrencia
  }
  console.log('🔧 Eliminando declaración duplicada de sendTextMessageGupShup');
  return '// REMOVED: ' + match;
});

// Buscar e implementación duplicada de la función
const functionPattern = /async\s+function\s+sendTextMessageGupShup\s*\([^\)]*\)\s*\{[\s\S]*?\}/g;
let found = false;

modifiedContent = modifiedContent.replace(functionPattern, (match) => {
  console.log('🔧 Comentando implementación duplicada de sendTextMessageGupShup');
  found = true;
  return '/* REMOVED FUNCTION: \n' + match + '\n*/';
});

// Guardar los cambios si hubo modificaciones
if (content !== modifiedContent) {
  // Hacer una copia de seguridad
  fs.writeFileSync(indexPath + '.bak-' + Date.now(), content);
  
  // Guardar el archivo modificado
  fs.writeFileSync(indexPath, modifiedContent);
  
  console.log('✅ Archivo actualizado exitosamente');
  console.log('✅ Se ha creado una copia de seguridad del archivo original');
} else {
  console.log('⚠️ No se encontraron declaraciones duplicadas para corregir');
}

// Búsqueda más específica en todo el archivo
const lines = modifiedContent.split('\n');
let suspectLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Buscar líneas sospechosas que podrían ser redeclaraciones
  if (line.includes('sendTextMessageGupShup') && 
      (line.includes('require') || line.includes('function') || line.includes('const')) &&
      !line.includes('//') && !line.includes('/*')) {
    suspectLines.push({line: i + 1, content: line.trim()});
  }
}

if (suspectLines.length > 1) {
  console.log('⚠️ Se encontraron múltiples líneas que podrían contener declaraciones:');
  suspectLines.forEach(item => {
    console.log(`  Línea ${item.line}: ${item.content}`);
  });
  console.log('⚠️ Revise manualmente si alguna de estas líneas necesita ser corregida');
}

console.log('🔍 Proceso de corrección finalizado'); 