/**
 * SCRIPT PARA AGREGAR COLUMNA STATUS A LA TABLA CONVERSATIONS
 * 
 * Este script añade la columna 'status' a la tabla 'conversations'
 * para permitir clasificar las conversaciones como 'important'
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Cargar configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2lqa3h3ZXZneGJnd2hicXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MjI3NjgsImV4cCI6MjA1NzM5ODc2OH0._HSnvof7NUk6J__qqq3gJvbJRZnItCAmlI5HYAL8WVI';

// Inicializar cliente Supabase
console.log('🔄 Conectando a Supabase...');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false
  }
});

async function addStatusColumn() {
  console.log('🔧 Intentando agregar columna status a tabla conversations...');
  
  try {
    // Primero, verificar si existe el procedimiento para agregar columnas
    try {
      const { data, error } = await supabase.rpc('add_column_if_not_exists', {
        table_name: 'conversations',
        column_name: 'status',
        column_type: 'text'
      });
      
      if (!error) {
        console.log('✅ Columna status agregada exitosamente usando RPC');
        return true;
      } else {
        console.log('⚠️ Error usando RPC, intentando método alternativo:', error.message);
      }
    } catch (rpcError) {
      console.log('⚠️ RPC add_column_if_not_exists no disponible:', rpcError.message);
    }
    
    // Intento alternativo: ejecutar SQL directo
    try {
      // Este método solo funcionará si hay permisos de administrador
      const { error: sqlError } = await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE conversations 
          ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'normal';
          
          -- Refrescar el schema cache para Supabase
          NOTIFY pgrst, 'reload schema';
        `
      });
      
      if (!sqlError) {
        console.log('✅ Columna status agregada exitosamente usando SQL');
        return true;
      } else {
        console.log('⚠️ Error ejecutando SQL directo:', sqlError.message);
      }
    } catch (sqlError) {
      console.log('⚠️ No se pudo ejecutar SQL directo:', sqlError.message);
    }
    
    // Intento final: hacer un update y ver si la columna ya existe
    try {
      console.log('🔄 Verificando si la columna ya existe...');
      const { error: checkError } = await supabase
        .from('conversations')
        .update({ status: 'normal' })
        .eq('id', '00000000-0000-0000-0000-000000000000');
      
      if (!checkError || checkError.code === 'PGRST116') {
        console.log('✅ La columna status ya existe o la actualización funcionó');
        return true;
      } else if (checkError.message && checkError.message.includes('column "status" does not exist')) {
        console.error('❌ La columna status realmente no existe y no se pudo crear');
        return false;
      } else {
        console.log('⚠️ Error verificando columna:', checkError.message);
        return false;
      }
    } catch (checkError) {
      console.error('❌ Error final verificando columna:', checkError.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
    return false;
  }
}

// Ejecutar función principal
addStatusColumn()
  .then(success => {
    if (success) {
      console.log('✅ El proceso finalizó exitosamente');
      // Actualizar conversaciones existentes
      return supabase
        .from('conversations')
        .update({ status: 'normal' })
        .is('status', null)
        .then(() => {
          console.log('✅ Conversaciones existentes actualizadas con status="normal"');
          process.exit(0);
        });
    } else {
      console.error('❌ No se pudo agregar la columna status');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Error inesperado:', error);
    process.exit(1);
  }); 