const express = require('express');
const { query, queryOne, execute } = require('../db');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const SYSTEM_USER_ID = 1;
const SYSTEM_SETTING_KEYS = new Set(['allow_register', 'background']);

function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: '请先登录' });
    next();
}

function parseSettingValue(value) {
    if (value === null || value === undefined) return null;
    try { return JSON.parse(value); } catch { return value; }
}

async function getSettingValue(userId, key) {
    const setting = await queryOne('SELECT value FROM settings WHERE user_id = ? AND key = ?', [userId, key]);
    return setting ? parseSettingValue(setting.value) : null;
}

async function getEffectiveSettingValue(userId, key) {
    if (SYSTEM_SETTING_KEYS.has(key)) {
        return getSettingValue(SYSTEM_USER_ID, key);
    }
    return getSettingValue(userId, key);
}

async function saveSettingValue(userId, key, value) {
    const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
    await execute(`
        INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
        ON CONFLICT(user_id, key) DO UPDATE SET value = ?
    `, [userId, key, jsonValue, jsonValue]);
}

function normalizeBackground(value) {
    if (!value || typeof value !== 'object') return null;
    if (value.type === 'url') {
        const url = String(value.url || '').trim();
        if (!/^https?:\/\//i.test(url)) return null;
        return { type: 'url', url };
    }
    if (value.type === 'local') {
        const localPath = String(value.path || '').trim();
        if (!localPath.startsWith('/uploads/')) return null;
        return { type: 'local', path: localPath };
    }
    return null;
}

function getUploadedFilePath(publicPath) {
    if (!publicPath || !publicPath.startsWith('/uploads/')) return null;
    const fileName = path.basename(publicPath);
    return path.join(__dirname, '../../uploads', fileName);
}

async function removeStoredBackgroundFile() {
    const bg = await getSettingValue(SYSTEM_USER_ID, 'background');
    if (!bg || bg.type !== 'local' || !bg.path) return;
    const filePath = getUploadedFilePath(bg.path);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// 公开读取背景（供登录页使用）
router.get('/public/background', async (req, res) => {
    try {
        const value = await getSettingValue(SYSTEM_USER_ID, 'background');
        res.json({ value });
    } catch (err) {
        console.error('获取公开背景错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const settings = await query('SELECT key, value FROM settings WHERE user_id = ?', [userId]);
        const result = {};
        settings.forEach(s => { result[s.key] = parseSettingValue(s.value); });

        const allowRegister = await getSettingValue(SYSTEM_USER_ID, 'allow_register');
        result.allow_register = allowRegister !== null ? allowRegister : true;

        const background = await getSettingValue(SYSTEM_USER_ID, 'background');
        if (background) result.background = background;

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
        const value = await getEffectiveSettingValue(userId, key);

        if (value === null) {
            if (key === 'allow_register') return res.json({ value: true });
            if (key === 'ip_port_suffix' || key === 'domain_port_suffix') return res.json({ value: '' });
            return res.json({ value: null });
        }

        res.json({ value });
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

        if (key === 'allow_register') {
            if (userId !== SYSTEM_USER_ID) {
                return res.status(403).json({ error: '只有管理员可以修改注册开关' });
            }
            await saveSettingValue(SYSTEM_USER_ID, key, value);
            return res.json({ success: true, message: '注册开关已更新' });
        }

        if (key === 'background') {
            const bg = normalizeBackground(value);
            if (!bg) return res.status(400).json({ error: '背景设置格式错误' });
            await removeStoredBackgroundFile();
            await saveSettingValue(SYSTEM_USER_ID, key, bg);
            return res.json({ success: true, message: '背景已保存' });
        }

        await saveSettingValue(userId, key, value);
        res.json({ success: true, message: '设置已保存' });
    } catch (err) {
        console.error('保存设置错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.delete('/background', requireAuth, async (req, res) => {
    try {
        await removeStoredBackgroundFile();
        await execute('DELETE FROM settings WHERE user_id = ? AND key = ?', [SYSTEM_USER_ID, 'background']);
        res.json({ success: true, message: '背景已移除' });
    } catch (err) {
        console.error('删除背景错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.delete('/:key', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { key } = req.params;
        const ownerId = SYSTEM_SETTING_KEYS.has(key) ? SYSTEM_USER_ID : userId;
        await execute('DELETE FROM settings WHERE user_id = ? AND key = ?', [ownerId, key]);
        res.json({ success: true, message: '设置已删除' });
    } catch (err) {
        console.error('删除设置错误:', err);
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

        await saveSettingValue(userId, 'cert_path', certPath);
        await saveSettingValue(userId, 'key_path', keyPath);

        res.json({ success: true, message: '证书路径已保存，重启服务生效' });
    } catch (err) {
        console.error('保存证书路径错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.post('/favicon', requireAuth, async (req, res) => {
    try {
        const { path: filePath } = req.body;
        if (!filePath) return res.status(400).json({ error: '缺少文件路径' });
        const src = getUploadedFilePath(filePath);
        const dest = path.join(__dirname, '../../public/favicon.ico');
        if (!src || !fs.existsSync(src)) return res.status(404).json({ error: '源文件不存在' });
        fs.copyFileSync(src, dest);
        res.json({ success: true, message: '图标更新成功' });
    } catch (err) {
        console.error('更新图标错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

module.exports = router;
