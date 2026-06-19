const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const https = require('https');
const http = require('http');

const { initDatabase, queryOne } = require('./db');
const authRoutes = require('./routes/auth');
const recordRoutes = require('./routes/records');
const columnRoutes = require('./routes/columns');
const settingRoutes = require('./routes/settings');
const tabRoutes = require('./routes/tabs');

const app = express();
const PORT = process.env.PORT || 3000;

const dirs = ['data', 'uploads', 'public/images'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
// 托管上传目录，使背景图片等可被浏览器访问
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use(session({
    secret: 'accounting-system-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${Date.now()}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (types.includes(file.mimetype)) cb(null, true);
        else cb(new Error('只支持图片格式'));
    }
});

app.use('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: '请上传图片' });
    res.json({ success: true, url: `/uploads/${req.file.filename}` });
});

initDatabase();

app.use('/api/auth', authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/tabs', tabRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/main', (req, res) => res.sendFile(path.join(__dirname, '../public/main.html')));

async function startServer() {
    let certPath = null, keyPath = null;
    try {
        const certSetting = await queryOne("SELECT value FROM settings WHERE key = 'cert_path'");
        const keySetting = await queryOne("SELECT value FROM settings WHERE key = 'key_path'");
        if (certSetting) certPath = certSetting.value;
        if (keySetting) keyPath = keySetting.value;
    } catch (err) {}

    if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        try {
            const cert = fs.readFileSync(certPath);
            const key = fs.readFileSync(keyPath);
            const httpsServer = https.createServer({ cert, key }, app);
            httpsServer.listen(PORT, () => {
                console.log(`📊 记账系统已启动 (HTTPS) 端口 ${PORT}`);
            });
        } catch (err) {
            console.warn('HTTPS 启动失败，降级为 HTTP');
            startHttp();
        }
    } else {
        startHttp();
    }
}

function startHttp() {
    app.listen(PORT, () => {
        console.log(`📊 记账系统已启动 (HTTP) 端口 ${PORT}`);
    });
}

startServer();
