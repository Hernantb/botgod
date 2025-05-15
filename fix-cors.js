/**
 * Script para corregir configuración de CORS en el servidor
 * Este script modifica el archivo index.js para permitir peticiones CORS de cualquier origen en desarrollo
 */

const fs = require('fs');
const path = require('path');

// Obtener la configuración actual del env
require('dotenv').config();

// Orígenes permitidos para CORS
const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:3005',
  'http://localhost:5173',
  'https://whatsapp-bot-ifz.onrender.com',
  'https://whatsapp-bot-ifz.vercel.app',
  'https://whatsapp-bot-ifz.netlify.app'
];

// Leer orígenes adicionales del .env si existen
const corsEnvOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [];
const corsOrigins = [...defaultOrigins, ...corsEnvOrigins];

console.log('🔧 Configurando CORS para los siguientes orígenes:');
corsOrigins.forEach(origin => console.log(`  - ${origin}`));

// Función para crear/actualizar configuración CORS
function fixCors() {
  try {
    // Verificar que el archivo index.js existe
    const indexPath = path.join(__dirname, 'index.js');
    if (!fs.existsSync(indexPath)) {
      console.error('❌ El archivo index.js no existe en este directorio');
      return;
    }

    // Leer el contenido del archivo
    let content = fs.readFileSync(indexPath, 'utf8');

    // Buscar la configuración existente de CORS
    const corsRegex = /app\.use\(cors\(([^)]+)\)\);/;
    const corsMatch = content.match(corsRegex);

    // Nueva configuración de CORS
    const corsConfig = `app.use(cors({
  origin: function(origin, callback) {
    // Permitir solicitudes sin origen (como solicitudes de la misma máquina, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Lista de orígenes permitidos
    const allowedOrigins = ${JSON.stringify(corsOrigins)};
    
    // En desarrollo, permitir cualquier origen
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // En producción, verificar contra la lista
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.warn(\`⚠️ Solicitud CORS bloqueada desde origen: \${origin}\`);
      return callback(new Error('Origen no permitido por política CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));`;

    // Reemplazar la configuración existente o añadir nueva
    if (corsMatch) {
      console.log('🔄 Reemplazando configuración CORS existente...');
      content = content.replace(corsRegex, corsConfig);
    } else {
      console.log('➕ Añadiendo nueva configuración CORS...');
      
      // Buscar donde añadir (después de la creación de la app)
      const appRegex = /const app = express\(\);/;
      if (appRegex.test(content)) {
        content = content.replace(appRegex, `const app = express();\n\n// Configuración CORS\n${corsConfig}`);
      } else {
        console.error('❌ No se pudo encontrar la creación de la app Express');
        return;
      }
    }

    // Guardar el archivo actualizado
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log('✅ Configuración CORS actualizada correctamente');
    
    // También actualizar el .env si es necesario
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (!envContent.includes('CORS_ORIGINS=')) {
        envContent += `\nCORS_ORIGINS=${corsOrigins.join(',')}\n`;
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log('✅ Variable CORS_ORIGINS añadida al .env');
      }
    }
    
    console.log('🚀 Para aplicar los cambios, reinicia el servidor');
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

// Ejecutar la función
fixCors(); 