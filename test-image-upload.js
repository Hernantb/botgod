const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// ID de conversación a utilizar (usar uno que exista en tu base de datos)
const conversationId = '4a42aa05-2ffd-418b-aa52-29e7c571eee8';

// Ruta a una imagen de prueba (ajustar según sea necesario)
const imagePath = path.join(__dirname, 'test-image.jpg');

// Si no existe la imagen de prueba, crear un archivo vacío de 1KB
if (!fs.existsSync(imagePath)) {
  console.log(`Creando imagen de prueba en ${imagePath}`);
  const buffer = Buffer.alloc(1024);
  buffer.fill(0);
  fs.writeFileSync(imagePath, buffer);
  console.log('Imagen de prueba creada');
}

async function testImageUpload() {
  try {
    // Crear form data
    const form = new FormData();
    form.append('mediaFile', fs.createReadStream(imagePath));
    form.append('conversationId', conversationId);
    form.append('caption', 'Imagen de prueba para Supabase Storage');

    console.log(`Enviando imagen a WhatsApp para conversación ${conversationId}`);
    
    // Configurar los headers correctos para el form data
    const headers = {
      ...form.getHeaders(),
    };

    // Enviar la solicitud
    const response = await axios.post('http://localhost:3010/api/send-whatsapp-media', form, {
      headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('Respuesta del servidor:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('✅ Imagen subida y enviada correctamente');
      console.log(`URL de la imagen: ${response.data.fileUrl}`);
    } else {
      console.log('❌ Error al enviar la imagen');
      console.log(`Error: ${response.data.error || 'Desconocido'}`);
    }

  } catch (error) {
    console.error('Error al realizar la solicitud:');
    if (error.response) {
      console.error(`Estado: ${error.response.status}`);
      console.error(`Datos: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(error.message);
    }
  }
}

testImageUpload(); 