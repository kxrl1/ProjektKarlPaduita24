import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';

function App() {
  const [readings, setReadings] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3000/api/readings')
      .then(response => response.json())
      .then(data => setReadings(data))
      .catch(error => console.error('Viga andmete laadimisel:', error));
  }, []);

  // Vormindame andmed graafiku jaoks sobivamaks (võtame ainult kellaaja)
  const chartData = readings.map(reading => ({
    time: new Date(reading.timestamp).toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' }),
    price: reading.price_eur_mwh
  }));

  return (
    <div className="app-container">
      <h1>Energia armatuurlaud</h1>
      
      <div className="card">
        <h2>Elektrihinna graafik (€/MWh)</h2>
        {readings.length === 0 ? (
          <p>Laen andmeid...</p>
        ) : (
          <div style={{ width: '100%', height: 300, marginTop: '20px' }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={3} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;