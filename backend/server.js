require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { Op } = require('sequelize');

// Impordime mudelid KOHE faili alguses!
const { EnergyReading, sequelize } = require('./models');

const app = express();
app.use(cors());
app.use(express.json());

// --- MOODUL 1: Health endpoint ---
app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: "ok", db: "ok" });
  } catch (error) {
    console.error('Andmebaasi viga:', error);
    res.status(500).json({ status: "error", db: "error" });
  }
});

// --- MOODUL 2/4: Andmete pärimine andmebaasist ---
app.get('/api/readings', async (req, res) => {
  try {
    const readings = await EnergyReading.findAll();
    res.json(readings);
  } catch (error) {
    console.error('Viga andmete laadimisel:', error);
    res.status(500).json({ error: 'Andmebaasi päring ebaõnnestus' });
  }
});

// --- MOODUL 3: Eleringi API sünkroonimine ---
app.post('/api/sync/prices', async (req, res) => {
  try {
    let { start, end, location } = req.body || {};

    // Vaikeväärtused: Kui start/end puuduvad, võta tänane päev (UTC)
    if (!start || !end) {
      const today = new Date();
      start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0)).toISOString();
      end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59)).toISOString();
    }

    // Vaikeväärtus asukohale
    if (!location) {
      location = 'EE';
    }

    const eleringLocation = location.toLowerCase();
    const apiUrl = `https://dashboard.elering.ee/api/nps/price?start=${start}&end=${end}&fields=${eleringLocation}`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API tagastas staatuse: ${response.status}`);
    }

    const data = await response.json();
    const locationData = data.data[eleringLocation];

    if (!locationData || locationData.length === 0) {
      return res.json({ message: "Selle perioodi kohta Eleringist andmeid ei leitud.", processed: 0 });
    }

    let processed = 0;

    // Töötle ja salvesta andmed (uuenda duplikaate)
    for (const item of locationData) {
      const readingDate = new Date(item.timestamp * 1000);
      const upperLocation = location.toUpperCase();

      const existing = await EnergyReading.findOne({
        where: { timestamp: readingDate, location: upperLocation }
      });

      if (existing) {
        await existing.update({ price_eur_mwh: item.price, source: "API" });
      } else {
        await EnergyReading.create({
          timestamp: readingDate,
          location: upperLocation,
          price_eur_mwh: item.price,
          source: "API"
        });
      }
      processed++;
    }

    res.json({ message: "Sünkroonimine edukas", processed });

  } catch (error) {
    console.error('Viga Eleringi sünkroonimisel:', error.message);
    res.status(500).json({ error: "PRICE_API_UNAVAILABLE" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});