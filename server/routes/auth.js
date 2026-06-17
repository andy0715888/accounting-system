const express = require('express');
const bcrypt = require('bcrypt');
const { query, queryOne, execute } = require('../db');
const { getDB } = require('../db'); // 引入 db 用于 prepare

const router = express.Router();

// 检查是否允许注册
async function isRegisterAllowed() {
    const setting = await queryOne("SELECT value FROM settings WHERE key = 'allow_register'");
    if (!setting) return true; // 默认允许
    try {
        return JSON.parse(setting.value) !== false;
    } catch {
        return true;
    }
}

router.post('/register', async (req, res) => {
    try {
        // 检查注册开关
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

        // 为新用户创建默认标签和列
        await execute('INSERT INTO tabs (user_id, name) VALUES (?, ?)', [userId, '默认']);
        const tab = await queryOne('SELECT id FROM tabs WHERE user_id = ?', [userId]);
        if (tab) {
            const db = getDB();
            const defaultColumns = [
                { col_key: 'date', col_name: '日期', col_type: 'date', col_order: 0 },
                { col_key: 'category', col_name: '类别', col_type: 'text', col_order: 1 },
                { col_key: 'description', col_name: '描述', col_type: 'text', col_order: 2 },
                { col_key: 'amount', col_name: '金额', col_type: 'number', col_order: 3 },
                { col_key: 'type', col_name: '类型', col_type: 'select', col_options: JSON.stringify(['收入', '支出']), col_order: 4 }
            ];
            const stmt = db.prepare(`
                INSERT INTO column_defs 
                (user_id, tab_id, col_key, col_name, col_type, col_options, col_order, is_system, col_width, col_visible, is_income)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            defaultColumns.forEach(col => {
                stmt.run([userId, tab.id, col.col_key, col.col_name, col.col_type, col.col_options || null, col.col_order || 0, 1, 150, 1, 0]);
            });
            stmt.finalize();
        }
        res.json({ success: true, message: '注册成功' });
    } catch (err) {
        console.error('注册错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 其他路由（login, check, logout, change-password）保持不变
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
