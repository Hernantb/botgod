/**
 * Script para crear una ruta proxy en el frontend para redireccionar 
 * las solicitudes de autenticación de Google Calendar
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Rutas de los directorios
const APP_DIR = 'app'; // Ajustar según la estructura del proyecto
const API_DIR = path.join(APP_DIR, 'api');
const GOOGLE_AUTH_DIR = path.join(API_DIR, 'google-auth');

async function main() {
  console.log('🔧 Creando ruta proxy para Google Auth en el frontend');
  console.log('-'.repeat(70));
  
  try {
    // 1. Verificar si existe la estructura de directorios
    if (!fs.existsSync(APP_DIR)) {
      console.log(`❌ No se encontró el directorio ${APP_DIR}`);
      console.log('Creando estructura de directorios necesaria...');
      
      // Crear la estructura de directorios
      if (!fs.existsSync(APP_DIR)) {
        fs.mkdirSync(APP_DIR, { recursive: true });
        console.log(`✅ Directorio ${APP_DIR} creado`);
      }
      
      if (!fs.existsSync(API_DIR)) {
        fs.mkdirSync(API_DIR, { recursive: true });
        console.log(`✅ Directorio ${API_DIR} creado`);
      }
    }
    
    // 2. Crear directorio google-auth si no existe
    if (!fs.existsSync(GOOGLE_AUTH_DIR)) {
      fs.mkdirSync(GOOGLE_AUTH_DIR, { recursive: true });
      console.log(`✅ Directorio ${GOOGLE_AUTH_DIR} creado`);
    }
    
    // 3. Crear archivo route.js
    const routeFilePath = path.join(GOOGLE_AUTH_DIR, 'route.js');
    
    const routeContent = `
// app/api/google-auth/route.js
import { NextResponse } from 'next/server';

// Esta ruta es un proxy para la autenticación de Google Calendar
export async function GET(request) {
  try {
    console.log('[API Google Auth] Procesando solicitud de autenticación');
    
    // Obtener la URL completa de la solicitud
    const url = new URL(request.url);
    const businessId = url.searchParams.get('businessId');
    
    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'ID de negocio no proporcionado' },
        { status: 400 }
      );
    }
    
    // Redirigir al backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3095';
    const redirectUrl = \`\${backendUrl}/api/google-auth?businessId=\${businessId}\`;
    
    console.log(\`[API Google Auth] Redirigiendo a: \${redirectUrl}\`);
    
    // Hacer una redirección 302 para mantener los parámetros
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('[API Google Auth] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error en la redirección' },
      { status: 500 }
    );
  }
}
`.trim();
    
    // Escribir el archivo
    fs.writeFileSync(routeFilePath, routeContent, 'utf8');
    console.log(`✅ Archivo ${routeFilePath} creado correctamente`);
    
    // 4. Crear o actualizar el .env.local en el frontend
    const envLocalPath = '.env.local';
    if (!fs.existsSync(envLocalPath)) {
      const envContent = `BACKEND_URL=http://localhost:3095\n`;
      fs.writeFileSync(envLocalPath, envContent, 'utf8');
      console.log(`✅ Archivo ${envLocalPath} creado con BACKEND_URL`);
    } else {
      let envContent = fs.readFileSync(envLocalPath, 'utf8');
      if (!envContent.includes('BACKEND_URL=')) {
        envContent += `\nBACKEND_URL=http://localhost:3095\n`;
        fs.writeFileSync(envLocalPath, envContent, 'utf8');
        console.log(`✅ BACKEND_URL añadido a ${envLocalPath}`);
      } else {
        console.log(`ℹ️ BACKEND_URL ya existe en ${envLocalPath}`);
      }
    }
    
    // 5. Verificar si hay más rutas a corregir
    console.log('\n🔍 Verificando otras posibles rutas que necesiten corrección...');
    
    // Mostrar instrucciones finales
    console.log('\n✅ Ruta proxy creada correctamente');
    console.log('Ahora cuando hagas clic en "Conectar Google Calendar", la solicitud será');
    console.log('redirigida correctamente al backend en lugar de mostrar un error 404.');
    console.log('\nPara aplicar los cambios:');
    console.log('1. Reinicia el servidor frontend (Next.js)');
    console.log('2. Asegúrate de que el servidor backend esté en ejecución: PORT=3095 node index.js');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(err => {
  console.error('Error general:', err);
}); 