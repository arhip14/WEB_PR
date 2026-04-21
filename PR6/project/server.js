const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, 'data');
const LOSSES_FILE = path.join(DATA_DIR, 'losses.json');
const DISPATCH_FILE = path.join(DATA_DIR, 'dispatch.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHARGING_FILE = path.join(DATA_DIR, 'charging.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJson(file) {
    try {
        if (!fs.existsSync(file)) return [];
        return JSON.parse(fs.readFileSync(file, 'utf8') || "[]");
    } catch (e) { return []; }
}
function writeJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}


app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "connect-src": ["'self'", "http://localhost:3000", "https://cdn.jsdelivr.net"],
            "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://code.jquery.com"],
            "script-src-attr": ["'unsafe-inline'"],
            "img-src": ["'self'", "data:", "https://images.unsplash.com", "https://tile.openstreetmap.org", "https://*.googleusercontent.com"],
            "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://unpkg.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
            "frame-src": ["'self'", "https://*.google.com", "http://googleusercontent.com", "https://*.googleusercontent.com"],
        },
    },
    referrerPolicy: { policy: "no-referrer" },
    xssFilter: true,
    noSniff: true
}));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(session({
    secret: 'agro-energy-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
    const users = readJson(USERS_FILE);
    const user = users.find(u => u.email === email);
    if (!user) return done(null, false, { message: 'Невірний email' });
    bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) return done(err);
        if (isMatch) return done(null, user);
        return done(null, false, { message: 'Невірний пароль' });
    });
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
    const users = readJson(USERS_FILE);
    const user = users.find(u => u.id === id);
    done(null, user);
});

const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: "Необхідна автентифікація" });
};

const hasRole = (roles) => (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) return next();
    res.status(403).json({ error: "Недостатньо прав доступу" });
};

app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'landing.html'));
    }
});

app.get('/admin', isAuthenticated, hasRole(['network_admin']), (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/driver', isAuthenticated, hasRole(['driver']), (req, res) => res.sendFile(path.join(__dirname, 'public', 'driver.html')));
app.get('/operator', isAuthenticated, hasRole(['station_operator']), (req, res) => res.sendFile(path.join(__dirname, 'public', 'operator.html')));

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.post('/auth/register', async (req, res) => {
    const { email, password, name, role } = req.body;
    const users = readJson(USERS_FILE);
    if (users.find(u => u.email === email)) return res.status(400).json({ error: "Користувач вже існує" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now(), email, password: hashedPassword, name, role: role || 'driver', balance: 1000.00 };
    users.push(newUser);
    writeJson(USERS_FILE, users);
    res.status(201).json({ message: "Реєстрація успішна" });
});

app.post('/auth/login', passport.authenticate('local'), (req, res) => {
    res.json({ message: "Вхід успішний", user: { name: req.user.name, role: req.user.role } });
});

app.post('/auth/logout', (req, res) => {
    if (req.isAuthenticated()) {
        const userId = req.user.id;
        const reservations = readJson(CHARGING_FILE);
        const users = readJson(USERS_FILE);
        const activeResIdx = reservations.findIndex(r => r.userId === userId && r.status === 'active');
        if (activeResIdx !== -1) {
            const reservation = reservations[activeResIdx];
            reservation.status = 'cancelled';
            const uIdx = users.findIndex(u => u.id === userId);
            if (uIdx !== -1) {
                users[uIdx].balance = parseFloat((users[uIdx].balance + reservation.amount).toFixed(2));
                writeJson(USERS_FILE, users);
            }
            writeJson(CHARGING_FILE, reservations);
        }
    }
    req.logout((err) => {
        if (err) return res.status(500).json({ error: "Помилка виходу" });
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.json({ message: "Вихід успішний" });
        });
    });
});

app.get('/auth/status', (req, res) => {
    if (!req.isAuthenticated()) return res.json({ authenticated: false });
    const users = readJson(USERS_FILE);
    const reservations = readJson(CHARGING_FILE);
    const user = users.find(u => u.id === req.user.id);
    const activeRes = reservations.find(r => r.userId === req.user.id && r.status === 'active');

    res.json({
        authenticated: true,
        user: {
            name: user.name,
            role: user.role,
            balance: user.balance || 0,
            activeReservation: activeRes ? activeRes.stationName : null
        }
    });
});

let dispatchState = {
    dispatchData: { id: 10, name: "Головний диспетчерський центр АгроЕнерго", totalGeneration: 540.5, totalLoad: 510.2, frequency: 50.00, alarmCount: 2 },
    objects: [{ id: 101, name: "Біогазова установка №1", status: "online" }, { id: 103, name: "Вітрогенератор А1", status: "offline" }]
};

app.get('/api/dispatch-center', isAuthenticated, (req, res) => {
    dispatchState.dispatchData.frequency = parseFloat((50 + (Math.random() * 0.04 - 0.02)).toFixed(2));
    res.json(dispatchState.dispatchData);
});

app.get('/api/dispatch-center/balance', isAuthenticated, (req, res) => {
    res.json({
        generation: dispatchState.dispatchData.totalGeneration,
        load: dispatchState.dispatchData.totalLoad,
        balance: (dispatchState.dispatchData.totalGeneration - dispatchState.dispatchData.totalLoad).toFixed(2)
    });
});

app.get('/api/losses', isAuthenticated, (req, res) => res.json(readJson(LOSSES_FILE)));
app.post('/api/losses', isAuthenticated, (req, res) => {
    const { section, voltage, length } = req.body;
    const loss = ((500 * parseFloat(length)) / (parseFloat(voltage) * 10)).toFixed(2);
    const entry = { id: Date.now(), section, voltage, length, loss: parseFloat(loss), date: new Date().toLocaleString() };
    const data = readJson(LOSSES_FILE);
    data.push(entry);
    writeJson(LOSSES_FILE, data);
    res.json(entry);
});
app.delete('/api/losses/:id', isAuthenticated, (req, res) => {
    let data = readJson(LOSSES_FILE);
    data = data.filter(item => String(item.id) !== String(req.params.id));
    writeJson(LOSSES_FILE, data);
    res.json({ success: true });
});

let mgData = { solar: 120, wind: 80, load: 150, battery: 75 };
app.get('/api/microgrid/current', isAuthenticated, (req, res) => {
    if (req.query.solar) mgData.solar = parseFloat(req.query.solar);
    if (req.query.load) mgData.load = parseFloat(req.query.load);
    const totalGen = mgData.solar + mgData.wind;
    res.json({ ...mgData, totalGeneration: totalGen.toFixed(2), balance: (totalGen - mgData.load).toFixed(2) });
});


let stationLogs = [
    { time: "20:00:10", event: "Система моніторингу активована" },
    { time: "20:02:45", event: "Параметри інверторів у нормі" },
    { time: "20:05:00", event: "Зв'язок із сервером: Стабільний" }
];

app.get('/api/operator/stats', isAuthenticated, hasRole(['station_operator']), (req, res) => {
    res.json({ uptime: "14д 06г 22хв", logs: stationLogs.slice(-10).reverse() });
});

app.post('/api/operator/command', isAuthenticated, hasRole(['station_operator']), (req, res) => {
    const { command } = req.body;
    stationLogs.push({
        time: new Date().toLocaleTimeString('uk-UA'),
        event: command
    });
    res.json({ success: true });
});


app.get('/api/payments/history', isAuthenticated, (req, res) => {
    const payments = readJson(PAYMENTS_FILE);
    const userHistory = payments.filter(p => p.userId === req.user.id).reverse().slice(0, 5);
    res.json(userHistory);
});

app.post('/api/charging/reserve', isAuthenticated, hasRole(['driver']), (req, res) => {
    const { stationId, stationName, planPrice } = req.body;
    const users = readJson(USERS_FILE);
    const reservations = readJson(CHARGING_FILE);
    const payments = readJson(PAYMENTS_FILE);
    const uIdx = users.findIndex(u => u.id === req.user.id);
    const price = parseFloat(planPrice);

    if (users[uIdx].balance < price) return res.status(400).json({ error: `Недостатньо коштів! Баланс: ${users[uIdx].balance}₴` });
    if (reservations.find(r => r.userId === req.user.id && r.status === 'active')) return res.status(400).json({ error: "У вас вже є активне бронювання!" });

    users[uIdx].balance = parseFloat((users[uIdx].balance - price).toFixed(2));
    reservations.push({ id: Date.now(), userId: req.user.id, stationName, amount: price, status: 'active', time: new Date() });
    payments.push({ userId: req.user.id, type: 'minus', title: `Зарядка ${stationName}`, amount: price, date: new Date() });

    writeJson(USERS_FILE, users);
    writeJson(CHARGING_FILE, reservations);
    writeJson(PAYMENTS_FILE, payments);
    res.json({ message: `Заброньовано! Списано ${price}₴`, newBalance: users[uIdx].balance });
});

app.post('/api/charging/cancel', isAuthenticated, hasRole(['driver']), (req, res) => {
    const reservations = readJson(CHARGING_FILE);
    const users = readJson(USERS_FILE);
    const payments = readJson(PAYMENTS_FILE);
    const rIdx = reservations.findIndex(r => r.userId === req.user.id && r.status === 'active');
    if (rIdx === -1) return res.status(404).json({ error: "Не знайдено" });

    const amount = reservations[rIdx].amount;
    reservations[rIdx].status = 'cancelled';
    const uIdx = users.findIndex(u => u.id === req.user.id);
    users[uIdx].balance = parseFloat((users[uIdx].balance + amount).toFixed(2));
    payments.push({ userId: req.user.id, type: 'plus', title: 'Повернення (скасування)', amount: amount, date: new Date() });

    writeJson(USERS_FILE, users);
    writeJson(CHARGING_FILE, reservations);
    writeJson(PAYMENTS_FILE, payments);
    res.json({ message: "Кошти повернуто", newBalance: users[uIdx].balance });
});

app.post('/api/payment/process', isAuthenticated, hasRole(['driver']), (req, res) => {
    const { amount } = req.body;
    const users = readJson(USERS_FILE);
    const payments = readJson(PAYMENTS_FILE);
    const uIdx = users.findIndex(u => u.id === req.user.id);
    const topUp = parseFloat(amount);
    users[uIdx].balance = parseFloat(((users[uIdx].balance || 0) + topUp).toFixed(2));
    payments.push({ userId: req.user.id, type: 'plus', title: 'Поповнення', amount: topUp, date: new Date() });

    writeJson(USERS_FILE, users);
    writeJson(PAYMENTS_FILE, payments);
    res.json({ message: "Успішно!", newBalance: users[uIdx].balance });
});


app.get('/api/admin/stats', isAuthenticated, hasRole(['network_admin']), (req, res) => {
    const users = readJson(USERS_FILE);
    const reservations = readJson(CHARGING_FILE);
    const payments = readJson(PAYMENTS_FILE);

    const totalMoney = payments.filter(p => p.type === 'plus').reduce((sum, p) => sum + p.amount, 0);
    const activeNow = reservations.filter(r => r.status === 'active').length;

    res.json({
        totalUsers: users.length,
        totalMoney: totalMoney.toFixed(2),
        activeReservations: activeNow,
        latestReservations: reservations.slice(-10).reverse().map(r => {
            const user = users.find(u => u.id === r.userId);
            return { ...r, userName: user ? user.name : 'Unknown' };
        })
    });
});

app.listen(PORT, () => console.log(`🚀 СЕРВЕР ПРАЦЮЄ: http://localhost:${PORT}`));