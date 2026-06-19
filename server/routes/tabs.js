const express = require('express');
const { query, queryOne, execute } = require('../db');
const { getDB } = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: '请先登录' });
    next();
}

router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const tabs = await query('SELECT * FROM tabs WHERE user_id = ? ORDER BY created_at', [userId]);
        res.json(tabs);
    } catch (err) {
        console.error('获取标签错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: '标签名称不能为空' });

        const result = await execute('INSERT INTO tabs (user_id, name) VALUES (?, ?)', [userId, name]);
        const tabId = result.lastID;

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
                userId, tabId, col.col_key, col.col_name, col.col_type,
                col.col_options || null, col.col_order || 0,
                1, 150, 1, col.is_income || 0
            ]);
        });
        stmt.finalize();

        res.json({ success: true, id: tabId, message: '标签创建成功' });
    } catch (err) {
        console.error('创建标签错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.put('/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const tabId = req.params.id;
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: '标签名称不能为空' });

        const existing = await queryOne('SELECT id FROM tabs WHERE id = ? AND user_id = ?', [tabId, userId]);
        if (!existing) return res.status(404).json({ error: '标签不存在' });

        await execute('UPDATE tabs SET name = ? WHERE id = ?', [name, tabId]);
        res.json({ success: true, message: '标签已更新' });
    } catch (err) {
        console.error('更新标签错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const tabId = req.params.id;

        const existing = await queryOne('SELECT id FROM tabs WHERE id = ? AND user_id = ?', [tabId, userId]);
        if (!existing) return res.status(404).json({ error: '标签不存在' });

        await execute('DELETE FROM records WHERE tab_id = ? AND user_id = ?', [tabId, userId]);
        await execute('DELETE FROM column_defs WHERE tab_id = ? AND user_id = ?', [tabId, userId]);
        await execute('DELETE FROM tabs WHERE id = ?', [tabId]);

        res.json({ success: true, message: '标签已删除' });
    } catch (err) {
        console.error('删除标签错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

module.exports = router;
