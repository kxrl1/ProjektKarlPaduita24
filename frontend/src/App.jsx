import { useState, useEffect, useMemo } from 'react';
import { LineChart, BarChart } from '@mui/x-charts';
import './App.css';

const API_BASE = 'http://localhost:3000';
const LOCATIONS = ['EE', 'LV', 'FI'];
const COLORS = { EE: '#1976d2', LV: '#e53935', FI: '#43a047' };

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
      avg: prices.length > 0
        ? +(prices.reduce((s, v) => s + v, 0) / prices.length).toFixed(2)
        : null
    }));
}

export default function App() {
  const [syncStart, setSyncStart] = useState('');
  const [syncEnd, setSyncEnd] = useState('');
  const [syncLocation, setSyncLocation] = useState('EE');
  const [isLoading, setIsLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState(false);

  const [dashStart, setDashStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 16);
  });
  const [dashEnd, setDashEnd] = useState(() => new Date().toISOString().slice(0, 16));
  const [dashLocation, setDashLocation] = useState('EE');
  const [compareLocations, setCompareLocations] = useState(['EE', 'LV', 'FI']);
  const [chartData, setChartData] = useState([]);
  const [compareData, setCompareData] = useState({});
  const [dataLoading, setDataLoading] = useState(false);

  const fetchReadings = async (loc = dashLocation) => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams();
      if (dashStart) params.set('start', new Date(dashStart).toISOString());
      if (dashEnd) params.set('end', new Date(dashEnd).toISOString());
      params.set('location', loc);
      const res = await fetch(`${API_BASE}/api/readings?${params}`);
      if (!res.ok) throw new Error('Viga');
      const data = await res.json();
      setChartData(data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
    } catch { setChartData([]); }
    finally { setDataLoading(false); }
  };

  const fetchCompareData = async () => {
    const result = {};
    for (const loc of LOCATIONS) {
      try {
        const params = new URLSearchParams();
        if (dashStart) params.set('start', new Date(dashStart).toISOString());
        if (dashEnd) params.set('end', new Date(dashEnd).toISOString());
        params.set('location', loc);
        const res = await fetch(`${API_BASE}/api/readings?${params}`);
        if (!res.ok) { result[loc] = []; continue; }
        const data = await res.json();
        result[loc] = data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      } catch { result[loc] = []; }
    }
    setCompareData(result);
  };

  useEffect(() => {
    fetchReadings();
    fetchCompareData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashStart, dashEnd, dashLocation]);

  const chart1Data = useMemo(() =>
    chartData.map(item => ({
      ...item,
      displayDate: new Date(item.timestamp).toLocaleString('et-EE', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      })
    })), [chartData]);

  const chart2Data = useMemo(() => calcDailyAverages(chartData), [chartData]);

  // Graafik 3: EE + LV + FI keskmised korraga
  const chart3Data = useMemo(() =>
    LOCATIONS.map(loc => {
      const items = compareData[loc] || [];
      const prices = items.map(i => i.price_eur_mwh).filter(p => p !== null && p !== undefined);
      return {
        location: loc,
        avg: prices.length > 0 ? +(prices.reduce((s, v) => s + v, 0) / prices.length).toFixed(2) : null
      };
    }).filter(d => d.avg !== null)
  , [compareData]);

  const chart4Series = useMemo(() =>
    compareLocations
      .filter(loc => compareData[loc]?.length > 0)
      .map(loc => ({
        id: loc, label: loc,
        data: compareData[loc].map(i => i.price_eur_mwh ?? null),
        color: COLORS[loc], connectNulls: true,
      }))
  , [compareData, compareLocations]);

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

  const handleSync = async () => {
    setIsLoading(true); setSyncMessage(''); setSyncError(false);
    try {
      const res = await fetch(`${API_BASE}/api/sync/prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: syncStart ? new Date(syncStart).toISOString() : undefined,
          end: syncEnd ? new Date(syncEnd).toISOString() : undefined,
          location: syncLocation
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Viga sünkroonimisel');
      setSyncMessage(`✅ Sünkrooniti edukalt! Töödeldud kirjeid: ${data.processed}`);
      fetchReadings(); fetchCompareData();
    } catch (err) {
      setSyncError(true);
      setSyncMessage(err.message === 'PRICE_API_UNAVAILABLE'
        ? '❌ Elering API on hetkel kättesaamatu.'
        : `❌ Viga: ${err.message}`);
    } finally { setIsLoading(false); }
  };

  return (
    <div className="app-container">
      <h1>⚡ Energia Armatuurlaud</h1>

      {/* Sünkroonimine */}
      <div style={{ marginBottom: '20px' }}>
        <div className="card">
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
            <button onClick={handleSync} disabled={isLoading} style={{
              padding: '8px 20px', cursor: isLoading ? 'not-allowed' : 'pointer',
              backgroundColor: isLoading ? '#90caf9' : '#1976d2',
              color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold'
            }}>
              {isLoading ? '⏳ Laadin...' : '🔄 Sync Prices'}
            </button>
          </div>
          {syncMessage && (
            <p style={{ marginTop: '10px', color: syncError ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>
              {syncMessage}
            </p>
          )}
        </div>
      </div>

      {/* Dashboard */}
      <div className="card">
        <h2>📊 Interaktiivne Dashboard</h2>

        <div style={{
          display: 'flex', gap: '16px', marginBottom: '20px', backgroundColor: '#f5f5f5',
          padding: '16px', borderRadius: '8px', flexWrap: 'wrap', alignItems: 'flex-end'
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
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Piirkond (graafikud 1–2)</label>
            <select value={dashLocation} onChange={e => { setDashLocation(e.target.value); fetchReadings(e.target.value); }}>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          {dataLoading && <span style={{ color: '#1976d2', fontStyle: 'italic' }}>⏳ Laen andmeid...</span>}
        </div>

        {/* Graafik 1 */}
        <h3>1. Hinna muutumine ajas (€/MWh) — {dashLocation}</h3>
        {chart1Data.length > 0 ? (
          <div style={{ width: '100%', height: 320 }}>
            <LineChart
              dataset={chart1Data}
              xAxis={[{ dataKey: 'displayDate', scaleType: 'point',
                tickLabelStyle: { angle: -40, textAnchor: 'end', fontSize: 11 }, height: 80 }]}
              series={[{ dataKey: 'price_eur_mwh', label: `Hind ${dashLocation} (€/MWh)`,
                connectNulls: true, color: COLORS[dashLocation] || '#1976d2' }]}
              margin={{ top: 20, right: 30, left: 60, bottom: 100 }}
            />
          </div>
        ) : <EmptyState />}

        <hr style={{ margin: '30px 0', borderColor: '#e0e0e0' }} />

        {/* Graafik 2 */}
        <h3>2. Päevane keskmine hind valitud perioodil — {dashLocation}</h3>
        {chart2Data.length > 0 ? (
          <div style={{ width: '100%', height: 300 }}>
            <BarChart
              dataset={chart2Data}
              xAxis={[{ dataKey: 'day', scaleType: 'band',
                tickLabelStyle: { angle: -40, textAnchor: 'end', fontSize: 11 }, height: 70 }]}
              series={[{ dataKey: 'avg', label: `Päevane keskmine ${dashLocation} (€/MWh)`,
                color: COLORS[dashLocation] || '#1976d2' }]}
              margin={{ top: 20, right: 30, left: 60, bottom: 90 }}
            />
          </div>
        ) : <EmptyState />}

        <hr style={{ margin: '30px 0', borderColor: '#e0e0e0' }} />

        {/* Graafik 3 — EE, LV, FI keskmised kõik korraga */}
        <h3>3. Keskmine hind piirkonniti (valitud periood)</h3>
        {chart3Data.length > 0 ? (
          <div style={{ width: '100%', height: 280 }}>
            <BarChart
              dataset={chart3Data}
              xAxis={[{ dataKey: 'location', scaleType: 'band',
                colorMap: { type: 'ordinal', colors: chart3Data.map(d => COLORS[d.location]) } }]}
              series={[{ dataKey: 'avg', label: 'Keskmine hind (€/MWh)' }]}
              margin={{ top: 20, right: 30, left: 60, bottom: 40 }}
            />
          </div>
        ) : <EmptyState />}

        <hr style={{ margin: '30px 0', borderColor: '#e0e0e0' }} />

        {/* Graafik 4 */}
        <h3>4. Piirkondade hindade võrdlus ajas</h3>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {LOCATIONS.map(loc => (
            <label key={loc} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={compareLocations.includes(loc)}
                onChange={e => setCompareLocations(prev =>
                  e.target.checked ? [...prev, loc] : prev.filter(l => l !== loc)
                )} />
              <span style={{ color: COLORS[loc], fontWeight: 'bold' }}>{loc}</span>
            </label>
          ))}
          <button onClick={fetchCompareData} style={{
            padding: '4px 12px', backgroundColor: '#546e7a', color: 'white',
            border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px'
          }}>Uuenda</button>
        </div>
        {chart4Series.length > 0 && chart4XLabels.length > 0 ? (
          <div style={{ width: '100%', height: 340 }}>
            <LineChart
              xAxis={[{ data: chart4XLabels, scaleType: 'point',
                tickLabelStyle: { angle: -40, textAnchor: 'end', fontSize: 11 }, height: 80 }]}
              series={chart4Series}
              margin={{ top: 20, right: 30, left: 60, bottom: 100 }}
            />
          </div>
        ) : <EmptyState />}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <p style={{
      color: '#888', fontStyle: 'italic', padding: '20px',
      backgroundColor: '#fafafa', borderRadius: '6px', textAlign: 'center'
    }}>
      📭 Sellel perioodil andmed puuduvad. Sünkroniseeri andmeid ülal.
    </p>
  );
}
