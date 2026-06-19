const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, '../data/accounting.db');
let db = null;

function initDatabase() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) { console.error('数据库连接失败:', err.message); process.exit(1); }
        console.log('✅ 数据库连接成功');
        createTables();
    });
}

function createTables() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS tabs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS column_defs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tab_id INTEGER NOT NULL,
            col_key TEXT NOT NULL,
            col_name TEXT NOT NULL,
            col_type TEXT DEFAULT 'text',
            col_options TEXT,
            col_width INTEGER DEFAULT 150,
            col_visible INTEGER DEFAULT 1,
            col_order INTEGER DEFAULT 0,
            is_system INTEGER DEFAULT 0,
            is_income INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (tab_id) REFERENCES tabs(id),
            UNIQUE(user_id, tab_id, col_key)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tab_id INTEGER NOT NULL,
            data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (tab_id) REFERENCES tabs(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, key)
        )`);

        createDefaultAdmin();
    });
}

function createDefaultAdmin() {
    const username = 'admin';
    const password = 'admin123';
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return;
        if (!row) {
            db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
                if (err) return;
                console.log('✅ 默认管理员账号已创建: admin / admin123');
                createDefaultTabForUser(1);
            });
        } else {
            db.get('SELECT id FROM tabs WHERE user_id = ? LIMIT 1', [1], (err, row) => {
                if (err) return;
                if (!row) createDefaultTabForUser(1);
            });
        }
    });
}

function createDefaultTabForUser(userId) {
    db.run('INSERT INTO tabs (user_id, name) VALUES (?, ?)', [userId, '默认'], function(err) {
        if (err) return;
        const tabId = this.lastID;
        createDefaultColumnsForTab(userId, tabId);
        console.log(`✅ 用户 ${userId} 的默认标签已创建`);
    });
}

function createDefaultColumnsForTab(userId, tabId) {
    const defaultColumns = [
        { col_key: 'provider', col_name: '服务商', col_type: 'text', col_order: 0 },
        { col_key: 'months', col_name: '月数', col_type: 'number', col_order: 1 },
        { col_key: 'host_purchase', col_name: '主机购买时间', col_type: 'date', col_order: 2 },
        { col_key: 'host_expire', col_name: '主机到期时间', col_type: 'date', col_order: 3 },
        { col_key: 'host_remaining', col_name: '主机剩余天数', col_type: 'days_remaining', col_order: 4 },
        { col_key: 'ip_address', col_name: 'IP地址', col_type: 'text', col_order: 5 },
        { col_key: 'password', col_name: '密码', col_type: 'text', col_order: 6 },
        { col_key: 'domain', col_name: '域名', col_type: 'text', col_order: 7 },
        { col_key: 'remark', col_name: '备注', col_type: 'text', col_order: 8 },
        { col_key: 'address', col_name: '地址', col_type: 'address_select', col_options: JSON.stringify(['IP地址', '域名地址']), col_order: 9 },
        { col_key: 'expense', col_name: '支出', col_type: 'number', col_order: 10, is_income: 2 },
        { col_key: 'ip_info', col_name: 'IP信息', col_type: 'text', col_order: 11 },
        { col_key: 'client_purchase', col_name: '客户购买时间', col_type: 'date', col_order: 12 },
        { col_key: 'client_expire', col_name: '客户到期时间', col_type: 'date', col_order: 13 },
        { col_key: 'client_remaining', col_name: '客户剩余天数', col_type: 'days_remaining', col_order: 14 },
        { col_key: 'client_name', col_name: '客户名', col_type: 'text', col_order: 15 },
        { col_key: 'unit_price', col_name: '单价/备注', col_type: 'text', col_order: 16 },
        { col_key: 'fee', col_name: '收入', col_type: 'text', col_order: 17 }, // 改为 text 支持公式
        { col_key: 'is_expired', col_name: '是否过期', col_type: 'text', col_order: 18 }
    ];

    const stmt = db.prepare(`
        INSERT OR IGNORE INTO column_defs 
        (user_id, tab_id, col_key, col_name, col_type, col_options, col_order, is_system, col_width, col_visible, is_income)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    defaultColumns.forEach(col => {
        stmt.run([
            userId, tabId, col.col_key, col.col_name, col.col_type,
            col.col_options || null, col.col_order || 0,
            1, 150, 1, col.is_income || 0
        ]);
    });
    stmt.finalize();
    console.log(`✅ 标签 ${tabId} 的默认列已创建`);
}

function getDB() { return db; }
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}
function queryOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}
function execute(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}
function transaction(callback) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            try {
                const result = callback();
                db.run('COMMIT');
                resolve(result);
            } catch (err) {
                db.run('ROLLBACK');
                reject(err);
            }
        });
    });
}

module.exports = {
    initDatabase, getDB, query, queryOne, execute, transaction, DB_PATH
};
