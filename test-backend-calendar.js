const fetch = require('node-fetch');
const businessId = '2d385aa5-40e0-4ec9-9360-19281bc605e4'; // The business ID we're seeing in the logs

async function testCalendarEndpoint() {
  try {
    console.log('Testing /api/test-calendar endpoint for availability check');
    const response = await fetch('http://localhost:3095/api/test-calendar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'check_availability',
        businessId,
        date: '2025-05-15'
      })
    });
    
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
    console.error('Error testing calendar endpoint:', error);
  }
}

testCalendarEndpoint(); 