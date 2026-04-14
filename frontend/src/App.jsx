import { useState, useEffect } from 'react';
import './App.css';

function App() {
  // --- Moodul 1: Health Check ---
  const [healthStatus, setHealthStatus] = useState('Kontrollin ühendust...');

  // --- Moodul 3: Sünkroonimise osakond ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('EE');
  const [isLoading, setIsLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Kontrollime alguses backendi tervist
  useEffect(() => {
    fetch('http://localhost:3000/api/health')
      .then(response => {
        if (!response.ok) throw new Error('Server vastas veaga');
        return response.json();
      })
      .then(data => {
        if (data.status === 'ok' && data.db === 'ok') {
          setHealthStatus('Backend OK');
        } else {
          setHealthStatus('Viga: Andmebaasiga pole ühendust');
        }
      })
      .catch(() => {
        setHealthStatus('Viga: Backendiga ei saa ühendust.');
      });
  }, []);

  // Funktsioon, mis käivitub "Sync Prices" nupule vajutades
  const handleSync = async () => {
    setIsLoading(true);
    setSyncMessage('');

    try {
      // Teisendame valitud kuupäevad ISO vormingusse, kui need on valitud
      let startIso = startDate ? new Date(startDate).toISOString() : undefined;
      let endIso = endDate ? new Date(endDate).toISOString() : undefined;

      const response = await fetch('http://localhost:3000/api/sync/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: startIso, end: endIso, location })
      });

      const data = await response.json();

      if (!response.ok) {
        // Püüame backendi visatud veateate (nt PRICE_API_UNAVAILABLE)
        throw new Error(data.error || 'Tundmatu viga sünkroonimisel');
      }

      // Edukas sünkroonimine
      setSyncMessage(`Hinnad sünkrooniti edukalt. Eleringist töödeldi ${data.processed} kirjet.`);
    } catch (error) {
      // Kasutajasõbraliku vea kuvamine
      if (error.message === 'PRICE_API_UNAVAILABLE') {
        setSyncMessage('Viga: Eleringi hinnateenus pole hetkel kättesaadav.');
      } else {
        setSyncMessage(`Viga: ${error.message}`);
      }
    } finally {
      setIsLoading(false); // Lülitame laadimise välja
    }
  };

  return (
    <div className="app-container">
      <h1>Energia armatuurlaud</h1>
      
      {/* Süsteemi oleku kaart */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2>Süsteemi olek</h2>
        <p style={{ fontWeight: 'bold', color: healthStatus === 'Backend OK' ? 'green' : 'red' }}>
          {healthStatus}
        </p>
      </div>

      {/* Sünkroonimise kaart */}
      <div className="card">
        <h2>Hindade sünkroonimine (Elering)</h2>
        
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Algus (jäta tühjaks = tänane):</label>
            <input 
              type="datetime-local" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Lõpp (jäta tühjaks = tänane):</label>
            <input 
              type="datetime-local" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Piirkond:</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="EE">Eesti (EE)</option>
              <option value="LV">Läti (LV)</option>
              <option value="FI">Soome (FI)</option>
            </select>
          </div>
        </div>

        <button 
          onClick={handleSync} 
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            backgroundColor: isLoading ? '#cccccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isLoading ? 'wait' : 'pointer'
          }}
        >
          {isLoading ? 'Loading...' : 'Sync Prices'}
        </button>

        {/* Kuvame sünkroonimise tagasisidet */}
        {syncMessage && (
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px', borderLeft: '4px solid #007bff' }}>
            {syncMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;