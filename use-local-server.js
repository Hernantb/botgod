// Este script lanza tanto el servidor de WhatsApp como el dashboard en modo local
// y configura el servidor para usar los cambios que hemos hecho

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Directorio raíz del proyecto
const rootDir = '/Users/nan/Desktop/copia_de_seguridad_proyecto';

// Función para ejecutar comandos
async function runCommand(command, args, cwd, name) {
  console.log(`🚀 Iniciando ${name}...`);
  
  const process = spawn(command, args, { 
    cwd, 
    stdio: 'pipe',
    shell: true
  });
  
  process.stdout.on('data', (data) => {
    console.log(`[${name}] ${data.toString().trim()}`);
  });
  
  process.stderr.on('data', (data) => {
    console.error(`[${name} ERROR] ${data.toString().trim()}`);
  });
  
  process.on('close', (code) => {
    console.log(`[${name}] Proceso terminado con código ${code}`);
  });
  
  return process;
}

// Función principal
async function main() {
  try {
    console.log('📝 Iniciando servidores locales...');
    
    // Modificar .env temporal para usar el servidor local
    const envPath = path.join(rootDir, '.env.local');
    let envContent = '';
    
    try {
      envContent = fs.readFileSync(envPath, 'utf8');
    } catch (err) {
      console.log('❌ No se encontró archivo .env.local, creando uno nuevo...');
      envContent = '';
    }
    
    // Actualizar/añadir configuración para usar servidor local
    const newEnv = envContent
      .replace(/CONTROL_PANEL_URL=.*$/m, 'CONTROL_PANEL_URL=http://localhost:3000/api/register-bot-response')
      + '\nCONTROL_PANEL_URL=http://localhost:3000/api/register-bot-response\n';
    
    fs.writeFileSync(envPath, newEnv);
    console.log('✅ Archivo .env.local actualizado para usar servidor local');
    
    // Iniciar el servidor de WhatsApp
    const whatsappServer = await runCommand(
      'node',
      ['index.js'],
      path.join(rootDir, 'whatsapp-bot-main'),
      'WhatsApp Server'
    );
    
    // Iniciar el dashboard Next.js
    const dashboard = await runCommand(
      'npm',
      ['run', 'dev'],
      rootDir,
      'Next.js Dashboard'
    );
    
    // Manejar señales para cerrar procesos correctamente
    process.on('SIGINT', () => {
      console.log('🛑 Deteniendo servidores...');
      whatsappServer.kill();
      dashboard.kill();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Ejecutar
main(); 