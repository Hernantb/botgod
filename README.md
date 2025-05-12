# WhatsApp Bot con OpenAI y GupShup

Un bot de WhatsApp que utiliza OpenAI para generar respuestas inteligentes y se conecta a WhatsApp mediante la API de GupShup. Incluye sistema de notificaciones y almacenamiento de conversaciones con Supabase.

## Características

- ✅ Integración con WhatsApp usando GupShup
- ✅ Procesamiento de mensajes con OpenAI (usando la API de Asistentes v2)
- ✅ Almacenamiento de conversaciones en Supabase (opcional)
- ✅ Sistema de notificaciones por correo electrónico
- ✅ Endpoints para pruebas y diagnóstico
- ✅ Preparado para despliegue en Render

## Requisitos previos

- Node.js v16 o superior
- Cuenta y credenciales de GupShup
- API Key de OpenAI
- Base de datos Supabase (opcional)
- Cuenta de SendGrid o servidor SMTP para notificaciones

## Configuración rápida

1. **Clonar el repositorio**

```bash
git clone https://github.com/tu-usuario/whatsapp-bot.git
cd whatsapp-bot
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar variables de entorno**

Copia `.env.render` a `.env` y completa las variables:

```bash
cp .env.render .env
```

Edita el archivo `.env` con tus credenciales:

```
# GupShup
GUPSHUP_API_KEY=tu-api-key
GUPSHUP_NUMBER=tu-numero
GUPSHUP_USERID=tu-userid

# OpenAI
OPENAI_API_KEY=tu-api-key-openai

# Supabase (opcional)
SUPABASE_URL=tu-url-supabase
SUPABASE_KEY=tu-key-supabase

# Notificaciones
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=tu-api-key-sendgrid
SMTP_FROM="WhatsApp Bot <notificaciones@ejemplo.com>"
NOTIFICATION_EMAILS=correo1@ejemplo.com,correo2@ejemplo.com

# URLs de servicios
CONTROL_PANEL_URL=url-de-tu-panel-de-control

# Otros ajustes
PORT=3095
LOG_LEVEL=info
FORCE_SAVE_TO_SUPABASE=true
```

4. **Iniciar el servidor**

Para desarrollo:
```bash
npm run dev
```

Para producción:
```bash
npm start
```

## Despliegue en Render

### Opción 1: Despliegue automático (recomendado)

Puedes desplegar directamente desde GitHub utilizando el archivo `render.yaml`:

1. Sube tu código a GitHub
2. En Render, selecciona "New Blueprint"
3. Conecta tu repositorio de GitHub
4. Render detectará automáticamente la configuración en `render.yaml`
5. Configura las variables de entorno necesarias
6. ¡Listo! Tu bot estará desplegado automáticamente

### Opción 2: Despliegue manual

1. Crea un nuevo Web Service en Render
2. Conecta tu repositorio de GitHub
3. Configura los siguientes parámetros:
   - **Nombre**: `whatsapp-bot` (o el que prefieras)
   - **Entorno**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (o el que necesites)

4. Configura las variables de entorno en el panel de Render (ver `.env.render`)

5. Despliega el servicio y verifica que esté funcionando visitando la URL + `/health`

## Endpoints disponibles

- **GET /health**: Verificar estado del servidor
- **GET /status**: Obtener información detallada
- **GET /diagnostico**: Realizar diagnóstico del sistema
- **POST /api/send-manual-message**: Enviar mensaje manual a WhatsApp
- **GET /test-message**: Probar envío de mensajes
- **GET /test-notification**: Probar sistema de notificaciones

## Solución de problemas

### Error con Supabase

Si ves errores como `supabaseKey is required`:
- Asegúrate de que `SUPABASE_URL` y `SUPABASE_KEY` estén configurados correctamente
- Si no usas Supabase, el sistema está preparado para funcionar sin él

### Error al conectar con GupShup

Si no puedes enviar mensajes a WhatsApp:
- Verifica que `GUPSHUP_API_KEY`, `GUPSHUP_NUMBER` y `GUPSHUP_USERID` sean correctos
- Asegúrate de que tu cuenta de GupShup esté activa
- Comprueba que el número esté correctamente registrado en GupShup

### Errores con las notificaciones por correo

Si las notificaciones no se envían:
- Verifica las credenciales de SMTP
- Si usas SendGrid, confirma que la API key tenga permisos para enviar correos
- Prueba el endpoint `/test-notification` para diagnosticar problemas

### Conflictos de puerto

Si hay problemas al iniciar el servidor por conflictos de puerto:
- El servidor usa el puerto definido en la variable `PORT` (por defecto 3095)
- Puedes cambiar el puerto editando la variable de entorno `PORT`

## Mantenimiento

Para actualizar el bot:
1. Haz tus cambios en el código
2. Sube los cambios a GitHub
3. Render se actualizará automáticamente (si tienes Auto-Deploy activado)

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o pull request para sugerencias o mejoras.

## Licencia

Este proyecto está licenciado bajo la licencia ISC.
