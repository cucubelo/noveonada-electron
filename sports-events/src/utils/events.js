// Función para obtener eventos por días (compatible con Astro y Electron)
export async function getEventsByDays() {
  try {
    // Siempre usar la API real
    const res = await fetch('https://noveonada.com/proxy/schedule');
    const data = await res.json();

    const eventsByDay = {};
    const allCategories = new Set();
    
    // Procesar cada día en la respuesta
    Object.keys(data).forEach(dayKey => {
      const dayObj = data[dayKey];
      const events = [];
      
      // Extraer todas las categorías dinámicamente
      Object.keys(dayObj).forEach(category => {
        if (Array.isArray(dayObj[category])) {
          allCategories.add(category);
          
          dayObj[category].forEach(ev => {
            // Procesar channels
            if (ev.channels && Array.isArray(ev.channels)) {
              ev.channels.forEach(ch => {
                if (ch.channel_id && !isNaN(+ch.channel_id)) {
                  events.push({
                    time: ev.time || 'N/A',
                    title: ev.event || 'Sin título',
                    channelId: ch.channel_id,
                    category: category
                  });
                }
              });
            }
            
            // Procesar channels2
            if (ev.channels2 && Array.isArray(ev.channels2)) {
              ev.channels2.forEach(ch => {
                if (ch.channel_id && !isNaN(+ch.channel_id)) {
                  events.push({
                    time: ev.time || 'N/A',
                    title: ev.event || 'Sin título',
                    channelId: ch.channel_id,
                    category: category
                  });
                }
              });
            }
          });
        }
      });
      
      if (events.length > 0) {
        eventsByDay[dayKey] = events;
      }
    });

    return {
      eventsByDay,
      categories: Array.from(allCategories).sort()
    };
  } catch (error) {
    console.error('Error obteniendo eventos:', error);
    return getMockEventsByDays();
  }
}

// Función legacy para compatibilidad
export async function getTodayEvents() {
  const { eventsByDay } = await getEventsByDays();
  const firstDay = Object.keys(eventsByDay)[0];
  return firstDay ? eventsByDay[firstDay] : [];
}

// Datos mock para fallback en caso de error
function getMockEventsByDays() {
  return {
    eventsByDay: {
      'Hoy - Eventos de Prueba': [
        { time: '15:00', title: 'Real Madrid vs Barcelona - El Clásico', channelId: '746', category: 'Soccer' },
        { time: '18:30', title: 'Lakers vs Warriors - NBA Finals', channelId: '123', category: 'Basketball' },
        { time: '20:00', title: 'Federer vs Nadal - Wimbledon', channelId: '456', category: 'Tennis' },
        { time: '22:00', title: 'UFC 300 - Main Event', channelId: '789', category: 'MMA' },
        { time: '16:45', title: 'Formula 1 - Monaco GP', channelId: '321', category: 'Motorsport' },
        { time: '19:15', title: 'WWE Monday Night Raw', channelId: '654', category: 'WWE' }
      ]
    },
    categories: ['Soccer', 'Basketball', 'Tennis', 'MMA', 'Motorsport', 'WWE']
  };
}