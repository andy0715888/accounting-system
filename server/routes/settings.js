const express = require('express');
const { query, queryOne, execute } = require('../db');
const fs = require('fs');
const path = require('path');

const router = express.Router();

function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: '请先登录' });
    next();
}

// 获取所有设置
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const settings = await query('SELECT key, value FROM settings WHERE user_id = ?', [userId]);
        const result = {};
        settings.forEach(s => {
            try { result[s.key] = JSON.parse(s.value); } catch { result[s.key] = s.value; }
        });
        // 额外返回全局注册开关（该设置对所有用户有效，但存在用户级则覆盖）
        const globalAllow = await queryOne("SELECT value FROM settings WHERE key = 'allow_register'");
        if (globalAllow) {
            try { result.allow_register = JSON.parse(globalAllow.value); } catch { result.allow_register = globalAllow.value; }
        } else {
            result.allow_register = true; // 默认允许
        }
        res.json(result);
    } catch (err) {
        console.error('获取设置错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.get('/:key', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { key } = req.params;
        const setting = await queryOne('SELECT value FROM settings WHERE user_id = ? AND key = ?', [userId, key]);
        if (!setting) {
            // 如果是注册开关，检查全局设置
            if (key === 'allow_register') {
                const global = await queryOne("SELECT value FROM settings WHERE key = 'allow_register'");
                if (global) {
                    try { return res.json({ value: JSON.parse(global.value) }); } catch { return res.json({ value: global.value }); }
                }
                return res.json({ value: true });
            }
            return res.json({ value: null });
        }
        try { res.json({ value: JSON.parse(setting.value) }); } catch { res.json({ value: setting.value }); }
    } catch (err) {
        console.error('获取设置错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ error: '设置键不能为空' });

        // 如果是注册开关，存到全局（不区分用户）
        if (key === 'allow_register') {
            // 检查是否为管理员（这里简单判断 userId=1 为管理员）
            if (userId !== 1) {
                return res.status(403).json({ error: '只有管理员可以修改注册开关' });
            }
            const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
            await execute(`
                INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
                ON CONFLICT(user_id, key) DO UPDATE SET value = ?
            `, [1, key, jsonValue, jsonValue]); // 存入 userId=1 作为全局
            return res.json({ success: true, message: '注册开关已更新' });
        }

        const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
        await execute(`
            INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
            ON CONFLICT(user_id, key) DO UPDATE SET value = ?
        `, [userId, key, jsonValue, jsonValue]);

        res.json({ success: true, message: '设置已保存' });
    } catch (err) {
        console.error('保存设置错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.delete('/:key', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { key } = req.params;
        await execute('DELETE FROM settings WHERE user_id = ? AND key = ?', [userId, key]);
        res.json({ success: true, message: '设置已删除' });
    } catch (err) {
        console.error('删除设置错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.delete('/background', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const setting = await queryOne('SELECT value FROM settings WHERE user_id = ? AND key = ?', [userId, 'background']);
        if (setting) {
            try {
                const bg = JSON.parse(setting.value);
                if (bg.type === 'local' && bg.path) {
                    const filePath = path.join(__dirname, '../../', bg.path);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
            } catch {}
        }
        await execute('DELETE FROM settings WHERE user_id = ? AND key = ?', [userId, 'background']);
        res.json({ success: true, message: '背景已移除' });
    } catch (err) {
        console.error('删除背景错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.post('/cert', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { certPath, keyPath } = req.body;
        if (!certPath || !keyPath) return res.status(400).json({ error: '请提供证书和密钥路径' });
        if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
            return res.status(400).json({ error: '证书或密钥文件不存在' });
        }

        await execute(`INSERT INTO settings (user_id, key, value) VALUES (?, 'cert_path', ?) ON CONFLICT(user_id, key) DO UPDATE SET value = ?`, [userId, certPath, certPath]);
        await execute(`INSERT INTO settings (user_id, key, value) VALUES (?, 'key_path', ?) ON CONFLICT(user_id, key) DO UPDATE SET value = ?`, [userId, keyPath, keyPath]);

        res.json({ success: true, message: '证书路径已保存，重启服务生效' });
    } catch (err) {
        console.error('保存证书路径错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});
// 添加在 settings.js 的末尾
router.post('/favicon', requireAuth, async (req, res) => {
    try {
        const { path: filePath } = req.body;
        if (!filePath) return res.status(400).json({ error: '缺少文件路径' });
        const src = path.join(__dirname, '../../', filePath);
        const dest = path.join(__dirname, '../../public/favicon.ico');
        if (!fs.existsSync(src)) return res.status(404).json({ error: '源文件不存在' });
        fs.copyFileSync(src, dest);
        res.json({ success: true, message: '图标更新成功' });
    } catch (err) {
        console.error('更新图标错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

module.exports = router;
