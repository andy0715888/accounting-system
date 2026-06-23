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

        const records = await query(
            'SELECT * FROM records WHERE user_id = ? AND tab_id = ? ORDER BY created_at DESC',
            [userId, tabId]
        );
        const parsed = records.map(r => ({ ...r, data: JSON.parse(r.data || '{}') }));
        res.json(parsed);
    } catch (err) {
        console.error('获取记录错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { tab_id, data } = req.body;
        if (!tab_id) return res.status(400).json({ error: '缺少 tab_id' });
        if (!data || typeof data !== 'object') return res.status(400).json({ error: '数据格式错误' });

        const result = await execute(
            'INSERT INTO records (user_id, tab_id, data) VALUES (?, ?, ?)',
            [userId, tab_id, JSON.stringify(data)]
        );
        res.json({ success: true, id: result.lastID, message: '添加成功' });
    } catch (err) {
        console.error('创建记录错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.put('/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const recordId = req.params.id;
        const { data } = req.body;
        if (!data || typeof data !== 'object') return res.status(400).json({ error: '数据格式错误' });

        const existing = await queryOne('SELECT id FROM records WHERE id = ? AND user_id = ?', [recordId, userId]);
        if (!existing) return res.status(404).json({ error: '记录不存在' });

        await execute(
            'UPDATE records SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [JSON.stringify(data), recordId]
        );
        res.json({ success: true, message: '更新成功' });
    } catch (err) {
        console.error('更新记录错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const recordId = req.params.id;
        const existing = await queryOne('SELECT id FROM records WHERE id = ? AND user_id = ?', [recordId, userId]);
        if (!existing) return res.status(404).json({ error: '记录不存在' });

        await execute('DELETE FROM records WHERE id = ?', [recordId]);
        res.json({ success: true, message: '删除成功' });
    } catch (err) {
        console.error('删除记录错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.post('/batch-delete', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: '请选择要删除的记录' });
        }

        const placeholders = ids.map(() => '?').join(',');
        await execute(
            `DELETE FROM records WHERE id IN (${placeholders}) AND user_id = ?`,
            [...ids, userId]
        );
        res.json({ success: true, message: `已删除 ${ids.length} 条记录` });
    } catch (err) {
        console.error('批量删除错误:', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.post('/import', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { tab_id, records } = req.body;
        if (!tab_id) return res.status(400).json({ error: '缺少 tab_id' });
        if (!records || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ error: '请提供要导入的数据' });
        }

        const db = getDB();
        const stmt = db.prepare('INSERT INTO records (user_id, tab_id, data) VALUES (?, ?, ?)');
        let count = 0;
        for (const record of records) {
            stmt.run([userId, tab_id, JSON.stringify(record)]);
            count++;
        }
        stmt.finalize();

        res.json({ success: true, message: `成功导入 ${count} 条记录`, count });
    } catch (err) {
        console.error('导入错误:', err);
        res.status(500).json({ error: '导入失败' });
    }
});

module.exports = router;
