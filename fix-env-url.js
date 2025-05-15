/**
 * Script para verificar y corregir las URLs del backend en el .env
 * y asegurar que todas las variables relacionadas estén configuradas correctamente
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  console.log('🔧 Verificando y corrigiendo configuración de URLs en el sistema');
  console.log('-'.repeat(70));
  
  try {
    // 1. Verificar y actualizar .env en el backend
    const envPath = path.join(process.cwd(), '.env');
    let envUpdated = false;
    
    if (fs.existsSync(envPath)) {
      console.log('✅ Archivo .env encontrado en el backend');
      
      let envContent = fs.readFileSync(envPath, 'utf8');
      let lines = envContent.split('\n');
      let updatedLines = [];
      let hasBackendUrl = false;
      let hasRedirectUri = false;
      
      // Procesar cada línea
      for (const line of lines) {
        if (line.startsWith('BACKEND_URL=')) {
          updatedLines.push('BACKEND_URL=http://localhost:3095');
          hasBackendUrl = true;
        } else if (line.startsWith('GOOGLE_REDIRECT_URI=')) {
          updatedLines.push('GOOGLE_REDIRECT_URI=http://localhost:3095/google-auth-callback');
          hasRedirectUri = true;
        } else {
          updatedLines.push(line);
        }
      }
      
      // Añadir variables si no existen
      if (!hasBackendUrl) {
        updatedLines.push('BACKEND_URL=http://localhost:3095');
        console.log('✅ BACKEND_URL añadido al .env');
        envUpdated = true;
      }
      
      if (!hasRedirectUri) {
        updatedLines.push('GOOGLE_REDIRECT_URI=http://localhost:3095/google-auth-callback');
        console.log('✅ GOOGLE_REDIRECT_URI añadido al .env');
        envUpdated = true;
      }
      
      // Guardar cambios
      if (envUpdated) {
        fs.writeFileSync(envPath, updatedLines.join('\n'), 'utf8');
        console.log('✅ Archivo .env actualizado correctamente');
      } else {
        console.log('ℹ️ No se requieren cambios en el archivo .env');
      }
    } else {
      console.log('❌ No se encontró el archivo .env en el backend');
      console.log('Creando archivo .env con valores predeterminados...');
      
      const defaultEnvContent = `
BACKEND_URL=http://localhost:3095
GOOGLE_REDIRECT_URI=http://localhost:3095/google-auth-callback
`.trim();
      
      fs.writeFileSync(envPath, defaultEnvContent, 'utf8');
      console.log('✅ Archivo .env creado con configuración básica');
    }
    
    // 2. Verificar si el servidor está ejecutándose
    try {
      console.log('\n🔍 Verificando si el servidor backend está en ejecución...');
      const isRunning = await checkServerRunning('http://localhost:3095/health');
      
      if (isRunning) {
        console.log('✅ El servidor backend está en ejecución correctamente');
      } else {
        console.log('⚠️ El servidor backend no está respondiendo');
        console.log('Debes iniciar el servidor con: PORT=3095 node index.js');
      }
    } catch (error) {
      console.log('⚠️ Error al verificar el servidor:', error.message);
    }
    
    // 3. Corrección en el frontend
    const frontendEnvPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(frontendEnvPath)) {
      console.log('\n✅ Archivo .env.local encontrado en el frontend');
      
      let envContent = fs.readFileSync(frontendEnvPath, 'utf8');
      let hasBackendUrl = envContent.includes('BACKEND_URL=');
      
      if (!hasBackendUrl) {
        envContent += '\nBACKEND_URL=http://localhost:3095\n';
        fs.writeFileSync(frontendEnvPath, envContent, 'utf8');
        console.log('✅ BACKEND_URL añadido al .env.local del frontend');
      } else {
        console.log('ℹ️ BACKEND_URL ya existe en el .env.local del frontend');
      }
    } else {
      console.log('\n❌ No se encontró el archivo .env.local en el frontend');
      console.log('Creando archivo .env.local para el frontend...');
      
      const frontendEnvContent = 'BACKEND_URL=http://localhost:3095\n';
      fs.writeFileSync(frontendEnvPath, frontendEnvContent, 'utf8');
      console.log('✅ Archivo .env.local creado para el frontend');
    }
    
    // 4. Instrucciones finales
    console.log('\n🔧 Configuración finalizada');
    console.log('✅ Variables de entorno configuradas correctamente');
    console.log('\nPara aplicar los cambios:');
    console.log('1. Reinicia el servidor backend: PORT=3095 node index.js');
    console.log('2. Reinicia el servidor frontend (Next.js)');
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Función para verificar si el servidor está en ejecución
async function checkServerRunning(url) {
  try {
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 3000)
    );
    
    const fetchPromise = fetch(url)
      .then(res => res.status === 200);
    
    return await Promise.race([fetchPromise, timeout]);
  } catch (error) {
    return false;
  }
}

// Ejecutar el script
main().catch(err => {
  console.error('Error global:', err);
}); 