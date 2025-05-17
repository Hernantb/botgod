#!/bin/bash

# ID de conversación a utilizar (usar uno que exista en tu base de datos)
CONVERSATION_ID="4a42aa05-2ffd-418b-aa52-29e7c571eee8"

# Mensaje de prueba
CAPTION="Imagen de prueba para Supabase Storage desde curl"

# Ruta a la imagen de prueba
IMAGE_PATH="./test-image.jpg"

echo "Enviando imagen a WhatsApp para conversación $CONVERSATION_ID"

# Enviar la solicitud usando curl
curl -X POST \
  -F "mediaFile=@$IMAGE_PATH" \
  -F "conversationId=$CONVERSATION_ID" \
  -F "caption=$CAPTION" \
  http://localhost:3010/api/send-whatsapp-media

echo
echo "Solicitud completada" 