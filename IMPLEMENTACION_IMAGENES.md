# Implementación de Soporte para Imágenes en WhatsApp Bot

Este documento detalla cómo implementar el soporte para recibir y enviar imágenes entre el dashboard y el servidor WhatsApp en Render.

## Arquitectura General

### Flujo de Envío de Imágenes (Dashboard → WhatsApp)
1. Usuario selecciona una imagen en el dashboard
2. Dashboard sube la imagen a Supabase Storage 
3. Se crea un mensaje en la base de datos con la URL de la imagen
4. El servidor de WhatsApp detecta el nuevo mensaje con imagen y lo envía al cliente

### Flujo de Recepción de Imágenes (WhatsApp → Dashboard)
1. Cliente envía una imagen por WhatsApp
2. Gupshup recibe la imagen y notifica al servidor en Render
3. Servidor en Render descarga la imagen desde la URL proporcionada por Gupshup
4. Servidor sube la imagen a Supabase Storage
5. Se crea un mensaje en la base de datos con la URL de la imagen
6. Dashboard muestra la imagen cuando el usuario abre la conversación

## Cambios Necesarios en el Servidor de Render

### 1. Instalación de Dependencias
Agregar las siguientes dependencias al proyecto:
```bash
npm install --save multer uuid axios @supabase/storage-js
```

### 2. Configuración de Supabase Storage
Agregar el siguiente código para configurar Supabase con permisos elevados para Storage:

```javascript
// Importar dependencias
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Cliente de Supabase con permisos elevados para Storage
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Configurar almacenamiento temporal para multer
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Límite de 10MB
  }
});
```

### 3. Función para Subir Archivos a Supabase Storage

```javascript
// Función para subir un buffer a Supabase Storage
async function uploadBufferToSupabase(buffer, fileName, mimeType, conversationId) {
  console.log(`📤 Intentando subir archivo ${fileName} (${mimeType}) para conversación ${conversationId}`);
  
  // Generar un nombre único para el archivo
  const fileExtension = fileName.substring(fileName.lastIndexOf('.')) || '.jpg';
  const uniqueFileName = `${uuidv4()}${fileExtension}`;
  const filePath = `${conversationId}/${uniqueFileName}`;
  
  try {
    // Verificar buckets existentes
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
    
    if (bucketsError) {
      console.log(`❌ Error al listar buckets: ${bucketsError.message}`);
      throw new Error(`Error al listar buckets: ${bucketsError.message}`);
    }
    
    // Lista de buckets para intentar usar/crear
    const bucketNames = ['media', 'avatars', 'profile', 'public', 'images', 'files'];
    let bucketToUse = null;
    
    // Verificar si alguno de nuestros buckets preferidos existe
    if (buckets && buckets.length > 0) {
      console.log(`✅ Buckets disponibles: ${buckets.map(b => b.name).join(', ')}`);
      for (const name of bucketNames) {
        if (buckets.some(b => b.name === name)) {
          bucketToUse = name;
          console.log(`✅ Usando bucket existente: ${bucketToUse}`);
          break;
        }
      }
    } else {
      console.log('❓ No se encontraron buckets existentes');
    }
    
    // Si no encontramos un bucket, intentar crear uno
    if (!bucketToUse) {
      console.log('🔧 Intentando crear un nuevo bucket...');
      
      for (const name of bucketNames) {
        try {
          console.log(`🔧 Intentando crear bucket: ${name}`);
          const { data, error } = await supabaseAdmin.storage.createBucket(name, {
            public: true,
            fileSizeLimit: 10485760 // 10MB
          });
          
          if (!error) {
            bucketToUse = name;
            console.log(`✅ Bucket '${name}' creado exitosamente`);
            break;
          } else {
            console.log(`❌ No se pudo crear bucket '${name}': ${error.message}`);
          }
        } catch (err) {
          console.log(`❌ Error al intentar crear bucket '${name}': ${err.message}`);
        }
      }
    }
    
    // Si tenemos un bucket para usar, subir el archivo
    if (bucketToUse) {
      console.log(`📤 Subiendo archivo a bucket '${bucketToUse}', ruta: ${filePath}`);
      
      const { data, error } = await supabaseAdmin.storage
        .from(bucketToUse)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: true
        });
      
      if (error) {
        throw new Error(`Error al subir archivo a Supabase Storage: ${error.message}`);
      }
      
      // Generar URL pública para el archivo
      const { data: urlData } = supabaseAdmin.storage
        .from(bucketToUse)
        .getPublicUrl(filePath);
      
      console.log(`✅ Archivo subido exitosamente a Supabase Storage: ${urlData.publicUrl}`);
      
      // Retornar información del archivo
      return {
        success: true,
        filePath: filePath,
        bucketName: bucketToUse,
        mimeType: mimeType,
        publicUrl: urlData.publicUrl,
        fileSize: buffer.length,
        originalName: fileName,
        storedIn: 'supabase'
      };
    } else {
      throw new Error('No se pudo encontrar ni crear un bucket para almacenar el archivo');
    }
  } catch (error) {
    console.log(`❌ Error general al subir archivo: ${error.message}`);
    throw error;
  }
}
```

### 4. Función para Descargar Imágenes desde URLs Externas

```javascript
// Función para descargar archivo desde una URL
async function downloadFileFromUrl(url) {
  try {
    console.log(`📥 Descargando archivo desde: ${url}`);
    
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer'
    });
    
    // Detectar el tipo MIME real
    const contentType = response.headers['content-type'];
    
    // Generar nombre de archivo basado en la URL si no hay información
    let fileName = url.split('/').pop();
    if (!fileName || fileName.indexOf('?') >= 0) {
      // Eliminar parámetros de URL si existen
      fileName = fileName?.split('?')[0] || `file-${Date.now()}`;
      
      // Agregar extensión basada en tipo MIME si no tiene
      if (!fileName.includes('.')) {
        const ext = contentType.split('/')[1];
        if (ext) {
          fileName += `.${ext}`;
        }
      }
    }
    
    console.log(`✅ Archivo descargado: ${fileName} (${contentType}, ${response.data.length} bytes)`);
    
    return {
      buffer: Buffer.from(response.data),
      mimeType: contentType,
      fileName: fileName,
      fileSize: response.data.length
    };
  } catch (error) {
    console.error(`❌ Error al descargar archivo: ${error.message}`);
    throw error;
  }
}
```

### 5. Modificar el Manejador de Mensajes para Detectar y Procesar Imágenes

```javascript
// Función para procesar un mensaje entrante de WhatsApp
async function processWhatsAppMessage(message) {
  try {
    // Extraer información del mensaje
    const { type, payload, sender } = message;
    const phone = sender.phone;
    
    // Buscar o crear conversación
    const conversationId = await findOrCreateConversation(phone);
    
    // Procesar según tipo de mensaje
    if (type === 'text') {
      // Procesar mensaje de texto (código existente)
      await saveTextMessage(conversationId, payload.text, 'user');
      
    } else if (type === 'image' || type === 'file' || type === 'video' || type === 'audio') {
      // Procesar mensaje con archivo/media
      await processMediaMessage(conversationId, phone, type, payload);
    }
    
    // Resto del código para manejar respuestas del bot, etc.
  } catch (error) {
    console.error('Error procesando mensaje de WhatsApp:', error);
  }
}

// Función para procesar mensajes con archivos multimedia
async function processMediaMessage(conversationId, phone, messageType, payload) {
  try {
    console.log(`📱 Recibido mensaje ${messageType} de ${phone}`);
    
    // URL de la imagen o archivo recibido
    const mediaUrl = payload.url;
    const caption = payload.caption || '';
    
    if (!mediaUrl) {
      console.error('❌ URL de media no encontrada en el payload');
      return;
    }
    
    // Descargar el archivo desde la URL proporcionada por WhatsApp/Gupshup
    const downloadedFile = await downloadFileFromUrl(mediaUrl);
    
    // Subir el archivo a Supabase Storage
    const fileInfo = await uploadBufferToSupabase(
      downloadedFile.buffer,
      downloadedFile.fileName,
      downloadedFile.mimeType,
      conversationId
    );
    
    // Crear mensaje en la base de datos
    const messageData = {
      conversation_id: conversationId,
      content: caption || `[${messageType}]`, // Usar el caption como contenido si existe
      media_url: fileInfo.publicUrl,
      media_type: downloadedFile.mimeType,
      sender_type: 'user', // Los mensajes recibidos siempre son de 'user'
      file_name: downloadedFile.fileName,
      file_size: downloadedFile.fileSize,
      file_path: fileInfo.filePath,
      storage_type: 'supabase'
    };
    
    // Insertar en base de datos
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();
    
    if (messageError) {
      console.error(`❌ Error al guardar mensaje con ${messageType}: ${messageError.message}`);
      return;
    }
    
    console.log(`✅ Mensaje ${messageType} guardado exitosamente para conversación ${conversationId}`);
    
    // Si es necesario, procesar con el bot
    if (shouldProcessWithBot(conversationId)) {
      // Enviar al bot para procesamiento, incluyendo la URL de la imagen
      await processWithChatBot(conversationId, caption || `[Usuario envió ${messageType}]`, fileInfo.publicUrl);
    }
  } catch (error) {
    console.error(`❌ Error procesando mensaje ${messageType}:`, error);
  }
}
```

### 6. Modificar el Endpoint del Webhook de Gupshup

Asegúrate de que el endpoint que recibe notificaciones de Gupshup esté preparado para manejar varios tipos de mensajes:

```javascript
app.post('/webhook/gupshup', (req, res) => {
  try {
    console.log('📨 Webhook de Gupshup recibido:', JSON.stringify(req.body));
    
    // Verificar si es un mensaje
    const payload = req.body;
    
    // Extraer tipo de mensaje y datos según la estructura de Gupshup
    // (Ajustar según documentación específica de la API que estés usando)
    
    if (payload.type === 'message') {
      const messageData = {
        type: payload.payload.type, // 'text', 'image', 'file', etc.
        payload: payload.payload,
        sender: {
          phone: payload.sender.phone
        }
      };
      
      // Procesar asincrónicamente (sin bloquear la respuesta)
      processWhatsAppMessage(messageData).catch(err => {
        console.error('Error procesando mensaje de webhook:', err);
      });
    }
    
    // Responder rápidamente al webhook
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error en webhook de Gupshup:', error);
    res.status(500).send('Error procesando webhook');
  }
});
```

## Prueba y Verificación

1. Implementa estos cambios en el servidor de Render
2. Prueba enviando una imagen desde WhatsApp al número de negocio
3. Verifica en la base de datos que se crea un mensaje con la URL de la imagen
4. Abre el dashboard y comprueba que la imagen se muestra correctamente
5. Envía una imagen desde el dashboard y verifica que llega a WhatsApp

## Notas Adicionales

- Asegúrate de que las variables de entorno `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` estén configuradas correctamente en Render
- Considera implementar manejo de errores más robusto y reintentos para las descargas y subidas de archivos
- Ajusta los límites de tamaño según tus necesidades y plan de Supabase
- Recuerda que esta implementación es para archivos de hasta 10MB, que es adecuado para la mayoría de imágenes de WhatsApp 