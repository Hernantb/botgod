// Este archivo contiene las líneas a reemplazar en index.js

// 1. Mantener solo la primera declaración de MESSAGE_EXPIRE_TIME (línea 50)
// Variables globales para el servidor
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
// const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTgwOTkxNzYsImV4cCI6MjAxMzY3NTE3Nn0.B_LQ2_2jUIZ1PvR1_ObQ-8fmVOaOY0jXkYa9KGbU9N0';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID || 'asst_bdJlX30wF1qQH3Lf8ZoiptVx';
const PORT = process.env.PORT || 3010;
let CONTROL_PANEL_URL = process.env.CONTROL_PANEL_URL || 'https://whatsapp-bot-main.onrender.com/register-bot-response';
const BUSINESS_ID = process.env.BUSINESS_ID || '2d385aa5-40e0-4ec9-9360-19281bc605e4';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'verify_token_whatsapp_webhook';
const MESSAGE_EXPIRE_TIME = 24 * 60 * 60 * 1000; // 24 horas para expiración de mensajes procesados

// 2. Reemplazar la segunda declaración (línea 97) con un comentario
// Set para almacenar mensajes procesados recientemente (evitar duplicados)
const recentlyProcessedMessages = new Set();

// 🗂 Almacena el historial de threads de usuarios
const userThreads = {};

// Función para actualizar/mantener los mapeos entre conversaciones y números telefónicos

// 3. Reemplazar la tercera declaración (línea 248) con un comentario
// Middleware para logs detallados
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// 🔃 Control de mensajes procesados para evitar duplicados 