# Bot de WhatsApp

Bot de WhatsApp con funcionalidades avanzadas y integración con OpenAI.

## Características principales

- Integración con la API de WhatsApp a través de GupShup
- Procesamiento de mensajes con OpenAI
- Gestión de conversaciones en Supabase
- Funcionalidades de notificación por correo
- Integración con Google Calendar para gestión de citas

## Configuración

Para configurar el proyecto, es necesario:

1. Configurar las variables de entorno en un archivo `.env`
2. Iniciar el servidor con `node index.js`

## Seguridad

Este proyecto utiliza claves de API y credenciales que deben mantenerse seguras. Nunca subas archivos `.env`, claves o tokens a repositorios públicos.

## Recientes mejoras

- Desactivada la funcionalidad de mensajes de estado (typing/presence) para evitar que aparezcan como mensajes en la conversación
- Correcciones en la integración con Google Calendar
- Optimización del manejo de threads con OpenAI
- Mejoras en la agrupación de mensajes (4.5s)
- Soporte para mensajes desde el dashboard
