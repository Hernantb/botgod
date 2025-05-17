// app/api/calendar/status/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Obtener el ID del negocio de los parámetros de consulta
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de negocio no proporcionado' },
        { status: 400 }
      );
    }
    
    console.log(`[Calendar Status API] Redirigiendo solicitud a backend: id=${id}`);
    
    // URL del backend - ajustar según corresponda
    // En producción, usar la URL de ngrok o el servidor de producción
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3095';
    
    // Redirigir al backend
    const response = await fetch(`${backendUrl}/api/calendar/status?id=${id}`, {
      headers: {
        'Content-Type': 'application/json'
      },
      // Agregar caché: 'no-store' para evitar caché en NextJS
      cache: 'no-store'
    });
    
    if (!response.ok) {
      console.error(`[Calendar Status API] Error al comunicarse con backend: ${response.status}`);
      return NextResponse.json(
        { success: false, error: `Error en el backend: ${response.status}` },
        { status: response.status }
      );
    }
    
    // Devolver la respuesta del backend
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Calendar Status API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error en la comunicación con el backend' },
      { status: 500 }
    );
  }
} 