const express = require('express');
const bcrypt = require('bcrypt');
const { query, queryOne, execute } = require('../db');
const { getDB } = require('../db');

const router = express.Router();

async function isRegisterAllowed() {
    const setting = await queryOne("SELECT value FROM settings WHERE key = 'allow_register'");
    if (!setting) return true;
    try {
        return JSON.parse(setting.value) !== false;
    } catch {
        return true;
    }
}

router.post('/register', async (req, res) => {
    try {
        const allowed = await isRegisterAllowed();
        if (!allowed) {
            return res.status(403).json({ error: '管理员已关闭注册功能' });
        }

        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
        if (password.length < 6) return res.status(400).json({ error: '密码长度至少6位' });

        const existing = await queryOne('SELECT id FROM users WHERE username = ?', [username]);
        if (existing) return res.status(400).json({ error: '用户名已存在' });

        const hashedPassword = bcrypt.hashSync(password, 10);
        const result = await execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        const userId = result.lastID;

        await execute('INSERT INTO tabs (user_id, name) VALUES (?, ?)', [userId, '默认']);
        const tab = await queryOne('SELECT id FROM tabs WHERE user_id = ?', [userId]);
        if (tab) {
            const db = getDB();
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
                { col_key: 'fee', col_name: '收入', col_type: 'text', col_order: 17 },
                { col_key: 'is_expired', col_name: '是否过期', col_type: 'text', col_order: 18 }
            ];
            const stmt = db.prepare(`
                INSERT INTO column_defs 
                (user_id, tab_id, col_key, col_name, col_type, col_options, col_order, is_system, col_width, col_visible, is_income)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            defaultColumns.forEach(col => {
                stmt.run([
                    userId, tab.id, col.col_key, col.col_name, col.col_type,
                    col.col_options || null, col.col_order || 0,
                    1, 150, 1, col.is_income || 0
                ]);
            });
            stmt.finalize();
        }
        res.json({ success: true, message: '注册成功' });
    } catch (err) {
        console.error('注册错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

        const user = await queryOne('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) return res.status(401).json({ error: '用户名或密码错误' });

        const isValid = bcrypt.compareSync(password, user.password);
        if (!isValid) return res.status(401).json({ error: '用户名或密码错误' });

        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({ success: true, user: { id: user.id, username: user.username } });
    } catch (err) {
        console.error('登录错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.get('/check', (req, res) => {
    if (req.session.userId) {
        res.json({ loggedIn: true, user: { id: req.session.userId, username: req.session.username } });
    } else {
        res.json({ loggedIn: false });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: '退出失败' });
        res.json({ success: true });
    });
});

router.post('/change-password', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: '未登录' });
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) return res.status(400).json({ error: '请填写完整' });
        if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少6位' });

        const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        if (!user) return res.status(404).json({ error: '用户不存在' });

        const isValid = bcrypt.compareSync(oldPassword, user.password);
        if (!isValid) return res.status(401).json({ error: '原密码错误' });

        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        await execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.session.userId]);
        res.json({ success: true, message: '密码修改成功' });
    } catch (err) {
        console.error('修改密码错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

module.exports = router;
