'use client'

import { useState, useEffect } from 'react';

interface ConfigCalendarProps {
  businessId: string;
}

interface CalendarStatus {
  enabled: boolean;
  hasToken: boolean;
  lastUpdated: string | null;
}

export default function ConfigCalendar({ businessId }: ConfigCalendarProps) {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (businessId) {
      fetchCalendarStatus();
    }
  }, [businessId]);

  const fetchCalendarStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/calendar/status?id=${businessId}&t=${Date.now()}`);

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al consultar estado de calendario');
      }

      setStatus(data.status);
    } catch (err: any) {
      console.error('Error fetching calendar status:', err);
      setError(err.message || 'Error al cargar el estado del calendario');
    } finally {
      setLoading(false);
    }
  };

  const configureGoogleCalendar = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/calendar/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ businessId })
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al iniciar configuración de Google Calendar');
      }

      // Abrir la ventana de autenticación de Google
      if (data.authUrl) {
        window.open(data.authUrl, '_blank', 'width=600,height=700');
        
        // Iniciar un intervalo para verificar si la configuración fue exitosa
        const checkInterval = setInterval(async () => {
          await fetchCalendarStatus();
          
          // Si ya se configuró correctamente, detener el intervalo
          if (status?.hasToken) {
            clearInterval(checkInterval);
          }
        }, 5000); // Verificar cada 5 segundos
        
        // Limpiar el intervalo después de 2 minutos (24 intentos)
        setTimeout(() => {
          clearInterval(checkInterval);
        }, 120000);
      }
    } catch (err: any) {
      console.error('Error configuring Google Calendar:', err);
      setError(err.message || 'Error al configurar Google Calendar');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading && !status) {
    return <div className="flex justify-center items-center p-8">Cargando...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Configuración de Google Calendar</h2>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="font-semibold">Estado de conexión</h3>
            <p className="text-sm text-gray-600">Indica si el calendario está conectado</p>
          </div>
          <div>
            {status?.enabled ? (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full">Activo</span>
            ) : (
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full">Inactivo</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="font-semibold">Última actualización</h3>
            <p className="text-sm text-gray-600">La última vez que se actualizó la configuración</p>
          </div>
          <div>
            <span className="text-gray-800">{formatDate(status?.lastUpdated || null)}</span>
          </div>
        </div>

        <div className="pt-3">
          <button
            onClick={configureGoogleCalendar}
            disabled={loading}
            className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors ${
              loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Procesando...' : status?.hasToken ? 'Reconfigurar Google Calendar' : 'Configurar Google Calendar'}
          </button>
          
          {status?.hasToken && (
            <p className="text-sm text-gray-600 mt-2 text-center">
              Tu calendario ya está configurado, pero puedes reconfigurarlo si es necesario.
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 