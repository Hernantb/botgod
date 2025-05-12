#!/bin/bash

# Script para configurar la verificación periódica de notificaciones
# Ejecuta este script con: bash notification-scheduler.sh

# Colores para la salida
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== CONFIGURACIÓN DE VERIFICACIÓN PERIÓDICA DE NOTIFICACIONES ===${NC}"
echo ""

# Ruta absoluta del proyecto
PROJECT_DIR=$(pwd)
CHECK_SCRIPT="${PROJECT_DIR}/check-pending-notifications.js"

# Verificar que existe el script de verificación
if [ ! -f "$CHECK_SCRIPT" ]; then
  echo -e "${RED}❌ Error: No se encuentra el archivo ${CHECK_SCRIPT}${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Script de verificación encontrado: ${CHECK_SCRIPT}${NC}"

# Verificar node
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Error: Node.js no está instalado. Por favor instálalo primero.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Node.js instalado correctamente${NC}"

# Crear script que ejecutará el código de verificación
WRAPPER_SCRIPT="${PROJECT_DIR}/run-notification-check.sh"

cat > "$WRAPPER_SCRIPT" << EOL
#!/bin/bash
# Script generado automáticamente para ejecutar la verificación de notificaciones
cd ${PROJECT_DIR}
node ${CHECK_SCRIPT} >> ${PROJECT_DIR}/notification-check.log 2>&1
EOL

chmod +x "$WRAPPER_SCRIPT"
echo -e "${GREEN}✅ Script de ejecución creado: ${WRAPPER_SCRIPT}${NC}"

# Configurar cron
echo -e "\n${YELLOW}¿Deseas configurar una tarea cron para verificar notificaciones periódicamente?${NC}"
read -p "Escribe 's' para confirmar o cualquier otra tecla para omitir: " setup_cron

if [[ "$setup_cron" == "s" || "$setup_cron" == "S" ]]; then
  echo -e "\n${YELLOW}¿Con qué frecuencia quieres verificar las notificaciones pendientes?${NC}"
  echo "1) Cada 15 minutos"
  echo "2) Cada 30 minutos"
  echo "3) Cada hora"
  echo "4) Cada 4 horas"
  echo "5) Una vez al día"
  read -p "Selecciona una opción (1-5): " cron_option
  
  case $cron_option in
    1) cron_time="*/15 * * * *" ;;
    2) cron_time="*/30 * * * *" ;;
    3) cron_time="0 * * * *" ;;
    4) cron_time="0 */4 * * *" ;;
    5) cron_time="0 0 * * *" ;;
    *) cron_time="0 */2 * * *" ;;  # Por defecto, cada 2 horas
  esac
  
  # Verificar si ya existe una entrada para este script
  current_crontab=$(crontab -l 2>/dev/null || echo "")
  if [[ "$current_crontab" == *"$WRAPPER_SCRIPT"* ]]; then
    echo -e "${YELLOW}Ya existe una entrada cron para este script. Se actualizará.${NC}"
    new_crontab=$(echo "$current_crontab" | grep -v "$WRAPPER_SCRIPT")
  else
    new_crontab="$current_crontab"
  fi
  
  # Agregar la nueva entrada cron
  new_crontab="${new_crontab}\n${cron_time} ${WRAPPER_SCRIPT} # Verificar notificaciones pendientes"
  
  # Guardar la nueva configuración cron
  echo -e "$new_crontab" | crontab -
  
  echo -e "\n${GREEN}✅ Tarea cron configurada para ejecutarse: ${cron_time}${NC}"
  echo -e "${GREEN}✅ Ejecutando: ${WRAPPER_SCRIPT}${NC}"
else
  echo -e "\n${YELLOW}No se configuró tarea cron. Puedes ejecutar manualmente:${NC}"
  echo -e "${GREEN}node ${CHECK_SCRIPT}${NC}"
fi

echo -e "\n${GREEN}=== CONFIGURACIÓN COMPLETADA ===${NC}"
echo -e "${YELLOW}Los logs de verificación se guardarán en: ${PROJECT_DIR}/notification-check.log${NC}"
echo -e "${YELLOW}Para ejecutar una verificación manualmente: ${GREEN}${WRAPPER_SCRIPT}${NC}" 