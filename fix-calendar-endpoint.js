const fs = require('fs');
const path = require('path');

// Ruta al archivo index.js
const indexFilePath = path.join(__dirname, 'index.js');

try {
  console.log('Añadiendo endpoint de callback de Google Calendar a index.js...');
  
  // Leer contenido actual del archivo index.js
  let indexContent = fs.readFileSync(indexFilePath, 'utf8');
  
  // Código del nuevo endpoint de callback
  const callbackEndpoint = `
// Endpoint para manejar la redirección de Google OAuth
app.get('/google-auth-callback', async (req, res) => {
  console.log('🔄 Recibida redirección de Google OAuth');
  
  try {
    const { code, state } = req.query;
    
    if (!code) {
      console.error('❌ No se recibió código de autorización');
      return res.status(400).send('Error: No se recibió código de autorización');
    }
    
    const businessId = state;
    if (!businessId) {
      console.error('❌ No se recibió ID de negocio en el estado');
      return res.status(400).send('Error: ID de negocio no encontrado');
    }
    
    console.log(\`✅ Código de autorización recibido para negocio: \${businessId}\`);
    
    // Obtener credenciales OAuth
    const { google } = require('googleapis');
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    if (!clientId || !clientSecret || !redirectUri) {
      console.error('❌ Faltan variables de entorno para Google OAuth');
      return res.status(500).send('Error de configuración de credenciales OAuth');
    }
    
    // Crear cliente OAuth
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    
    // Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('✅ Tokens obtenidos correctamente');
    console.log(\`- Access Token: \${tokens.access_token ? 'Presente' : 'No presente'}\`);
    console.log(\`- Refresh Token: \${tokens.refresh_token ? 'Presente' : 'No presente'}\`);
    console.log(\`- Expiry: \${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'No disponible'}\`);
    
    // Guardar tokens en la base de datos
    const { data: updated, error: updateError } = await supabase
      .from('business_config')
      .update({
        google_calendar_enabled: true,
        google_calendar_refresh_token: tokens.refresh_token,
        google_calendar_access_token: tokens.access_token,
        google_calendar_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        google_calendar_needs_reauth: false,
        google_calendar_updated_at: new Date().toISOString()
      })
      .eq('id', businessId);
      
    if (updateError) {
      console.error(\`❌ Error guardando tokens: \${updateError.message}\`);
      return res.status(500).send('Error guardando tokens en la base de datos');
    }
    
    console.log('✅ Tokens guardados correctamente en la base de datos');
    
    // Redirigir al usuario a la página de configuración
    return res.redirect('/dashboard/config');
    
  } catch (error) {
    console.error(\`❌ Error procesando callback de Google OAuth: \${error.message}\`);
    return res.status(500).send(\`Error: \${error.message}\`);
  }
});`;

  // Verificar si el endpoint ya existe
  if (indexContent.includes('/google-auth-callback')) {
    console.log('⚠️ El endpoint de callback ya existe en index.js');
  } else {
    // Buscar un lugar adecuado para insertar el código (después de otros endpoints de API)
    const insertPosition = indexContent.lastIndexOf('app.post(\'/api/');
    
    if (insertPosition === -1) {
      console.error('❌ No se pudo encontrar un lugar adecuado para insertar el código');
      console.log('Por favor, añade el siguiente código manualmente en index.js:');
      console.log(callbackEndpoint);
    } else {
      // Encontrar el final del endpoint actual
      const endOfEndpoint = indexContent.indexOf('});', insertPosition);
      const insertAt = endOfEndpoint + 3;
      
      // Insertar el nuevo endpoint
      indexContent = 
        indexContent.substring(0, insertAt) + 
        '\n\n' + callbackEndpoint + 
        indexContent.substring(insertAt);
      
      // Guardar el archivo actualizado
      fs.writeFileSync(indexFilePath, indexContent);
      
      console.log('✅ Endpoint de callback añadido correctamente a index.js');
    }
  }
  
  console.log('🔄 Ahora debes reiniciar el servidor para aplicar los cambios');
} catch (error) {
  console.error('❌ Error al actualizar index.js:', error.message);
  console.log('\nAñade manualmente el siguiente código a index.js:');
  console.log(`
// Endpoint para manejar la redirección de Google OAuth
app.get('/google-auth-callback', async (req, res) => {
  // ... (código del endpoint)
});`);
} 