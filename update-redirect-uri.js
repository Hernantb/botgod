const fs = require('fs');
const path = require('path');

// Ruta al archivo .env
const envFilePath = path.join(__dirname, '.env');

try {
  console.log('Actualizando URI de redirección en el archivo .env...');
  
  // Leer contenido actual del archivo .env
  let envContent = fs.readFileSync(envFilePath, 'utf8');
  
  // Verificar si ya existe la variable GOOGLE_REDIRECT_URI
  if (envContent.includes('GOOGLE_REDIRECT_URI=')) {
    // Reemplazar el valor existente
    envContent = envContent.replace(
      /GOOGLE_REDIRECT_URI=.*/g,
      'GOOGLE_REDIRECT_URI=http://localhost:3095/google-auth-callback'
    );
  } else {
    // Añadir la variable al final del archivo
    envContent += '\nGOOGLE_REDIRECT_URI=http://localhost:3095/google-auth-callback';
  }
  
  // Guardar el archivo .env actualizado
  fs.writeFileSync(envFilePath, envContent);
  
  console.log('✅ URI de redirección actualizado a: http://localhost:3095/google-auth-callback');
  console.log('🔄 Ahora debes reiniciar el servidor para aplicar los cambios');
} catch (error) {
  console.error('❌ Error al actualizar el archivo .env:', error.message);
  console.log('\nActualiza manualmente el archivo .env con la siguiente línea:');
  console.log('GOOGLE_REDIRECT_URI=http://localhost:3095/google-auth-callback');
} 