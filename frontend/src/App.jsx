import { useState, useEffect, useMemo } from 'react';
import { LineChart, BarChart } from '@mui/x-charts';
import './App.css';

const API_BASE = 'http://localhost:3000';
const LOCATIONS = ['EE', 'LV', 'FI'];
const COLORS = { EE: '#1976d2', LV: '#e53935', FI: '#43a047' };

// Abifunktsioon: grupeerib andmed päevade kaupa ja arvutab keskmise
function calcDailyAverages(data) {
  const map = {};
  for (const item of data) {
    const day = new Date(item.timestamp).toISOString().slice(0, 10);
    if (!map[day]) map[day] = [];
    if (item.price_eur_mwh !== null && item.price_eur_mwh !== undefined) {
      map[day].push(item.price_eur_mwh);
    }
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, prices]) => ({
      day,
      avg: prices.length > 0 ? +(prices.reduce((s, v) => s + v, 0) / prices.length).toFixed(2) : null
    }));
}

// Abifunktsioon: arvutab keskmise hinna piirkonna järgi
function calcLocationAverages(dataByLocation) {
  return Object.entries(dataByLocation).map(([loc, items]) => {
    const prices = items
      .map(i => i.price_eur_mwh)
      .filter(p => p !== null && p !== undefined);
    return {
      location: loc,
      avg: prices.length > 0 ? +(prices.reduce((s, v) => s + v, 0) / prices.length).toFixed(2) : null
    };
  });
}

export default function App() {
  // --- Olek ---
  const [healthStatus, setHealthStatus] = useState('Kontrollin ühendust...');

  // Sünkroonimise state
  const [syncStart, setSyncStart] = useState('');
  const [syncEnd, setSyncEnd] = useState('');
  const [syncLocation, setSyncLocation] = useState('EE');
  const [isLoading, setIsLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState(false);

  // LISATUD: JSON Import state
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  // Dashboard filtrid
  const [dashStart, setDashStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 16);
  });
  const [dashEnd, setDashEnd] = useState(() => new Date().toISOString().slice(0, 16));
  // Graafik 1-2-3: üks piirkond
  const [dashLocation, setDashLocation] = useState('EE');
  // Graafik 4: mitu piirkonda korraga
  const [compareLocations, setCompareLocations] = useState(['EE', 'LV', 'FI']);

  // Andmed
  const [chartData, setChartData] = useState([]);
  const [compareData, setCompareData] = useState({});
  const [dataLoading, setDataLoading] = useState(false);

  // ============================================================
  // 2. Laadi andmed dashboardi jaoks (graafik 1, 2, 3)
  // ============================================================
  const fetchReadings = async (loc = dashLocation) => {
    setDataLoading(true);
    try {
      const start = dashStart ? new Date(dashStart).toISOString() : undefined;
      const end = dashEnd ? new Date(dashEnd).toISOString() : undefined;
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      params.set('location', loc);

      const res = await fetch(`${API_BASE}/api/readings?${params}`);
      if (!res.ok) throw new Error('Viga päringul');
      const data = await res.json();
      setChartData(data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
    } catch (e) {
      console.error('Viga andmete laadimisel:', e);
      setChartData([]);
    } finally {
      setDataLoading(false);
    }
  };

  // ============================================================
  // 3. Laadi andmed võrdlusgraafikuks (graafik 4 — kõik piirkonnad)
  // ============================================================
  const fetchCompareData = async () => {
    const start = dashStart ? new Date(dashStart).toISOString() : undefined;
    const end = dashEnd ? new Date(dashEnd).toISOString() : undefined;
    const result = {};

    for (const loc of compareLocations) {
      try {
        const params = new URLSearchParams();
        if (start) params.set('start', start);
        if (end) params.set('end', end);
        params.set('location', loc);
        const res = await fetch(`${API_BASE}/api/readings?${params}`);
        if (!res.ok) continue;
        const data = await res.json();
        result[loc] = data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      } catch {
        result[loc] = [];
      }
    }
    setCompareData(result);
  };

  useEffect(() => {
    fetchReadings();
    fetchCompareData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashStart, dashEnd, dashLocation]);

  // ============================================================
  // Tuletatud andmed graafikutele
  // ============================================================

  // Graafik 1: hind ajas (xAxis = kuvatav kellaaeg)
  const chart1Data = useMemo(() =>
    chartData.map(item => ({
      ...item,
      displayDate: new Date(item.timestamp).toLocaleString('et-EE', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      })
    })), [chartData]);

  // Graafik 2: päevane keskmine
  const chart2Data = useMemo(() => calcDailyAverages(chartData), [chartData]);

  // Graafik 3: piirkonna keskmine (ainult valitud piirkonna andmed on laetud, näidatakse 1 tulpa)
  const chart3Data = useMemo(() => {
    const prices = chartData
      .map(i => i.price_eur_mwh)
      .filter(p => p !== null && p !== undefined);
    if (prices.length === 0) return [];
    const avg = +(prices.reduce((s, v) => s + v, 0) / prices.length).toFixed(2);
    return [{ location: dashLocation, avg }];
  }, [chartData, dashLocation]);

  // Graafik 4: piirkondade võrdlus ajas
  // Loome ühise ajajoone ja liidame andmed
  const chart4Series = useMemo(() => {
    return compareLocations
      .filter(loc => compareData[loc]?.length > 0)
      .map(loc => ({
        id: loc,
        label: loc,
        data: compareData[loc].map(i => i.price_eur_mwh ?? null),
        color: COLORS[loc],
        connectNulls: true,
      }));
  }, [compareData, compareLocations]);

  // Leia kõige pikem andmestik x-teljele
  const chart4XLabels = useMemo(() => {
    const longest = compareLocations
      .map(loc => compareData[loc] || [])
      .reduce((a, b) => a.length >= b.length ? a : b, []);
    return longest.map(i =>
      new Date(i.timestamp).toLocaleString('et-EE', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      })
    );
  }, [compareData, compareLocations]);

  // ============================================================
  // Sünkroonimise käitleja
  // ============================================================
  const handleSync = async () => {
    setIsLoading(true);
    setSyncMessage('');
    setSyncError(false);
    try {
      const startIso = syncStart ? new Date(syncStart).toISOString() : undefined;
      const endIso = syncEnd ? new Date(syncEnd).toISOString() : undefined;

      const res = await fetch(`${API_BASE}/api/sync/prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: startIso, end: endIso, location: syncLocation })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Viga sünkroonimisel');

      setSyncMessage(`✅ Sünkrooniti edukalt! Töödeldud kirjeid: ${data.processed}`);
      fetchReadings();
      fetchCompareData();
    } catch (err) {
      setSyncError(true);
      setSyncMessage(
        err.message === 'PRICE_API_UNAVAILABLE'
          ? '❌ Elering API on hetkel kättesaamatu. Proovi hiljem uuesti.'
          : `❌ Viga: ${err.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // LISATUD: JSON Importi käitleja
  // ============================================================
  const handleImport = async () => {
    setImportLoading(true);
    setImportMessage('');
    try {
      // Endpoint to hit for importing energy_dump.json
      const res = await fetch(`${API_BASE}/api/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Viga importimisel');

      setImportMessage(`✅ Andmed imporditud edukalt!`);
      
      // Refresh charts
      fetchReadings();
      fetchCompareData();
    } catch (err) {
      setImportMessage(`❌ Viga: ${err.message}`);
    } finally {
      setImportLoading(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="app-container">
      <h1>⚡ Energia Armatuurlaud</h1>

      {/* --- Ülemine rida: olek + sünkroonimine + import --- */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>

        {/* Olek */}
        <div className="card" style={{ minWidth: '160px' }}>
          <h2>Olek</h2>
          <p style={{ fontWeight: 'bold', color: healthStatus === 'Backend OK' ? '#2e7d32' : '#c62828' }}>
            {healthStatus === 'Backend OK' ? ' Backend OK' : ' ' + healthStatus}
          </p>
        </div>

        {/* Sünkroonimine */}
        <div className="card" style={{ flex: 2 }}>
          <h2>Hindade sünkroonimine (Elering)</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Algus</label>
              <input type="datetime-local" value={syncStart} onChange={e => setSyncStart(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Lõpp</label>
              <input type="datetime-local" value={syncEnd} onChange={e => setSyncEnd(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Piirkond</label>
              <select value={syncLocation} onChange={e => setSyncLocation(e.target.value)}>
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <button
              onClick={handleSync}
              disabled={isLoading}
              style={{
                padding: '8px 20px', cursor: isLoading ? 'not-allowed' : 'pointer',
                backgroundColor: isLoading ? '#90caf9' : '#1976d2',
                color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold'
              }}
            >
              {isLoading ? '⏳ Laadin...' : ' Sync Prices'}
            </button>
          </div>
          {syncMessage && (
            <p style={{ marginTop: '10px', color: syncError ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>
              {syncMessage}
            </p>
          )}
        </div>

        {/* JSON Import */}
        <div className="card" style={{ flex: 1, minWidth: '200px' }}>
          <h2>JSON Import</h2>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
            Impordi energy_dump.json
          </p>
          <button
            onClick={handleImport}
            disabled={importLoading}
            style={{
              padding: '8px 16px', cursor: importLoading ? 'not-allowed' : 'pointer',
              backgroundColor: importLoading ? '#a5d6a7' : '#2e7d32',
              color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold'
            }}
          >
            {importLoading ? '⏳ Importin...' : ' Import JSON'}
          </button>
          {importMessage && (
            <p style={{ marginTop: '10px', fontSize: '13px', color: importMessage.startsWith('✅') ? '#2e7d32' : '#c62828' }}>
              {importMessage}
            </p>
          )}
        </div>
      </div>

      {/* --- Dashboard filtrid --- */}
      <div className="card">
        <h2> Interaktiivne Dashboard</h2>

        <div style={{
          display: 'flex', gap: '16px', marginBottom: '20px',
          backgroundColor: '#f5f5f5', padding: '16px', borderRadius: '8px', flexWrap: 'wrap',
          alignItems: 'flex-end'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Algus</label>
            <input type="datetime-local" value={dashStart} onChange={e => setDashStart(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Lõpp</label>
            <input type="datetime-local" value={dashEnd} onChange={e => setDashEnd(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Piirkond (graafikud 1–3)</label>
            <select value={dashLocation} onChange={e => { setDashLocation(e.target.value); fetchReadings(e.target.value); }}>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          {dataLoading && <span style={{ color: '#1976d2', fontStyle: 'italic' }}>⏳ Laen andmeid...</span>}
        </div>

        {/* ---- GRAAFIK 1: Hind ajas ---- */}
        <h3>1. Hinna muutumine ajas (€/MWh) — {dashLocation}</h3>
        {chart1Data.length > 0 ? (
          <div style={{ width: '100%', height: 320 }}>
            <LineChart
              dataset={chart1Data}
              xAxis={[{
                dataKey: 'displayDate',
                scaleType: 'point',
                tickLabelStyle: { angle: -40, textAnchor: 'end', fontSize: 11 },
                height: 80
              }]}
              series={[{
                dataKey: 'price_eur_mwh',
                label: `Hind ${dashLocation} (€/MWh)`,
                connectNulls: true,
                color: COLORS[dashLocation] || '#1976d2',
              }]}
              margin={{ top: 20, right: 30, left: 60, bottom: 100 }}
            />
          </div>
        ) : (
          <EmptyState />
        )}

        <hr style={{ margin: '30px 0', borderColor: '#e0e0e0' }} />

        {/* ---- GRAAFIK 2: Päevane keskmine ---- */}
        <h3>2. Päevane keskmine hind valitud perioodil — {dashLocation}</h3>
        {chart2Data.length > 0 ? (
          <div style={{ width: '100%', height: 300 }}>
            <BarChart
              dataset={chart2Data}
              xAxis={[{
                dataKey: 'day',
                scaleType: 'band',
                tickLabelStyle: { angle: -40, textAnchor: 'end', fontSize: 11 },
                height: 70
              }]}
              series={[{
                dataKey: 'avg',
                label: `Päevane keskmine ${dashLocation} (€/MWh)`,
                color: COLORS[dashLocation] || '#1976d2',
              }]}
              margin={{ top: 20, right: 30, left: 60, bottom: 90 }}
            />
          </div>
        ) : (
          <EmptyState />
        )}

        <hr style={{ margin: '30px 0', borderColor: '#e0e0e0' }} />

        {/* ---- GRAAFIK 3: Keskmine hind piirkonniti ---- */}
        <h3>3. Keskmine hind piirkonniti (valitud periood)</h3>
        <p style={{ fontSize: '13px', color: '#666', marginTop: '-8px', marginBottom: '12px' }}>
          Näitab valitud piirkonna keskmist hinda. Kõigi piirkondade võrdluseks vaata graafikut 4.
        </p>
        {chart3Data.length > 0 ? (
          <div style={{ width: '100%', height: 260 }}>
            <BarChart
              dataset={chart3Data}
              xAxis={[{ dataKey: 'location', scaleType: 'band' }]}
              series={[{
                dataKey: 'avg',
                label: 'Keskmine hind (€/MWh)',
                color: COLORS[dashLocation] || '#1976d2',
              }]}
              margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
            />
          </div>
        ) : (
          <EmptyState />
        )}

        <hr style={{ margin: '30px 0', borderColor: '#e0e0e0' }} />

        {/* ---- GRAAFIK 4: Piirkondade võrdlus ---- */}
        <h3>4. Piirkondade hindade võrdlus ajas</h3>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {LOCATIONS.map(loc => (
            <label key={loc} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={compareLocations.includes(loc)}
                onChange={e => {
                  setCompareLocations(prev =>
                    e.target.checked ? [...prev, loc] : prev.filter(l => l !== loc)
                  );
                }}
              />
              <span style={{ color: COLORS[loc], fontWeight: 'bold' }}>{loc}</span>
            </label>
          ))}
          <button
            onClick={fetchCompareData}
            style={{
              padding: '4px 12px', backgroundColor: '#546e7a', color: 'white',
              border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px'
            }}
          >
            Uuenda
          </button>
        </div>
        {chart4Series.length > 0 && chart4XLabels.length > 0 ? (
          <div style={{ width: '100%', height: 340 }}>
            <LineChart
              xAxis={[{
                data: chart4XLabels,
                scaleType: 'point',
                tickLabelStyle: { angle: -40, textAnchor: 'end', fontSize: 11 },
                height: 80
              }]}
              series={chart4Series}
              margin={{ top: 20, right: 30, left: 60, bottom: 100 }}
            />
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

// Tühja andmestiku komponent
function EmptyState() {
  return (
    <p style={{
      color: '#888', fontStyle: 'italic', padding: '20px',
      backgroundColor: '#fafafa', borderRadius: '6px', textAlign: 'center'
    }}>
       Sellel perioodil andmed puuduvad. Sünkroniseeri andmeid ülal.
    </p>
  );
}