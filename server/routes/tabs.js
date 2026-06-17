const express = require('express');
const { query, queryOne, execute } = require('../db');

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

        // 为新标签创建默认列
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
            stmt.run([userId, tabId, col.col_key, col.col_name, col.col_type, col.col_options || null, col.col_order || 0, 1, 150, 1, 0]);
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
