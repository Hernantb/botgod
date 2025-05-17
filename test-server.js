// Simple test server to simulate the WhatsApp bot
const express = require('express');
const cors = require('cors');

// Puerto de escucha
const PORT = process.env.PORT || 3095;

// Mock de las funciones de notificación en lugar de importar el módulo real
// Esto evita la dependencia de Supabase que causa errores
const mockNotificationFunctions = {
  checkForNotificationPhrases: (message, source = 'bot') => {
    console.log(`🔍 Simulando verificación de frases para notificación en mensaje: "${message}"`);
    
    // Lista simple de frases para simular la detección
    const botPhrases = [
      "no puedo ayudarte con eso",
      "necesitas hablar con un agente humano",
      "te voy a transferir",
      "esto está fuera de mi alcance"
    ];
    
    const userPhrases = [
      "hablar con humano",
      "quiero una persona real",
      "esto es urgente",
      "necesito ayuda urgente"
    ];

    // Determinar qué conjunto de frases usar basado en la fuente
    const phrasesToCheck = source.toLowerCase() === 'user' ? userPhrases : botPhrases;
    
    // Buscar coincidencias
    const matches = [];
    const lowerMessage = message.toLowerCase();
    
    for (const phrase of phrasesToCheck) {
      if (lowerMessage.includes(phrase)) {
        matches.push(phrase);
      }
    }
    
    return {
      requiresNotification: matches.length > 0,
      matches,
      source: source.toUpperCase()
    };
  },
  
  processMessageForNotification: async (message, source, conversationId, clientPhoneNumber) => {
    console.log(`🔄 Simulando procesamiento de mensaje para notificación`);
    console.log(`📱 Número: ${clientPhoneNumber}`);
    console.log(`💬 Conversación: ${conversationId}`);
    console.log(`📝 Mensaje: "${message}"`);
    
    const analysis = mockNotificationFunctions.checkForNotificationPhrases(message, source);
    
    if (analysis.requiresNotification) {
      console.log(`⚠️ El mensaje requiere notificación. Coincidencias: ${analysis.matches.join(', ')}`);
      
      try {
        const notificationResult = await mockNotificationFunctions.sendBusinessNotification(
          conversationId,
          message,
          clientPhoneNumber
        );
        
        return {
          success: true,
          requiresNotification: true,
          notificationSent: notificationResult,
          phoneNumber: clientPhoneNumber
        };
      } catch (error) {
        console.error(`❌ Error al enviar notificación: ${error.message}`);
        return {
          success: false,
          requiresNotification: true,
          notificationSent: false,
          error: error.message
        };
      }
    } else {
      console.log(`ℹ️ El mensaje no requiere notificación`);
      return { 
        success: true, 
        requiresNotification: false 
      };
    }
  },
  
  sendBusinessNotification: async (conversationId, message, phoneNumber) => {
    console.log(`📧 Simulando envío de notificación por correo`);
    console.log(`📱 Número: ${phoneNumber}`);
    console.log(`💬 Conversación: ${conversationId}`);
    console.log(`📝 Mensaje: "${message}"`);
    
    // Simular un tiempo de espera para el envío
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // En modo test, siempre retornamos éxito
    console.log(`✅ Notificación enviada con éxito (simulación)`);
    return true;
  }
};

// En lugar de importar desde notification-patch, usamos las funciones mock
const { 
  checkForNotificationPhrases, 
  processMessageForNotification, 
  sendBusinessNotification 
} = mockNotificationFunctions;

// Inicializar Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    message: 'WhatsApp Bot test server is running'
  });
});

// Test endpoint for notification system
app.get('/test-notification', async (req, res) => {
  try {
    // Get parameters from query string
    const message = req.query.message || 'no puedo ayudarte con eso';
    const phoneNumber = req.query.phone || '123456789';
    const conversationId = req.query.conversation || 'test-conversation-1';
    const forceNotification = req.query.force === 'true';
    
    console.log(`🔍 Testing notification with message: "${message}"`);
    console.log(`📱 Phone number: ${phoneNumber}`);
    console.log(`💬 Conversation ID: ${conversationId}`);
    
    // Check if message requires notification
    const analysis = checkForNotificationPhrases(message);
    const requiresNotification = forceNotification || analysis.requiresNotification;
    
    console.log(`🔔 Requires notification: ${requiresNotification ? 'YES' : 'NO'}`);
    if (analysis.matches && analysis.matches.length > 0) {
      console.log(`🔍 Matching phrases: ${analysis.matches.join(', ')}`);
    }
    
    let notificationResult = null;
    
    // If notification is required, send it
    if (requiresNotification) {
      console.log('📧 Sending test notification...');
      notificationResult = await sendBusinessNotification(conversationId, message, phoneNumber);
      console.log(`✉️ Notification sent: ${notificationResult ? 'SUCCESS' : 'FAILED'}`);
    }
    
    // Return the result
    res.json({
      success: true,
      messageAnalyzed: message,
      phoneNumber,
      conversationId,
      analysis: {
        requiresNotification: analysis.requiresNotification,
        matches: analysis.matches || [],
        source: analysis.source
      },
      forceNotification,
      notificationSent: requiresNotification,
      notificationResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error in test-notification endpoint: ${error.message}`);
    console.error(error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Test endpoint to process a message with notification check
app.get('/test-process-message', async (req, res) => {
  try {
    // Get parameters from query string
    const message = req.query.message || 'no puedo ayudarte con eso';
    const phoneNumber = req.query.phone || '123456789';
    const conversationId = req.query.conversation || 'test-conversation-1';
    const source = req.query.source || 'bot';
    
    console.log(`🔍 Testing message processing with: "${message}"`);
    console.log(`📱 Phone number: ${phoneNumber}`);
    console.log(`💬 Conversation ID: ${conversationId}`);
    console.log(`🔄 Source: ${source}`);
    
    // Process the message
    const result = await processMessageForNotification(message, source, conversationId, phoneNumber);
    
    // Return the result
    res.json({
      success: true,
      messageProcessed: message,
      phoneNumber,
      conversationId,
      source,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error in test-process-message endpoint: ${error.message}`);
    console.error(error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Complete test endpoint that simulates the entire WhatsApp message flow
app.post('/test-complete-flow', async (req, res) => {
  try {
    // Get parameters from request body
    const { 
      message, 
      phoneNumber, 
      conversationId, 
      saveToDatabase = true,
      checkNotification = true
    } = req.body;
    
    if (!message || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Message and phoneNumber are required'
      });
    }
    
    const actualConversationId = conversationId || `test-conversation-${Date.now()}`;
    
    console.log(`🔄 Testing complete flow for message: "${message}"`);
    console.log(`📱 Phone number: ${phoneNumber}`);
    console.log(`💬 Conversation ID: ${actualConversationId}`);
    
    // Results object to track progress
    const result = {
      message,
      phoneNumber,
      conversationId: actualConversationId,
      timestamp: new Date().toISOString(),
      database: { attempted: false, success: false },
      notification: { attempted: false, success: false, required: false }
    };
    
    // Step 1: Save message to database if requested
    if (saveToDatabase) {
      result.database.attempted = true;
      console.log('💾 Database saving simulated (Supabase not available in test mode)');
      result.database.success = true;
      result.database.simulated = true;
    }
    
    // Step 2: Check if message requires notification
    if (checkNotification) {
      result.notification.attempted = true;
      
      console.log('🔍 Checking if message requires notification...');
      const analysis = checkForNotificationPhrases(message, 'user');
      result.notification.analysis = analysis;
      
      if (analysis.requiresNotification) {
        console.log('🔔 Message requires notification!');
        result.notification.required = true;
        
        // Step 3: Send notification
        try {
          console.log('📧 Sending notification...');
          const notificationResult = await sendBusinessNotification(
            actualConversationId, 
            message, 
            phoneNumber
          );
          
          result.notification.success = !!notificationResult;
          console.log(`✉️ Notification ${notificationResult ? 'sent successfully' : 'failed'}`);
        } catch (notifError) {
          console.error(`❌ Notification error: ${notifError.message}`);
          result.notification.error = notifError.message;
        }
      } else {
        console.log('ℹ️ Message does not require notification');
      }
    }
    
    // Step 4: Generate a simulated bot response
    const botResponses = [
      "Gracias por tu mensaje. Te ayudaré con eso.",
      "Un momento mientras consulto la información.",
      "Entiendo tu solicitud. Procesando...",
      "No puedo ayudarte con eso, necesitas hablar con un agente humano.",
      "Eso requiere la intervención de un especialista, te transferiré."
    ];
    
    // Choose response based on if we want to trigger a notification (last 2 would trigger it)
    const botResponseIndex = req.body.triggerBotNotification === true ? 
      Math.floor(Math.random() * 2) + 3 : // Index 3 or 4 (notification phrases)
      Math.floor(Math.random() * 3); // Index 0-2 (normal responses)
    
    const botResponse = botResponses[botResponseIndex];
    console.log(`🤖 Bot response: "${botResponse}"`);
    
    // Check if bot response would trigger a notification
    const botAnalysis = checkForNotificationPhrases(botResponse, 'bot');
    
    // Save bot response to database if requested
    if (saveToDatabase) {
      console.log('💾 Bot response saving simulated (Supabase not available in test mode)');
    }
    
    // Return the full result
    return res.json({
      success: true,
      flow: result,
      botResponse: {
        message: botResponse,
        requiresNotification: botAnalysis.requiresNotification,
        matches: botAnalysis.matches
      }
    });
  } catch (error) {
    console.error(`❌ Error in test-complete-flow endpoint: ${error.message}`);
    console.error(error.stack);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`✅ Available endpoints:`);
  console.log(`  - GET /status - Check server status`);
  console.log(`  - GET /health - Check server health`);
  console.log(`  - GET /test-notification - Test notification system`);
  console.log(`  - GET /test-process-message - Test message processing`);
  console.log(`  - POST /test-complete-flow - Test complete message flow with database integration`);
}); 