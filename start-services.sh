#!/bin/bash

# Script para iniciar los servicios necesarios para pruebas
echo "🚀 Iniciando servicios para el entorno de pruebas..."

# Configuraciones
export PORT=7777
export WHATSAPP_BOT_URL=http://localhost:3095
export SERVER_URL=http://localhost:7777
export NODE_ENV=development

# Función para iniciar el servidor backend de WhatsApp
start_whatsapp_bot() {
  echo "📱 Iniciando servidor de WhatsApp en puerto 3095..."
  cd "/Users/nan/Desktop/dasboard_copia2.1 2/whatsapp-bot-main" && PORT=3095 node manual-endpoint.js &
  WHATSAPP_PID=$!
  echo "✅ Servidor de WhatsApp iniciado con PID: $WHATSAPP_PID"
  sleep 2
}

# Función para iniciar el servidor backend principal
start_server() {
  echo "🖥️ Iniciando servidor principal en puerto 7777..."
  cd "/Users/nan/Desktop/dasboard_copia2.1 2" && PORT=7777 WHATSAPP_BOT_URL=http://localhost:3095 node server.js &
  SERVER_PID=$!
  echo "✅ Servidor principal iniciado con PID: $SERVER_PID"
  sleep 2
}

# Función para ejecutar pruebas de notificación
run_notification_tests() {
  echo "🧪 Ejecutando pruebas de notificación..."
  cd "/Users/nan/Desktop/dasboard_copia2.1 2" && node test-notification.js
  echo "✅ Pruebas completadas"
}

# Iniciar servicios
start_whatsapp_bot
start_server

# Esperar a que los servicios estén listos
echo "⏳ Esperando a que los servicios estén listos..."
sleep 3

# Ejecutar pruebas
run_notification_tests

# Mantener los servicios corriendo
echo "🔄 Servicios en ejecución. Presiona Ctrl+C para detener todos los procesos."
wait 