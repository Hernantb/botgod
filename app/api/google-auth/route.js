// app/api/google-auth/route.js
import { NextResponse } from 'next/server';

// Esta ruta es un proxy para la autenticación de Google Calendar
export async function GET(request) {
  try {
    console.log('[API Google Auth] Procesando solicitud de autenticación');
    
    // Obtener la URL completa de la solicitud
    const url = new URL(request.url);
    const businessId = url.searchParams.get('businessId');
    
    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'ID de negocio no proporcionado' },
        { status: 400 }
      );
    }
    
    // Redirigir al backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3095';
    const redirectUrl = `${backendUrl}/api/google-auth?businessId=${businessId}`;
    
    console.log(`[API Google Auth] Redirigiendo a: ${redirectUrl}`);
    
    // Hacer una redirección 302 para mantener los parámetros
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('[API Google Auth] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error en la redirección' },
      { status: 500 }
    );
  }
}