/**
 * Procesador mejorado para OpenAI con soporte para funciones de calendario
 * Este módulo maneja la comunicación con la API de OpenAI
 */

const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const { processFunctionCall, toolDefinitions, toolInstructions } = require('./lib/integration-helper');
require('dotenv').config();

// Configuración de OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://wscijkxwevgxbgwhbqtm.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Cache para ID de threads de usuarios
const userThreads = {};

// Función para obtener el ID del thread desde la estructura
function getThreadId(sender) {
    if (!userThreads[sender]) return null;
    return typeof userThreads[sender] === 'object' ? userThreads[sender].threadId : userThreads[sender];
}

/**
 * Obtiene la configuración del negocio desde Supabase
 * @param {string} businessId - ID del negocio
 * @returns {Promise<Object>} - Configuración del negocio
 */
async function getBusinessConfig(businessId) {
    try {
        // Buscar por ID principal, no por business_id
        const { data, error } = await supabase
            .from('business_config')
            .select('*')
            .eq('id', businessId)
            .single();
            
        if (error) {
            console.error('❌ Error obteniendo configuración de negocio:', error.message);
            return null;
        }
        
        return data;
    } catch (err) {
        console.error('❌ Error en getBusinessConfig:', err.message);
        return null;
    }
}

/**
 * Procesa un mensaje de usuario con OpenAI y devuelve una respuesta
 * @param {string} sender - Número de teléfono o ID del remitente
 * @param {string} message - Mensaje del usuario
 * @param {string} conversationId - ID de la conversación (opcional)
 * @param {string} businessId - ID del negocio (opcional)
 * @returns {Promise<string>} - Respuesta generada
 */
async function processMessageWithOpenAI(sender, message, conversationId, businessId = process.env.BUSINESS_ID) {
    console.log(`🟢 [LOG] Mensaje recibido para procesar: sender=${sender}, message="${message}", conversationId=${conversationId}, businessId=${businessId}`);
    try {
        console.log(`🤖 Procesando mensaje de ${sender} con OpenAI: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
        console.log(`🏢 Business ID recibido: ${businessId || 'NO DEFINIDO'}`);
        console.log(`☎️ Número de teléfono del remitente: ${sender}`);
        
        // Obtener configuración del negocio (si está disponible)
        const businessConfig = await getBusinessConfig(businessId);
        console.log(`🏢 Usando configuración de negocio: ${businessConfig ? 'ENCONTRADA' : 'NO ENCONTRADA'}`);
        
        // Añadir log para depuración
        console.log(`🔍 Contenido de businessConfig:`, JSON.stringify(businessConfig || {}, null, 2));
        
        // ID del Asistente a usar - Asegurar que se use primero el de la base de datos
        let ASSISTANT_ID;
        
        // Validar explícitamente que el campo existe y tiene contenido
        if (businessConfig && typeof businessConfig.openai_assistant_id === 'string' && businessConfig.openai_assistant_id.trim() !== '') {
            ASSISTANT_ID = businessConfig.openai_assistant_id.trim();
            console.log(`✅ Usando ID de asistente específico de la configuración del negocio: ${ASSISTANT_ID}`);
        } else {
            ASSISTANT_ID = process.env.ASSISTANT_ID || 'asst_bdJlX30wF1qQH3Lf8ZoiptVx';
            console.log(`⚠️ No se encontró ID de asistente en la configuración, usando valor por defecto: ${ASSISTANT_ID}`);
        }
        
        console.log(`🔑 Usando asistente ID: ${ASSISTANT_ID}`);
        
        // Obtener o crear un thread para este usuario
        // Almacenar el ID del asistente junto con el thread para saber si ha cambiado
        if (!userThreads[sender] || 
            (userThreads[sender].assistantId && userThreads[sender].assistantId !== ASSISTANT_ID)) {
            // Solo crear un nuevo thread si no existe o si el ID del asistente ha cambiado
            console.log(`🧵 ${userThreads[sender] ? 'Recreando (cambió el asistente)' : 'Creando nuevo'} thread para usuario ${sender}`);
            const thread = await openai.beta.threads.create();
            userThreads[sender] = {
                threadId: thread.id,
                assistantId: ASSISTANT_ID
            };
            console.log(`✅ Thread creado con ID: ${thread.id} para asistente ${ASSISTANT_ID}`);
        } else if (!userThreads[sender].assistantId) {
            // Actualizar la estructura si solo teníamos el ID del thread guardado (compatibilidad)
            userThreads[sender] = {
                threadId: userThreads[sender],
                assistantId: ASSISTANT_ID
            };
            console.log(`🔄 Actualizado formato de thread para usuario ${sender}`);
        }
        
        const threadId = getThreadId(sender);
        console.log(`🧵 Usando thread ${threadId} para usuario ${sender}`);
        
        // Añadir el mensaje al thread
        await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: message
        });
        
        // Configuración para el run
        const runOptions = {
            assistant_id: ASSISTANT_ID,
            tools: toolDefinitions,
        };
        
        console.log(`🏃‍♂️ Ejecutando asistente ${ASSISTANT_ID} para thread ${threadId}`);
        
        // Iniciar el run con las herramientas definidas
        const run = await openai.beta.threads.runs.create(threadId, runOptions);
        
        // Esperar a que termine el procesamiento
        let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
        let attempts = 0;
        const maxAttempts = 15; // Máximo 15 intentos (30 segundos)
        
        console.log(`🔄 Estado inicial del run: ${runStatus.status}`);
        
        while (
            runStatus.status !== 'completed' && 
            runStatus.status !== 'failed' && 
            attempts < maxAttempts
        ) {
            // Si el asistente necesita llamar a una función
            if (runStatus.status === 'requires_action') {
                console.log(`🔄 El asistente requiere acción: llamada a función`);
                
                // Obtener las herramientas que necesita ejecutar
                const actions = runStatus.required_action.submit_tool_outputs.tool_calls;
                const toolOutputs = [];
                
                // Procesar cada llamada a función
                for (const action of actions) {
                    const functionName = action.function.name;
                    const functionArgs = JSON.parse(action.function.arguments);
                    
                    console.log(`🔧 Llamada a función: ${functionName}`, functionArgs);
                    console.log(`🔍 businessId recibido en functionArgs:`, functionArgs.businessId);
                    console.log(`🔍 businessId recibido en contexto:`, businessId);
                    console.log(`🔍 Teléfono remitente disponible:`, sender);
                    try {
                        // Añadir o reemplazar businessId si no está presente o es 'default'
                        if (functionArgs.businessId === undefined || !functionArgs.businessId || functionArgs.businessId === 'default') {
                            functionArgs.businessId = businessId;
                            console.log(`✅ businessId ${functionArgs.businessId ? 'reemplazado' : 'insertado'} automáticamente: ${businessId}`);
                        }
                        
                        // Para funciones específicas de calendario, asegurarse de usar el businessId correcto
                        if (['get_calendar_info', 'schedule_appointment', 'check_calendar_availability', 'create_calendar_event', 'find_customer_appointments', 'delete_calendar_event'].includes(functionName)) {
                            // Siempre forzar el businessId correcto para funciones de calendario
                            if (functionArgs.businessId !== businessId) {
                                console.log(`⚠️ Reemplazando businessId de calendario (${functionArgs.businessId}) con el correcto: ${businessId}`);
                                functionArgs.businessId = businessId;
                            }
                        }
                        
                        // Rellenar el teléfono automáticamente si es schedule_appointment
                        if (functionName === 'schedule_appointment' && functionArgs.eventDetails) {
                            if (!functionArgs.eventDetails.phone || functionArgs.eventDetails.phone === '') {
                                functionArgs.eventDetails.phone = sender;
                                console.log(`✅ Teléfono del remitente insertado automáticamente: ${sender}`);
                            }
                        }
                        // Rellenar el teléfono en todos los casos para phoneNumber
                        if (functionArgs.phoneNumber === undefined || !functionArgs.phoneNumber) {
                            functionArgs.phoneNumber = sender;
                            console.log(`✅ phoneNumber insertado automáticamente: ${sender}`);
                        }
                        // Llamar a la función externa
                        const functionResult = await processFunctionCall(functionName, functionArgs);
                        console.log(`✅ Resultado de función ${functionName}:`, JSON.stringify(functionResult).substring(0, 200));
                        // Añadir el resultado a las salidas de herramientas
                        toolOutputs.push({
                            tool_call_id: action.id,
                            output: JSON.stringify(functionResult)
                        });
                    } catch (functionError) {
                        console.error(`❌ Error ejecutando función ${functionName}:`, functionError);
                        // Enviar error como respuesta
                        toolOutputs.push({
                            tool_call_id: action.id,
                            output: JSON.stringify({ error: functionError.message })
                        });
                    }
                }
                
                // Enviar los resultados de las herramientas
                await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
                    tool_outputs: toolOutputs
                });
            }
            
            // Esperar 2 segundos antes de consultar nuevamente
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
            
            // Verificar estado actualizado
            runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
            console.log(`🔄 Estado actual del run (intento ${attempts}): ${runStatus.status}`);
        }
        
        // Verificar si se completó correctamente
        if (runStatus.status !== 'completed') {
            console.error(`❌ El run no se completó correctamente: ${runStatus.status}`);
            return "Lo siento, tuve un problema procesando tu mensaje. Por favor, intenta nuevamente en unos momentos.";
        }
        
        // Obtener respuesta del asistente
        const messages = await openai.beta.threads.messages.list(threadId);
        
        // Filtrar solo los mensajes del asistente para este run
        const assistantMessages = messages.data
            .filter(msg => msg.role === "assistant")
            .filter(msg => msg.run_id === run.id);
        
        if (assistantMessages.length === 0) {
            console.log('❌ No se encontraron respuestas del asistente');
            return "Lo siento, no pude generar una respuesta adecuada. Por favor, intenta nuevamente.";
        }
        
        // Obtener la respuesta más reciente
        const responseMessage = assistantMessages[0];
        let response = '';
        
        // Procesar el contenido del mensaje (puede ser texto o citas de herramientas)
        for (const content of responseMessage.content) {
            if (content.type === 'text') {
                response += content.text.value;
            }
        }
        
        console.log(`✅ Respuesta del asistente: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);
        return response;
        
    } catch (error) {
        console.error(`❌ Error en processMessageWithOpenAI:`, error);
        return "Lo siento, ha ocurrido un error inesperado. Por favor, intenta nuevamente más tarde.";
    }
}

module.exports = {
    processMessageWithOpenAI
}; 