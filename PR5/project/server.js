const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const LOSSES_FILE = path.join(DATA_DIR, 'losses.json');
const DISPATCH_FILE = path.join(DATA_DIR, 'dispatch.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use((req, res, next) => {
    res.setHeader('X-Powered-By', 'AgroEnergy-Core-Pro');
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

const validateDispatchData = (data) => {
    const errors = [];
    if (data.frequency && (data.frequency < 49.5 || data.frequency > 50.5)) {
        errors.push("Частота мережі поза межами норми (49.5 - 50.5 Гц)");
    }
    if (data.totalGeneration < 0 || data.totalLoad < 0) {
        errors.push("Потужність не може бути від'ємною");
    }
    return errors;
};

function readData() {
    try {
        if (!fs.existsSync(LOSSES_FILE)) return [];
        const data = fs.readFileSync(LOSSES_FILE, 'utf8');
        return JSON.parse(data || "[]");
    } catch (e) { return []; }
}

function writeData(data) {
    fs.writeFileSync(LOSSES_FILE, JSON.stringify(data, null, 2));
}

function loadDispatchState() {
    const defaultState = {
        dispatchData: {
            id: 10,
            name: "Головний диспетчерський центр АгроЕнерго",
            monitoredObjects: 12,
            totalGeneration: 540.5,
            totalLoad: 510.2,
            frequency: 50.00,
            systemBalance: 30.3,
            alarmCount: 2,
            operatorCount: 4
        },
        objects: [
            { id: 101, name: "Біогазова установка №1", status: "online" },
            { id: 102, name: "Сонячна панель (Південь)", status: "online" },
            { id: 103, name: "Вітрогенератор А1", status: "offline" }
        ]
    };
    try {
        if (!fs.existsSync(DISPATCH_FILE)) return defaultState;
        const data = fs.readFileSync(DISPATCH_FILE, 'utf8');
        const parsed = JSON.parse(data);
        if (!parsed.objects) parsed.objects = defaultState.objects;
        return parsed;
    } catch (e) { return defaultState; }
}

function saveDispatchState(state) {
    fs.writeFileSync(DISPATCH_FILE, JSON.stringify(state, null, 2));
}

let dispatchState = loadDispatchState();

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

app.get('/api/dispatch-center', (req, res) => {
    const gen = Number(dispatchState.dispatchData.totalGeneration) || 0;
    const load = Number(dispatchState.dispatchData.totalLoad) || 0;
    dispatchState.dispatchData.systemBalance = parseFloat((gen - load).toFixed(2));
    dispatchState.dispatchData.frequency = parseFloat((50 + (Math.random() * 0.04 - 0.02)).toFixed(2));
    res.json(dispatchState.dispatchData);
});

app.get('/api/dispatch-center/balance', (req, res) => {
    const gen = Number(dispatchState.dispatchData.totalGeneration) || 0;
    const load = Number(dispatchState.dispatchData.totalLoad) || 0;
    const balance = parseFloat((gen - load).toFixed(2));
    res.json({
        generation: gen,
        load: load,
        balance: balance,
        status: balance >= 0 ? "surplus" : "deficit"
    });
});

app.get('/api/dispatch-center/objects', (req, res) => {
    res.json(dispatchState.objects || []);
});

app.post('/api/dispatch-center/commands', (req, res) => {
    try {
        const { command, targetId } = req.body;
        if (!dispatchState.objects) dispatchState = loadDispatchState();
        const obj = dispatchState.objects.find(o => o.id === parseInt(targetId));
        if (!obj) return res.status(404).json({ error: "Об'єкт не знайдено" });
        if (command === 'START' && obj.status !== 'online') {
            obj.status = 'online';
            dispatchState.dispatchData.totalGeneration = Number(dispatchState.dispatchData.totalGeneration) + 50;
            dispatchState.dispatchData.alarmCount = Math.max(0, dispatchState.dispatchData.alarmCount - 1);
        } else if (command === 'STOP' && obj.status !== 'offline') {
            obj.status = 'offline';
            dispatchState.dispatchData.totalGeneration = Math.max(0, dispatchState.dispatchData.totalGeneration - 50);
            dispatchState.dispatchData.alarmCount += 1;
        }
        saveDispatchState(dispatchState);
        res.status(201).json({ success: true, message: `Команда ${command} виконана` });
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.put('/api/dispatch-center', (req, res) => {
    const errors = validateDispatchData(req.body);
    if (errors.length > 0) {
        return res.status(400).json({ success: false, errors });
    }
    dispatchState.dispatchData = { ...dispatchState.dispatchData, ...req.body, id: 10 };
    saveDispatchState(dispatchState);
    res.json(dispatchState.dispatchData);
});

let microgridData = {
    solar: 120.5,
    wind: 85.2,
    load: 150.0,
    battery: 75,
    gridExchange: -55.7
};

function updateMicrogridLogic() {
    const variance = (base, range) => base + (Math.random() - 0.5) * range;
    microgridData.wind = Math.max(0, variance(80, 30));

    let totalGen = microgridData.solar + microgridData.wind;
    let balance = totalGen - microgridData.load;

    if (balance > 0) {
        if (microgridData.battery < 100) microgridData.battery += 0.5;
        microgridData.gridExchange = -(balance * 0.7);
    } else {
        if (microgridData.battery > 10) microgridData.battery -= 0.3;
        microgridData.gridExchange = Math.abs(balance) * 0.8;
    }
}

setInterval(updateMicrogridLogic, 3000);

app.get('/api/microgrid/current', (req, res) => {
    const s = req.query.solar ? parseFloat(req.query.solar) : microgridData.solar;
    const l = req.query.load ? parseFloat(req.query.load) : microgridData.load;

    microgridData.solar = s;
    microgridData.load = l;

    const totalGen = s + microgridData.wind;
    const balance = (totalGen - l).toFixed(2);

    res.json({
        ...microgridData,
        solar: s,
        load: l,
        totalGeneration: totalGen.toFixed(2),
        balance: balance,
        timestamp: new Date().toLocaleTimeString()
    });
});

app.listen(PORT, () => {
    console.log(`🚀 СЕРВЕР: http://localhost:${PORT}`);
});