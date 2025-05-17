const fetch = require('node-fetch');
const businessId = '2d385aa5-40e0-4ec9-9360-19281bc605e4'; // The business ID we're seeing in the logs

async function testCalendarStatus() {
  try {
    console.log(`Testing calendar status for business ID: ${businessId}`);
    const response = await fetch(`http://localhost:3005/api/business/${businessId}/calendar-status`);
    
    // Log the raw response for debugging
    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Raw response:', text);
    
    try {
      // Try to parse as JSON if possible
      const data = JSON.parse(text);
      console.log('Response data (JSON):', JSON.stringify(data, null, 2));
    } catch (jsonError) {
      console.log('Response is not valid JSON');
    }
  } catch (error) {
    console.error('Error testing calendar status:', error);
  }
}

testCalendarStatus(); 