const express = require('express');
const { query, queryOne, execute, getDB } = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: '请先登录' });
    next();
}

router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { tabId } = req.query;
        if (!tabId) return res.status(400).json({ error: '缺少 tabId' });

        const columns = await query(
            'SELECT * FROM column_defs WHERE user_id = ? AND tab_id = ? ORDER BY col_order',
            [userId, tabId]
        );
        const parsed = columns.map(col => ({
            ...col,
            col_options: col.col_options ? JSON.parse(col.col_options) : null
        }));
        res.json(parsed);
    } catch (err) {
        console.error('获取列错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        let { tab_id, col_key, col_name, col_type, col_options, col_width, col_visible, is_income } = req.body;
        if (!tab_id) return res.status(400).json({ error: '缺少 tab_id' });
        if (!col_name) return res.status(400).json({ error: '列名称不能为空' });

        if (!col_key) {
            const ts = Date.now();
            const rand = Math.random().toString(36).substring(2, 6);
            col_key = `col_${ts}_${rand}`;
        } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col_key)) {
            return res.status(400).json({ error: '列键格式错误' });
        }

        const existing = await queryOne(
            'SELECT id FROM column_defs WHERE user_id = ? AND tab_id = ? AND col_key = ?',
            [userId, tab_id, col_key]
        );
        if (existing) return res.status(400).json({ error: '列键已存在' });

        const maxOrder = await queryOne(
            'SELECT MAX(col_order) as max_order FROM column_defs WHERE user_id = ? AND tab_id = ?',
            [userId, tab_id]
        );
        const order = (maxOrder?.max_order ?? -1) + 1;

        const result = await execute(`
            INSERT INTO column_defs 
            (user_id, tab_id, col_key, col_name, col_type, col_options, col_width, col_visible, col_order, is_income)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            userId, tab_id, col_key, col_name,
            col_type || 'text',
            col_options ? JSON.stringify(col_options) : null,
            col_width || 150,
            col_visible !== undefined ? (col_visible ? 1 : 0) : 1,
            order,
            is_income || 0
        ]);

        res.json({ success: true, id: result.lastID, message: '列添加成功' });
    } catch (err) {
        console.error('创建列错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.put('/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const columnId = req.params.id;
        const { col_name, col_type, col_options, col_width, col_visible, col_order, is_income } = req.body;

        const existing = await queryOne('SELECT id FROM column_defs WHERE id = ? AND user_id = ?', [columnId, userId]);
        if (!existing) return res.status(404).json({ error: '列不存在' });

        const updates = [];
        const params = [];
        if (col_name !== undefined) { updates.push('col_name = ?'); params.push(col_name); }
        if (col_type !== undefined) { updates.push('col_type = ?'); params.push(col_type); }
        if (col_options !== undefined) { updates.push('col_options = ?'); params.push(col_options ? JSON.stringify(col_options) : null); }
        if (col_width !== undefined) { updates.push('col_width = ?'); params.push(col_width); }
        if (col_visible !== undefined) { updates.push('col_visible = ?'); params.push(col_visible ? 1 : 0); }
        if (col_order !== undefined) { updates.push('col_order = ?'); params.push(col_order); }
        if (is_income !== undefined) { updates.push('is_income = ?'); params.push(is_income); }

        if (updates.length === 0) return res.status(400).json({ error: '没有要更新的字段' });

        params.push(columnId);
        await execute(`UPDATE column_defs SET ${updates.join(', ')} WHERE id = ?`, params);
        res.json({ success: true, message: '更新成功' });
    } catch (err) {
        console.error('更新列错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const columnId = req.params.id;
        const existing = await queryOne('SELECT id FROM column_defs WHERE id = ? AND user_id = ?', [columnId, userId]);
        if (!existing) return res.status(404).json({ error: '列不存在' });

        await execute('DELETE FROM column_defs WHERE id = ?', [columnId]);
        res.json({ success: true, message: '删除成功' });
    } catch (err) {
        console.error('删除列错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.post('/reorder', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { orderMap } = req.body;
        if (!orderMap || typeof orderMap !== 'object') {
            return res.status(400).json({ error: '请提供列顺序映射' });
        }

        const db = getDB();
        const stmt = db.prepare('UPDATE column_defs SET col_order = ? WHERE id = ? AND user_id = ?');
        for (const [id, order] of Object.entries(orderMap)) {
            stmt.run([order, id, userId]);
        }
        stmt.finalize();

        res.json({ success: true, message: '顺序更新成功' });
    } catch (err) {
        console.error('重置列顺序错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

module.exports = router;
