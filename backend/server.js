require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { EnergyReading, sequelize } = require('./models');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// MOODUL 1: Health endpoint
// ============================================================
app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', db: 'ok' });
  } catch (error) {
    console.error('Andmebaasi viga:', error);
    res.status(500).json({ status: 'error', db: 'error' });
  }
});

// ============================================================
// MOODUL 2: JSON import
// Loeb energy_dump.json faili, valideerib ja salvestab andmeid
// ============================================================
app.post('/api/import/json', async (req, res) => {
  const results = { inserted: 0, skipped: 0, duplicates_detected: 0 };

  try {
    // Otsi faili projekti juurkaustas
    const filePath = path.join(__dirname, '..', 'energy_dump.json');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'energy_dump.json faili ei leitud' });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const records = JSON.parse(raw);

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'JSON peab olema massiiv' });
    }

    for (const record of records) {
      // 3.1 Valideeri timestamp
      if (!record.timestamp) {
        results.skipped++;
        continue;
      }
      const parsedDate = new Date(record.timestamp);
      if (isNaN(parsedDate.getTime())) {
        results.skipped++;
        continue;
      }
      // UNIX timestamp ei ole lubatud
      if (typeof record.timestamp === 'number') {
        results.skipped++;
        continue;
      }
      // Peab olema ISO 8601 UTC formaadis
      if (typeof record.timestamp !== 'string' || !record.timestamp.includes('T')) {
        results.skipped++;
        continue;
      }

      // 3.2 Puuduv asukoht → vaikimisi EE
      const location = record.location ? record.location.toUpperCase() : 'EE';

      // 3.3 Valideeri price_eur_mwh
      if (record.price_eur_mwh !== null && record.price_eur_mwh !== undefined) {
        if (typeof record.price_eur_mwh === 'string') {
          results.skipped++;
          continue;
        }
      }
      const price = (record.price_eur_mwh !== undefined && record.price_eur_mwh !== null)
        ? Number(record.price_eur_mwh)
        : null;

      // 3.4 Kontrolli duplikaate
      const existing = await EnergyReading.findOne({
        where: { timestamp: parsedDate, location }
      });

      if (existing) {
        results.duplicates_detected++;
        continue; // duplikaadid ignoreeritakse impordi puhul
      }

      // 3.5 Salvesta
      await EnergyReading.create({
        timestamp: parsedDate,
        location,
        price_eur_mwh: price,
        source: 'UPLOAD'
      });
      results.inserted++;
    }

    console.log(`Import lõpetatud: ${JSON.stringify(results)}`);
    res.json({
      message: 'Import completed',
      ...results
    });
  } catch (error) {
    console.error('Import ebaõnnestus:', error.message);
    res.status(500).json({ error: 'Impordi viga: ' + error.message });
  }
});

// ============================================================
// MOODUL 2/4: Andmete pärimine filtritega
// GET /api/readings?start=...&end=...&location=...
// ============================================================
app.get('/api/readings', async (req, res) => {
  try {
    const { start, end, location } = req.query;

    // Valideeri kohustuslik location parameeter
    const allowedLocations = ['EE', 'LV', 'FI'];
    if (location && !allowedLocations.includes(location.toUpperCase())) {
      return res.status(400).json({ error: 'Vigane asukoht. Lubatud: EE, LV, FI' });
    }

    // Ehita filtrid
    const where = {};

    if (location) {
      where.location = location.toUpperCase();
    }

    if (start || end) {
      where.timestamp = {};
      if (start) {
        const startDate = new Date(start);
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ error: 'Vigane start kuupäev (ISO 8601 UTC nõutud)' });
        }
        where.timestamp[Op.gte] = startDate;
      }
      if (end) {
        const endDate = new Date(end);
        if (isNaN(endDate.getTime())) {
          return res.status(400).json({ error: 'Vigane end kuupäev (ISO 8601 UTC nõutud)' });
        }
        where.timestamp[Op.lte] = endDate;
      }
    }

    const readings = await EnergyReading.findAll({
      where,
      order: [['timestamp', 'ASC']],
    });

    res.json(readings);
  } catch (error) {
    console.error('Viga andmete laadimisel:', error);
    res.status(500).json({ error: 'Andmebaasi päring ebaõnnestus' });
  }
});

// ============================================================
// MOODUL 3: Eleringi API sünkroonimine
// POST /api/sync/prices
// ============================================================
app.post('/api/sync/prices', async (req, res) => {
  try {
    let { start, end, location } = req.body || {};

    // Vaikeväärtused: tänane päev UTC-s
    if (!start || !end) {
      const today = new Date();
      start = new Date(Date.UTC(
        today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0
      )).toISOString();
      end = new Date(Date.UTC(
        today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59
      )).toISOString();
    }

    // Vaikeväärtus asukohale
    if (!location) location = 'EE';

    // Teisenda sisemised väärtused välisteks (EE → ee)
    const eleringLocation = location.toLowerCase();

    const apiUrl = `https://dashboard.elering.ee/api/nps/price?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&fields=${eleringLocation}`;

    console.log(`Eleringi päring: ${apiUrl}`);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Elering tagastas staatuse: ${response.status}`);
    }

    const data = await response.json();

    // Kontrolli vastuse struktuuri
    if (!data || !data.data || !data.data[eleringLocation]) {
      return res.json({
        message: 'Selle perioodi kohta Eleringist andmeid ei leitud.',
        processed: 0
      });
    }

    const locationData = data.data[eleringLocation];

    if (!Array.isArray(locationData) || locationData.length === 0) {
      return res.json({
        message: 'Selle perioodi kohta andmeid ei leitud.',
        processed: 0
      });
    }

    let processed = 0;
    const upperLocation = location.toUpperCase();

    for (const item of locationData) {
      // Elering tagastab UNIX timestamp (sekundites) → teisenda Date objektiks
      const readingDate = new Date(item.timestamp * 1000);

      // PARANDUS: Elering tagastab hinna EUR/MWh × 10 (ehk senti/MWh)
      // Jagame 10-ga, et saada õige EUR/MWh väärtus
      const priceEurMwh = typeof item.price === 'number' ? item.price / 10 : null;

      // Upsert: uuenda olemasolevat või loo uus kirje
      const existing = await EnergyReading.findOne({
        where: { timestamp: readingDate, location: upperLocation }
      });

      if (existing) {
        await existing.update({ price_eur_mwh: priceEurMwh, source: 'API' });
      } else {
        await EnergyReading.create({
          timestamp: readingDate,
          location: upperLocation,
          price_eur_mwh: priceEurMwh,
          source: 'API'
        });
      }
      processed++;
    }

    console.log(`Sünkrooniti ${processed} kirjet (${upperLocation})`);
    res.json({ message: 'Sünkroonimine edukas', processed });

  } catch (error) {
    console.error('Viga Eleringi sünkroonimisel:', error.message);
    // Kasutajasõbralik veateade, mitte tehniline stack trace
    res.status(500).json({ error: 'PRICE_API_UNAVAILABLE' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server töötab: http://localhost:${PORT}`);
});