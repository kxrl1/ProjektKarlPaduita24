require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { EnergyReading } = require('./models');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/status', (req, res) => {
    res.json({ message: 'Server is running!' });
});

app.get('/api/readings', async (req, res) => {
  try {
    const readings = await EnergyReading.findAll();
    res.json(readings);
  } catch (error) {
    console.error('Viga andmete laadimisel:', error);
    res.status(500).json({ error: 'Andmebaasi päring ebaõnnestus' });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});