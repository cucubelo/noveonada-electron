// Función para obtener canales 24/7
export async function get247Channels() {
  try {
    const response = await fetch('https://canales.fanstv.info/canales.json', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const channels = await response.json();
    
    // Mapear stream_id a id para compatibilidad
    const mappedChannels = channels.map(channel => ({
      id: channel.stream_id || channel.id, // Usar stream_id como id
      name: channel.name,
      stream_id: channel.stream_id // Mantener campo original
    }));
    
    return {
      channels: mappedChannels,
      totalChannels: mappedChannels.length
    };
  } catch (error) {
    console.error('Error obteniendo canales 24/7:', error);
    return getMockChannels();
  }
}

// Datos mock para fallback
function getMockChannels() {
  return {
    channels: [
      { id: '1', name: 'ESPN USA', stream_id: '1' },
      { id: '2', name: 'Fox Sports 1', stream_id: '2' },
      { id: '3', name: 'CNN USA', stream_id: '3' },
      { id: '4', name: 'BBC News', stream_id: '4' },
      { id: '5', name: 'Discovery Channel', stream_id: '5' }
    ],
    totalChannels: 5
  };
}