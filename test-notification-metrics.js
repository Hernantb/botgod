#!/usr/bin/env node
/**
 * Test Notification Metrics - WhatsApp Bot Notification System
 * 
 * This script performs comprehensive testing of the notification system and
 * generates detailed metrics about its performance.
 * 
 * Usage:
 *   node test-notification-metrics.js [options]
 * 
 * Options:
 *   --count=10            Number of test messages to process (default: 10)
 *   --notify-ratio=0.5    Ratio of messages that should trigger notifications (0-1, default: 0.5)
 *   --save-report=true    Save a report file with results (default: true)
 *   --detailed=true       Generate detailed logs for each test (default: false)
 */

// Import required modules
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
require('dotenv').config();

// Import notification module
const { 
  checkForNotificationPhrases, 
  processMessageForNotification, 
  sendBusinessNotification 
} = require('./notification-patch');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    acc[key] = value === undefined ? true : value;
  }
  return acc;
}, {});

// Configuration
const CONFIG = {
  testCount: parseInt(args.count || 10, 10),
  notifyRatio: parseFloat(args.notify || 0.5),
  saveReport: args.report !== 'false',
  detailed: args.detailed === 'true',
  reportDir: path.join(__dirname, 'test-reports'),
  reportFile: `notification-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
};

// Ensure report directory exists
if (CONFIG.saveReport && !fs.existsSync(CONFIG.reportDir)) {
  fs.mkdirSync(CONFIG.reportDir, { recursive: true });
}

// Test data
const TEST_DATA = {
  // Sample phone numbers
  phoneNumbers: [
    '5521123456789',
    '5512987654321',
    '5511555555555',
    '5534123123123',
    '5541987987987'
  ],
  
  // Sample conversation IDs
  conversationIds: [
    'test-conversation-1',
    'test-conversation-2',
    'test-conversation-3',
    'test-conversation-4',
    'test-conversation-5'
  ],
  
  // Messages that should trigger notifications
  notificationMessages: [
    "No puedo ayudarte con eso, necesitas hablar con un agente humano",
    "Necesito transferirte con un especialista",
    "Esto está fuera de mi alcance, requiere la intervención de un humano",
    "No tengo acceso a esa información, contacta con el soporte técnico",
    "No estoy autorizado para realizar esa acción, necesitas hablar con un representante"
  ],
  
  // Messages that should NOT trigger notifications
  regularMessages: [
    "Gracias por tu consulta, puedo ayudarte con eso",
    "¡Perfecto! Aquí tienes la información que solicitaste",
    "He procesado tu pedido correctamente",
    "Tu cita ha sido confirmada para mañana a las 10:00",
    "Tu número de seguimiento es ABC123XYZ"
  ]
};

// Results storage
const results = {
  startTime: Date.now(),
  endTime: null,
  totalTests: 0,
  successfulTests: 0,
  failedTests: 0,
  notificationChecks: 0,
  correctDetections: 0,
  falsePositives: 0,
  falseNegatives: 0,
  emailsSent: 0,
  emailsFailed: 0,
  averageProcessingTime: 0,
  averageDetectionTime: 0,
  averageEmailTime: 0,
  tests: []
};

/**
 * Generates a random test case based on configuration
 * @param {number} index Test index
 * @returns {Object} Test case data
 */
function generateTestCase(index) {
  // Determine if this test should trigger a notification based on the configured ratio
  const shouldNotify = Math.random() < CONFIG.notifyRatio;
  
  // Select message pool based on notification requirement
  const messagePool = shouldNotify ? TEST_DATA.notificationMessages : TEST_DATA.regularMessages;
  
  // Generate test case
  return {
    id: `test-${index}`,
    message: messagePool[Math.floor(Math.random() * messagePool.length)],
    phoneNumber: TEST_DATA.phoneNumbers[Math.floor(Math.random() * TEST_DATA.phoneNumbers.length)],
    conversationId: TEST_DATA.conversationIds[Math.floor(Math.random() * TEST_DATA.conversationIds.length)],
    expectedNotification: shouldNotify
  };
}

/**
 * Logs a message with timestamp
 * @param {string} message Message to log
 * @param {string} level Log level (info, warn, error)
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌ ' : level === 'warn' ? '⚠️ ' : '✅ ';
  console[level === 'error' ? 'error' : 'log'](`[${timestamp}] ${prefix}${message}`);
}

/**
 * Runs a single test case
 * @param {Object} testCase Test case data
 * @returns {Object} Test results
 */
async function runTest(testCase) {
  const testResult = {
    ...testCase,
    startTime: Date.now(),
    endTime: null,
    success: false,
    error: null,
    detectionTime: 0,
    notificationTime: 0,
    totalTime: 0,
    detectionResult: null,
    notificationSent: false,
    notificationSuccess: false
  };
  
  try {
    if (CONFIG.detailed) {
      log(`Running test ${testCase.id} with message: "${testCase.message.substring(0, 30)}..."`);
    }
    
    // Step 1: Check if message requires notification
    const detectionStart = performance.now();
    const analysis = checkForNotificationPhrases(testCase.message);
    const detectionEnd = performance.now();
    
    testResult.detectionTime = detectionEnd - detectionStart;
    testResult.detectionResult = analysis;
    
    // Step 2: If notification is required, send it
    if (analysis.requiresNotification) {
      const notificationStart = performance.now();
      const notificationResult = await sendBusinessNotification(
        testCase.conversationId,
        testCase.message,
        testCase.phoneNumber
      );
      const notificationEnd = performance.now();
      
      testResult.notificationTime = notificationEnd - notificationStart;
      testResult.notificationSent = true;
      testResult.notificationSuccess = !!notificationResult;
      
      if (CONFIG.detailed) {
        log(`Notification ${notificationResult ? 'sent successfully' : 'failed'} for test ${testCase.id}`);
      }
    } else if (CONFIG.detailed) {
      log(`No notification required for test ${testCase.id}`);
    }
    
    // Determine test result correctness
    const detectionCorrect = analysis.requiresNotification === testCase.expectedNotification;
    
    if (!detectionCorrect) {
      if (analysis.requiresNotification && !testCase.expectedNotification) {
        results.falsePositives++;
        if (CONFIG.detailed) {
          log(`False positive detection in test ${testCase.id}`, 'warn');
        }
      } else {
        results.falseNegatives++;
        if (CONFIG.detailed) {
          log(`False negative detection in test ${testCase.id}`, 'warn');
        }
      }
    } else {
      results.correctDetections++;
    }
    
    testResult.success = true;
    results.successfulTests++;
    
    if (analysis.requiresNotification) {
      if (testResult.notificationSuccess) {
        results.emailsSent++;
      } else {
        results.emailsFailed++;
      }
    }
  } catch (error) {
    testResult.error = error.message;
    testResult.stack = error.stack;
    results.failedTests++;
    
    log(`Error in test ${testCase.id}: ${error.message}`, 'error');
  }
  
  testResult.endTime = Date.now();
  testResult.totalTime = testResult.endTime - testResult.startTime;
  
  return testResult;
}

/**
 * Calculates metrics based on test results
 */
function calculateMetrics() {
  results.endTime = Date.now();
  results.totalDuration = results.endTime - results.startTime;
  
  // Calculate averages
  if (results.tests.length > 0) {
    results.averageProcessingTime = results.tests.reduce((sum, test) => sum + test.totalTime, 0) / results.tests.length;
    results.averageDetectionTime = results.tests.reduce((sum, test) => sum + test.detectionTime, 0) / results.tests.length;
    
    const notificationTests = results.tests.filter(test => test.notificationSent);
    if (notificationTests.length > 0) {
      results.averageEmailTime = notificationTests.reduce((sum, test) => sum + test.notificationTime, 0) / notificationTests.length;
    }
  }
  
  // Calculate success rates
  results.detectionAccuracy = results.correctDetections / results.notificationChecks;
  results.emailSuccessRate = results.emailsSent / (results.emailsSent + results.emailsFailed);
  results.overallSuccessRate = results.successfulTests / results.totalTests;
}

/**
 * Generates a report with test results
 */
function generateReport() {
  calculateMetrics();
  
  // Log summary to console
  console.log('\n');
  console.log('=================================================');
  console.log('📊 NOTIFICATION SYSTEM TEST REPORT');
  console.log('=================================================');
  console.log(`Total tests run: ${results.totalTests}`);
  console.log(`Tests passed: ${results.successfulTests}`);
  console.log(`Tests failed: ${results.failedTests}`);
  console.log('-------------------------------------------------');
  console.log(`Detection accuracy: ${(results.detectionAccuracy * 100).toFixed(2)}%`);
  console.log(`False positives: ${results.falsePositives}`);
  console.log(`False negatives: ${results.falseNegatives}`);
  console.log('-------------------------------------------------');
  console.log(`Email success rate: ${(results.emailSuccessRate * 100).toFixed(2)}%`);
  console.log(`Emails sent: ${results.emailsSent}`);
  console.log(`Emails failed: ${results.emailsFailed}`);
  console.log('-------------------------------------------------');
  console.log(`Average processing time: ${results.averageProcessingTime.toFixed(2)}ms`);
  console.log(`Average detection time: ${results.averageDetectionTime.toFixed(2)}ms`);
  console.log(`Average email sending time: ${results.averageEmailTime.toFixed(2)}ms`);
  console.log(`Total execution time: ${(results.totalDuration / 1000).toFixed(2)}s`);
  console.log('=================================================');
  
  // Save detailed report to file if requested
  if (CONFIG.saveReport) {
    const reportPath = path.join(CONFIG.reportDir, CONFIG.reportFile);
    
    try {
      fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
      log(`Report saved to ${reportPath}`);
    } catch (error) {
      log(`Error saving report: ${error.message}`, 'error');
    }
  }
}

/**
 * Main function to run the tests
 */
async function main() {
  log(`Starting notification system test with ${CONFIG.testCount} test cases`);
  log(`Notification ratio: ${CONFIG.notifyRatio * 100}%`);
  
  results.totalTests = CONFIG.testCount;
  results.notificationChecks = CONFIG.testCount;
  
  // Generate and run tests
  for (let i = 0; i < CONFIG.testCount; i++) {
    const testCase = generateTestCase(i + 1);
    const testResult = await runTest(testCase);
    results.tests.push(testResult);
    
    // Output progress every 10 tests
    if ((i + 1) % 10 === 0 || i === CONFIG.testCount - 1) {
      log(`Progress: ${i + 1}/${CONFIG.testCount} tests completed (${Math.round((i + 1) / CONFIG.testCount * 100)}%)`);
    }
  }
  
  // Generate report
  generateReport();
}

// Run the main function
main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}); 