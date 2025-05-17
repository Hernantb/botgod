#!/bin/bash

# Script para configurar notificaciones por correo
# Ejecuta este script con: bash setup-notifications.sh

# Colores para la salida
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== CONFIGURACIÓN DE NOTIFICACIONES POR CORREO ===${NC}"
echo ""

# 1. Verificar que nodemailer esté instalado
echo -e "${YELLOW}Verificando dependencias...${NC}"
if npm list | grep -q nodemailer; then
  echo -e "${GREEN}✓ nodemailer ya está instalado${NC}"
else
  echo -e "${YELLOW}Instalando nodemailer...${NC}"
  npm install --save nodemailer
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ nodemailer instalado correctamente${NC}"
  else
    echo -e "${RED}✗ Error al instalar nodemailer${NC}"
    exit 1
  fi
fi

echo ""

# 2. Verificar/crear variables de entorno
echo -e "${YELLOW}Configurando variables de entorno...${NC}"

# Verificar si el archivo .env existe
if [ ! -f .env ]; then
  echo -e "${YELLOW}Creando archivo .env...${NC}"
  touch .env
fi

# Función para añadir o actualizar una variable en .env
update_env_var() {
  local var_name=$1
  local var_value=$2
  local var_desc=$3
  
  # Verificar si la variable ya existe en .env
  if grep -q "^${var_name}=" .env; then
    echo -e "${YELLOW}La variable ${var_name} ya existe en .env${NC}"
    
    # Preguntar si quiere actualizarla
    read -p "¿Deseas actualizar esta variable? (s/n): " update_var
    if [[ $update_var == "s" || $update_var == "S" ]]; then
      # Actualizar la variable
      sed -i '' "s|^${var_name}=.*$|${var_name}=${var_value}|g" .env
      echo -e "${GREEN}✓ Variable ${var_name} actualizada${NC}"
    else
      echo -e "${YELLOW}Se mantiene la configuración actual para ${var_name}${NC}"
    fi
  else
    # Agregar la variable al .env
    echo -e "\n# ${var_desc}" >> .env
    echo "${var_name}=${var_value}" >> .env
    echo -e "${GREEN}✓ Variable ${var_name} agregada${NC}"
  fi
}

# Solicitar datos para configurar el correo
echo ""
echo -e "${YELLOW}Para enviar notificaciones por correo, necesitas configurar una cuenta de Gmail.${NC}"
echo -e "${YELLOW}Asegúrate de tener activada la verificación en dos pasos y generar una contraseña de aplicación.${NC}"
echo ""

# EMAIL_USER
read -p "Correo electrónico remitente (ej: tucorreo@gmail.com): " email_user
if [ -z "$email_user" ]; then
  echo -e "${RED}No se proporcionó un correo electrónico. Usando valor por defecto: bexorai@gmail.com${NC}"
  email_user="bexorai@gmail.com"
fi

# EMAIL_PASSWORD
read -p "Contraseña de aplicación (dejar vacío para mantener la actual): " email_password
if [ -z "$email_password" ]; then
  if ! grep -q "^EMAIL_PASSWORD=" .env; then
    echo -e "${RED}¡Advertencia! Sin contraseña configurada, las notificaciones no funcionarán.${NC}"
    email_password="tu-contraseña-de-aplicacion-aqui"
  else
    echo -e "${YELLOW}Se mantendrá la contraseña actual.${NC}"
    email_password="$(grep "^EMAIL_PASSWORD=" .env | cut -d '=' -f2)"
  fi
fi

# FALLBACK_EMAIL
read -p "Correo de respaldo para notificaciones: " fallback_email
if [ -z "$fallback_email" ]; then
  echo -e "${YELLOW}Usando correo remitente como respaldo${NC}"
  fallback_email=$email_user
fi

# BCC_EMAIL
read -p "Correo para copia oculta (BCC): " bcc_email
if [ -z "$bcc_email" ]; then
  echo -e "${YELLOW}No se enviará copia oculta${NC}"
  bcc_email=""
fi

# Actualizar las variables en .env
update_env_var "EMAIL_USER" "$email_user" "Correo electrónico remitente para notificaciones"
update_env_var "EMAIL_PASSWORD" "$email_password" "Contraseña de aplicación para el correo"
update_env_var "FALLBACK_EMAIL" "$fallback_email" "Correo de respaldo para notificaciones"

if [ ! -z "$bcc_email" ]; then
  update_env_var "BCC_EMAIL" "$bcc_email" "Correo para copia oculta (BCC)"
fi

echo ""
echo -e "${GREEN}✓ Variables de entorno configuradas.${NC}"

# 3. Mostrar información sobre SQL
echo ""
echo -e "${YELLOW}=== CONFIGURACIÓN DE BASE DE DATOS ===${NC}"
echo -e "${YELLOW}Para completar la configuración, ejecuta el script SQL 'add_notification_columns.sql' en el panel de Supabase:${NC}"
echo ""
echo -e "${GREEN}1. Abre el panel de Supabase${NC}"
echo -e "${GREEN}2. Ve a 'SQL Editor' o 'Editor SQL'${NC}"
echo -e "${GREEN}3. Copia y pega el contenido del archivo 'add_notification_columns.sql'${NC}"
echo -e "${GREEN}4. Ejecuta el script completo${NC}"
echo ""

# 4. Verificar si nodemon está instalado para reiniciar el servidor
echo -e "${YELLOW}=== REINICIO DEL SERVIDOR ===${NC}"
if type nodemon > /dev/null 2>&1; then
  echo -e "${GREEN}Si estás usando nodemon, reinicia el servidor para aplicar los cambios.${NC}"
else
  echo -e "${YELLOW}Para aplicar todos los cambios, reinicia el servidor con:${NC}"
  echo -e "${GREEN}  node server.js${NC}"
fi

echo ""
echo -e "${GREEN}=== CONFIGURACIÓN COMPLETADA ===${NC}"
echo -e "${GREEN}Usa 'node test-notification-real.js' para probar las notificaciones.${NC}" 