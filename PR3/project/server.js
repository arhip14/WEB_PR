const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data', 'losses.json');

function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return [];
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data || "[]");
    } catch (e) { return []; }
}

function writeData(data) {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/losses', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(readData());
});

app.post('/api/losses', (req, res) => {
    const { section, voltage, length } = req.body;
    const power = 500;
    const lossValue = ((power * parseFloat(length)) / (parseFloat(voltage) * 10)).toFixed(2);

    const newEntry = {
        id: Date.now().toString(),
        section,
        voltage: parseFloat(voltage),
        length: parseFloat(length),
        loss: parseFloat(lossValue),
        date: new Date().toLocaleString('uk-UA')
    };

    const data = readData();
    data.push(newEntry);
    writeData(data);
    res.status(201).json(newEntry);
});

app.delete('/api/losses/:id', (req, res) => {
    const idToDelete = req.params.id;
    let data = readData();

    const newData = data.filter(item => String(item.id) !== String(idToDelete));

    writeData(newData);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Сервер працює: http://localhost:${PORT}`));