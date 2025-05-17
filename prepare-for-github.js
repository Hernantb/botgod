#!/usr/bin/env node
/**
 * Script para preparar el repositorio para GitHub
 * 
 * Este script organiza los archivos necesarios y verifica la configuración
 * para asegurar que el despliegue en Render funcione correctamente.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuración
const requiredFiles = [
  'index.js',
  'render-start.js',
  'notification-patch.js',
  'package.json',
  '.env.render',
  'render.yaml',
  '.gitignore',
  'README.md'
];

// Función para registrar mensajes
function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] ${message}`);
}

// Función para verificar la existencia de archivos
function checkFiles() {
  log('🔍 Verificando archivos requeridos...');
  
  const missing = [];
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      missing.push(file);
      log(`❌ Falta el archivo: ${file}`);
    } else {
      log(`✅ Archivo encontrado: ${file}`);
    }
  }
  
  return missing;
}

// Función para verificar la sintaxis de los archivos JavaScript
function checkSyntax() {
  log('🔍 Verificando sintaxis de archivos JavaScript...');
  
  const jsFiles = requiredFiles.filter(file => file.endsWith('.js'));
  const withErrors = [];
  
  for (const file of jsFiles) {
    try {
      execSync(`node -c ${file}`, { stdio: 'pipe' });
      log(`✅ Sintaxis correcta: ${file}`);
    } catch (error) {
      withErrors.push(file);
      log(`❌ Error de sintaxis en ${file}: ${error.message}`);
    }
  }
  
  return withErrors;
}

// Función para verificar dependencias
function checkDependencies() {
  log('🔍 Verificando dependencias...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deps = { ...packageJson.dependencies };
    
    const requiredDeps = [
      '@supabase/supabase-js',
      'axios',
      'cors',
      'dotenv',
      'express',
      'nodemailer',
      'openai'
    ];
    
    const missing = [];
    for (const dep of requiredDeps) {
      if (!deps[dep]) {
        missing.push(dep);
        log(`❌ Falta dependencia: ${dep}`);
      } else {
        log(`✅ Dependencia encontrada: ${dep}`);
      }
    }
    
    return missing;
  } catch (error) {
    log(`❌ Error al leer package.json: ${error.message}`);
    return ['Error al leer package.json'];
  }
}

// Función para verificar scripts en package.json
function checkScripts() {
  log('🔍 Verificando scripts en package.json...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const scripts = packageJson.scripts || {};
    
    const requiredScripts = {
      'start': 'node render-start.js'
    };
    
    const incorrect = [];
    for (const [name, command] of Object.entries(requiredScripts)) {
      if (!scripts[name]) {
        incorrect.push(name);
        log(`❌ Falta script: ${name}`);
      } else if (scripts[name] !== command) {
        incorrect.push(name);
        log(`⚠️ Script incorrecto: ${name} (es "${scripts[name]}", debería ser "${command}")`);
      } else {
        log(`✅ Script correcto: ${name}`);
      }
    }
    
    return incorrect;
  } catch (error) {
    log(`❌ Error al leer package.json: ${error.message}`);
    return ['Error al leer package.json'];
  }
}

// Función para verificar si git está inicializado
function checkGit() {
  log('🔍 Verificando repositorio Git...');
  
  try {
    // Verificar si el directorio .git existe
    if (!fs.existsSync('.git')) {
      log('⚠️ No se encontró repositorio Git. Inicializando...');
      execSync('git init', { stdio: 'pipe' });
      log('✅ Repositorio Git inicializado');
      return false;
    } else {
      log('✅ Repositorio Git encontrado');
      return true;
    }
  } catch (error) {
    log(`❌ Error al verificar o inicializar Git: ${error.message}`);
    return false;
  }
}

// Función para crear un commit inicial
function createInitialCommit() {
  log('🔍 Preparando commit inicial...');
  
  try {
    // Agregar todos los archivos
    execSync('git add .', { stdio: 'pipe' });
    log('✅ Archivos agregados al staging area');
    
    // Crear commit inicial
    execSync('git commit -m "Initial commit: WhatsApp Bot configurado para Render"', { stdio: 'pipe' });
    log('✅ Commit inicial creado');
    
    return true;
  } catch (error) {
    log(`❌ Error al crear commit inicial: ${error.message}`);
    return false;
  }
}

// Función principal
async function prepareForGithub() {
  log('🚀 Iniciando preparación para GitHub...');
  
  // Verificar archivos requeridos
  const missingFiles = checkFiles();
  if (missingFiles.length > 0) {
    log('⚠️ Faltan archivos requeridos. Por favor, crea estos archivos antes de continuar.');
    return false;
  }
  
  // Verificar sintaxis JavaScript
  const filesWithSyntaxErrors = checkSyntax();
  if (filesWithSyntaxErrors.length > 0) {
    log('⚠️ Hay archivos con errores de sintaxis. Por favor, corrige estos errores antes de continuar.');
    return false;
  }
  
  // Verificar dependencias
  const missingDeps = checkDependencies();
  if (missingDeps.length > 0) {
    log('⚠️ Faltan dependencias. Por favor, agrégalas a package.json antes de continuar.');
  }
  
  // Verificar scripts
  const incorrectScripts = checkScripts();
  if (incorrectScripts.length > 0) {
    log('⚠️ Hay scripts incorrectos en package.json. Por favor, corrígelos antes de continuar.');
  }
  
  // Verificar Git
  const gitInitialized = checkGit();
  
  // Crear un commit inicial si es necesario
  if (!gitInitialized) {
    const commitCreated = createInitialCommit();
    if (!commitCreated) {
      log('⚠️ No se pudo crear el commit inicial. Por favor, hazlo manualmente.');
    }
  }
  
  log('✅ Preparación para GitHub completada.');
  log('');
  log('PRÓXIMOS PASOS:');
  log('1. Agrega tus cambios con: git add .');
  log('2. Realiza un commit: git commit -m "Tu mensaje de commit"');
  log('3. Configura tu repositorio remoto:');
  log('   git remote add origin https://github.com/tu-usuario/tu-repositorio.git');
  log('4. Sube tus cambios: git push -u origin master');
  
  return true;
}

// Ejecutar función principal
prepareForGithub()
  .then(success => {
    if (success) {
      log('✅ Proceso completado correctamente');
      process.exit(0);
    } else {
      log('❌ El proceso finalizó con errores');
      process.exit(1);
    }
  })
  .catch(error => {
    log(`❌ Error fatal: ${error.message}`);
    log(error.stack);
    process.exit(1);
  }); 