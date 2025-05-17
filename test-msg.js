const { URLSearchParams } = require('url');
const axios = require("axios");

const GUPSHUP_API_KEY = 'sk_f0dde30df43749e29d3fc63bb662ef9e';
const GUPSHUP_NUMBER = '15557033313';
const GUPSHUP_USERID = 'crxty1qflktvwvm7sodtrfe9dpvoowm1';

async function sendTestMessage() { try { const apiUrl = "https://api.gupshup.io/wa/api/v1/msg"; const recipient = "5212221192568"; const formData = new URLSearchParams(); formData.append("channel", "whatsapp"); formData.append("source", GUPSHUP_NUMBER); formData.append("destination", recipient); formData.append("src.name", GUPSHUP_NUMBER); formData.append("message", JSON.stringify({ type: "text", text: "Mensaje de prueba " + new Date().toISOString() })); const headers = { "Content-Type": "application/x-www-form-urlencoded", "apikey": GUPSHUP_API_KEY, "userid": GUPSHUP_USERID, "Cache-Control": "no-cache" }; console.log("Enviando mensaje a: " + recipient); console.log(formData.toString()); const response = await axios.post(apiUrl, formData, { headers }); console.log("Respuesta:", response.status, JSON.stringify(response.data)); } catch (error) { console.error("Error:", error.message); if (error.response) console.log(error.response.status, JSON.stringify(error.response.data || {})); } }
sendTestMessage();
