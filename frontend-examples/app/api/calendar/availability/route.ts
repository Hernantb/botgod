// app/api/calendar/availability/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[Calendar Availability API] Recibida solicitud de disponibilidad');
    
    // Obtener el cuerpo de la solicitud
    const body = await request.json();
    const { businessId, date, month } = body;
    
    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'ID de negocio no proporcionado' },
        { status: 400 }
      );
    }
    
    if (!date && !month) {
      return NextResponse.json(
        { success: false, error: 'Se requiere fecha (date) o mes (month)' },
        { status: 400 }
      );
    }
    
    // URL del backend - ajustar según corresponda
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3095';
    
    console.log(`[Calendar Availability API] Redirigiendo solicitud a backend: ${backendUrl}/api/calendar/availability`);
    
    // Redirigir al backend
    const response = await fetch(`${backendUrl}/api/calendar/availability`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ businessId, date, month }),
      // Agregar caché: 'no-store' para evitar caché en NextJS
      cache: 'no-store'
    });
    
    if (!response.ok) {
      console.error(`[Calendar Availability API] Error al comunicarse con backend: ${response.status}`);
      return NextResponse.json(
        { success: false, error: `Error en el backend: ${response.status}` },
        { status: response.status }
      );
    }
    
    // Devolver la respuesta del backend
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Calendar Availability API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error en la comunicación con el backend' },
      { status: 500 }
    );
  }
} 