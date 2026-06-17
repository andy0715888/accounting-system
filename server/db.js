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
        { col_key: 'date', col_name: '日期', col_type: 'date', col_order: 0 },
        { col_key: 'category', col_name: '类别', col_type: 'text', col_order: 1 },
        { col_key: 'description', col_name: '描述', col_type: 'text', col_order: 2 },
        { col_key: 'amount', col_name: '金额', col_type: 'number', col_order: 3 },
        { col_key: 'type', col_name: '类型', col_type: 'select', col_options: JSON.stringify(['收入', '支出']), col_order: 4 }
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
            1, 150, 1, 0
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
