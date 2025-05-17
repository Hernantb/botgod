'use client'

import { useState, useEffect } from 'react';

interface CalendarSelectorProps {
  businessId: string;
}

interface CalendarDay {
  date: string;
  available: boolean;
  events: any[];
  dayOfWeek: number;
}

interface CalendarResponse {
  success: boolean;
  error?: string;
  businessName?: string;
  startDate?: string;
  endDate?: string;
  days?: CalendarDay[];
}

const weekDays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function CalendarSelector({ businessId }: CalendarSelectorProps) {
  const [currentMonth, setCurrentMonth] = useState<string>('');
  const [calendarData, setCalendarData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    // Establecer el mes actual en formato YYYY-MM
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    setCurrentMonth(`${year}-${month}`);
  }, []);

  useEffect(() => {
    if (currentMonth && businessId) {
      fetchMonthAvailability();
    }
  }, [currentMonth, businessId]);

  const fetchMonthAvailability = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/calendar/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          businessId,
          month: currentMonth
        })
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error al obtener disponibilidad');
      }
      
      setCalendarData(data);
    } catch (err: any) {
      console.error('Error fetching calendar availability:', err);
      setError(err.message || 'Error al cargar el calendario');
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (increment: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + increment, 1);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    setCurrentMonth(`${newYear}-${newMonth}`);
  };

  const formatDateForDisplay = (dateString: string) => {
    const date = new Date(dateString);
    return date.getDate();
  };

  const getMonthTitle = () => {
    if (!currentMonth) return '';
    const [year, month] = currentMonth.split('-');
    return `${months[parseInt(month) - 1]} ${year}`;
  };

  const handleDateSelection = (date: string) => {
    setSelectedDate(date === selectedDate ? null : date);
  };

  if (loading) {
    return <div className="flex justify-center items-center p-8">Cargando calendario...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-md">
        <p className="font-bold">Error:</p>
        <p>{error}</p>
        <button 
          onClick={fetchMonthAvailability}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="calendar-selector">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => changeMonth(-1)}
          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          &lt; Anterior
        </button>
        <h3 className="text-lg font-semibold">{getMonthTitle()}</h3>
        <button
          onClick={() => changeMonth(1)}
          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Siguiente &gt;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day, index) => (
          <div key={index} className="text-center font-medium p-2 bg-gray-100">
            {day.substring(0, 3)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarData && calendarData.days ? (
          <>
            {/* Añadir espacios vacíos para el primer día del mes */}
            {Array.from({ length: new Date(calendarData.days[0].date).getDay() }).map((_, index) => (
              <div key={`empty-${index}`} className="p-3"></div>
            ))}

            {calendarData.days.map((day) => (
              <div
                key={day.date}
                onClick={() => day.available ? handleDateSelection(day.date) : null}
                className={`
                  p-3 text-center cursor-pointer border rounded-md
                  ${day.available ? 'hover:bg-blue-100' : 'bg-gray-200 cursor-not-allowed opacity-50'}
                  ${selectedDate === day.date ? 'bg-blue-500 text-white' : ''}
                `}
              >
                <div>{formatDateForDisplay(day.date)}</div>
                {day.events.length > 0 && (
                  <div className="text-xs mt-1">
                    {day.events.length} {day.events.length === 1 ? 'evento' : 'eventos'}
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
          <div className="col-span-7 text-center py-8">
            No hay datos de calendario disponibles
          </div>
        )}
      </div>

      {selectedDate && (
        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <p className="font-semibold">Fecha seleccionada: {selectedDate}</p>
          <p>Puedes continuar con la reserva.</p>
        </div>
      )}
    </div>
  );
} 