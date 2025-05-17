# Integración de Google Calendar en el Frontend

Este documento describe cómo implementar la integración con Google Calendar en el frontend de la aplicación.

## Descripción general

La integración con Google Calendar en el frontend permite:

1. Conectar la cuenta de Google Calendar de un negocio
2. Ver el estado de la integración
3. Consultar disponibilidad de horarios
4. Gestionar citas (ver, crear, eliminar)

## Implementación del botón de conexión

Para implementar el botón de conexión a Google Calendar:

```jsx
function GoogleCalendarConnectButton({ businessId }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    // Verificar si ya está conectado
    const checkConnection = async () => {
      try {
        const response = await fetch(`/api/business/${businessId}/calendar-status`);
        const data = await response.json();
        setIsConnected(data.connected);
      } catch (error) {
        console.error('Error verificando estado de conexión:', error);
      }
    };
    
    checkConnection();
  }, [businessId]);
  
  const handleConnect = () => {
    setIsConnecting(true);
    // Abrir ventana de autenticación
    const width = 600;
    const height = 700;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;
    
    const authWindow = window.open(
      `/api/google-auth?businessId=${businessId}`,
      'Conectar con Google Calendar',
      `width=${width},height=${height},top=${top},left=${left}`
    );
    
    // Verificar cuando se cierra la ventana
    const checkClosed = setInterval(() => {
      if (authWindow.closed) {
        clearInterval(checkClosed);
        setIsConnecting(false);
        // Verificar de nuevo el estado
        checkConnection();
      }
    }, 1000);
  };
  
  return (
    <button 
      onClick={handleConnect} 
      disabled={isConnecting || isConnected}
      className={`btn ${isConnected ? 'btn-success' : 'btn-primary'}`}
    >
      {isConnecting ? 'Conectando...' : isConnected ? 'Conectado ✓' : 'Conectar Google Calendar'}
    </button>
  );
}
```

## API para verificar el estado de la conexión

Implementar un endpoint para verificar si la cuenta ya está conectada:

```javascript
// En tu API de backend (NodeJS/Express)
app.get('/api/business/:businessId/calendar-status', async (req, res) => {
  try {
    const { businessId } = req.params;
    
    const { data, error } = await supabase
      .from('business_config')
      .select('google_calendar_enabled, google_calendar_refresh_token')
      .eq('business_id', businessId)
      .single();
      
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    const connected = data && 
                     data.google_calendar_enabled === true && 
                     !!data.google_calendar_refresh_token;
    
    return res.json({ 
      connected,
      last_updated: data?.google_calendar_updated_at || null
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
```

## Consulta de disponibilidad

Para mostrar la disponibilidad en el frontend:

```jsx
function AvailabilityCalendar({ businessId }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fetchAvailability = async (date) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const response = await fetch('/api/test-calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'check_availability',
          businessId,
          date: formattedDate
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error fetching availability');
      }
      
      setAvailableSlots(data.available_slots || []);
    } catch (err) {
      setError(err.message);
      setAvailableSlots([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Llamar a fetchAvailability cuando cambia la fecha
  useEffect(() => {
    fetchAvailability(selectedDate);
  }, [selectedDate, businessId]);
  
  // Renderizar un calendario y los slots disponibles
  return (
    <div className="availability-container">
      <div className="calendar-picker">
        {/* Implementa un selector de fecha aquí */}
        <input 
          type="date" 
          value={selectedDate.toISOString().split('T')[0]}
          onChange={(e) => setSelectedDate(new Date(e.target.value))}
        />
      </div>
      
      {isLoading ? (
        <p>Cargando disponibilidad...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        <div className="time-slots">
          <h3>Horarios disponibles para {selectedDate.toLocaleDateString()}</h3>
          {availableSlots.length === 0 ? (
            <p>No hay horarios disponibles en esta fecha</p>
          ) : (
            <div className="slots-grid">
              {availableSlots.map((slot) => (
                <button key={slot.time} className="slot-button">
                  {slot.display}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Creación de citas

Para implementar la creación de citas:

```jsx
function AppointmentForm({ businessId }) {
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    name: '',
    phone: '',
    email: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/test-calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create_event',
          businessId,
          date: formData.date,
          time: formData.time,
          phoneNumber: formData.phone,
          name: formData.name,
          email: formData.email,
          description: formData.description
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error creating appointment');
      }
      
      setResult({
        success: true,
        message: 'Cita creada exitosamente',
        appointmentId: data.event_id,
        date: data.date,
        time: data.time
      });
      
      // Limpiar formulario
      setFormData({
        date: '',
        time: '',
        name: '',
        phone: '',
        email: '',
        description: ''
      });
    } catch (err) {
      setResult({
        success: false,
        message: err.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="appointment-form-container">
      <h2>Crear nueva cita</h2>
      
      {result && (
        <div className={`result-message ${result.success ? 'success' : 'error'}`}>
          {result.message}
          {result.success && (
            <p>
              Cita programada para el {result.date} a las {result.time}
            </p>
          )}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="date">Fecha</label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="time">Hora</label>
          <input
            type="time"
            id="time"
            name="time"
            value={formData.time}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="name">Nombre</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="phone">Teléfono</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="description">Descripción</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
          />
        </div>
        
        <button 
          type="submit" 
          className="submit-button"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creando cita...' : 'Crear cita'}
        </button>
      </form>
    </div>
  );
}
```

## Visualización de citas existentes

Para mostrar las citas programadas:

```jsx
function AppointmentsList({ businessId, phoneNumber }) {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fetchAppointments = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/test-calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'find_appointments',
          businessId,
          phoneNumber
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error fetching appointments');
      }
      
      setAppointments(data.appointments || []);
    } catch (err) {
      setError(err.message);
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Cargar citas al montar el componente
  useEffect(() => {
    if (phoneNumber) {
      fetchAppointments();
    }
  }, [businessId, phoneNumber]);
  
  const handleCancelAppointment = async (appointmentId) => {
    if (!confirm('¿Estás seguro de que deseas cancelar esta cita?')) {
      return;
    }
    
    try {
      const response = await fetch('/api/test-calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'delete_event',
          businessId,
          eventId: appointmentId
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error canceling appointment');
      }
      
      // Recargar la lista de citas
      fetchAppointments();
      
      alert('Cita cancelada exitosamente');
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };
  
  return (
    <div className="appointments-list-container">
      <h2>Citas programadas</h2>
      
      {isLoading ? (
        <p>Cargando citas...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : appointments.length === 0 ? (
        <p>No hay citas programadas</p>
      ) : (
        <ul className="appointments-list">
          {appointments.map((appointment) => (
            <li key={appointment.id} className="appointment-item">
              <div className="appointment-details">
                <span className="date">{new Date(appointment.date).toLocaleDateString()}</span>
                <span className="time">{appointment.time}</span>
              </div>
              <button
                className="cancel-button"
                onClick={() => handleCancelAppointment(appointment.event_id)}
              >
                Cancelar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## Integración en el panel de administración

Para integrar todos estos componentes en un panel de administración:

```jsx
function CalendarManagementPanel({ businessId }) {
  const [activeTab, setActiveTab] = useState('availability');
  const [phoneFilter, setPhoneFilter] = useState('');
  
  return (
    <div className="calendar-panel">
      <h1>Gestión de Calendario</h1>
      
      <div className="calendar-connection">
        <h2>Conectar con Google Calendar</h2>
        <p>Conecta tu cuenta de Google Calendar para sincronizar tus citas</p>
        <GoogleCalendarConnectButton businessId={businessId} />
      </div>
      
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'availability' ? 'active' : ''}`}
          onClick={() => setActiveTab('availability')}
        >
          Disponibilidad
        </button>
        <button
          className={`tab ${activeTab === 'new-appointment' ? 'active' : ''}`}
          onClick={() => setActiveTab('new-appointment')}
        >
          Nueva Cita
        </button>
        <button
          className={`tab ${activeTab === 'list-appointments' ? 'active' : ''}`}
          onClick={() => setActiveTab('list-appointments')}
        >
          Citas Programadas
        </button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'availability' && (
          <AvailabilityCalendar businessId={businessId} />
        )}
        
        {activeTab === 'new-appointment' && (
          <AppointmentForm businessId={businessId} />
        )}
        
        {activeTab === 'list-appointments' && (
          <>
            <div className="phone-filter">
              <input
                type="tel"
                placeholder="Filtrar por teléfono"
                value={phoneFilter}
                onChange={(e) => setPhoneFilter(e.target.value)}
              />
              <button
                onClick={() => setPhoneFilter('')}
                disabled={!phoneFilter}
              >
                Limpiar
              </button>
            </div>
            <AppointmentsList businessId={businessId} phoneNumber={phoneFilter} />
          </>
        )}
      </div>
    </div>
  );
}
```

## Notas de implementación

1. **Manejo de errores**: Todas las llamadas a la API incluyen manejo de errores adecuado.
2. **Estados de carga**: Todos los componentes muestran indicadores de carga.
3. **Confirmaciones**: Las acciones destructivas (como cancelar citas) incluyen confirmaciones.
4. **Estilo**: Los estilos son simplemente sugerencias; ajusta las clases CSS según tu sistema de diseño.
5. **Reactividad**: Los componentes se actualizan automáticamente cuando cambian los datos.

## Compatibilidad con dispositivos móviles

Asegúrate de que todos los componentes sean responsivos y funcionen bien en dispositivos móviles. Para la ventana emergente de autorización, puedes necesitar ajustes adicionales en dispositivos móviles.

## Seguridad

Asegúrate de que todas las rutas API estén protegidas adecuadamente con autenticación y autorización para evitar accesos no autorizados a los calendarios de los negocios. 