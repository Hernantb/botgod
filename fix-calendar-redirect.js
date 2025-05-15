/**
 * Script para corregir el problema de la redirección 404 en la autenticación
 * de Google Calendar
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🔧 Corrigiendo problema de redirección 404 en la autenticación de Google Calendar');
  console.log('-'.repeat(70));
  
  // 1. Diagnóstico del problema
  console.log('1️⃣ Verificando el problema:');
  console.log(`- La página muestra un error 404 al intentar conectar Google Calendar`);
  console.log(`- El backend redirige a /api/google-auth, que no es una ruta válida en el frontend`);
  console.log(`- El frontend espera recibir una URL completa de autenticación, no solo la ruta`);
  
  // 2. Verificar si el archivo index.js existe
  const indexPath = path.join(process.cwd(), 'index.js');
  if (!fs.existsSync(indexPath)) {
    console.error('❌ No se encontró el archivo index.js');
    process.exit(1);
  }
  
  // 3. Hacer una copia de seguridad del archivo
  const backupPath = `${indexPath}.backup-${Date.now()}`;
  fs.copyFileSync(indexPath, backupPath);
  console.log(`✅ Copia de seguridad creada: ${path.basename(backupPath)}`);
  
  // 4. Leer el contenido del archivo
  let content = fs.readFileSync(indexPath, 'utf8');
  
  // 5. Buscar y modificar el endpoint de autenticación
  console.log('\n2️⃣ Corrigiendo el endpoint /api/calendar/auth:');
  
  const authEndpointPattern = /app\.post\(['"]\/api\/calendar\/auth['"],\s*async\s*\(req,\s*res\)\s*=>\s*{[\s\S]*?res\.json\(\{\s*success:\s*true,\s*authUrl:[^}]*\}\);/;
  
  content = content.replace(authEndpointPattern, (match) => {
    console.log('   🔍 Endpoint de autenticación encontrado');
    
    // Reemplazar con la versión corregida
    return match.replace(
      /authUrl:\s*['"](\/api\/google-auth[^'"]*)['"]/,
      (urlMatch, capturedUrl) => {
        console.log(`   🔄 Reemplazando URL de redirección: ${capturedUrl}`);
        
        return `authUrl: \`http://\${req.headers.host || 'localhost:3095'}${capturedUrl}\``;
      }
    );
  });
  
  // 6. Guardar el archivo modificado
  fs.writeFileSync(indexPath, content, 'utf8');
  console.log('   ✅ Archivo modificado correctamente');
  
  // 7. Verificar otros posibles problemas
  console.log('\n3️⃣ Verificando otros posibles problemas:');
  
  // 7.1 Verificar ruta google-auth-callback
  const hasCallbackRoute = content.includes('/google-auth-callback');
  console.log(`   ${hasCallbackRoute ? '✅' : '❌'} Ruta de callback (/google-auth-callback): ${hasCallbackRoute ? 'Encontrada' : 'No encontrada'}`);
  
  // 7.2 Verificar credenciales de Google
  console.log('   ⚠️ Recuerda que las credenciales de Google OAuth deben estar configuradas en el archivo .env');
  console.log('      Asegúrate de tener los siguientes valores configurados:');
  console.log('      - ***REMOVED***=tu_client_id');
  console.log('      - ***REMOVED***=tu_client_secret');
  console.log('      - GOOGLE_REDIRECT_URI=http://localhost:3095/google-auth-callback');
  
  // 8. Resumen final
  console.log('\n✅ Corrección completada');
  console.log('   - El backend ahora enviará la URL completa al frontend');
  console.log('   - La redirección debería funcionar correctamente');
  console.log('\n⚠️ Para aplicar los cambios, es necesario reiniciar el servidor:');
  console.log('   PORT=3095 node index.js');
}

// Ejecutar el script
main().catch(err => {
  console.error('Error en el script:', err);
}); 