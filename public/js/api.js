// API 基础配置
const API_BASE = '/api';

async function request(url, options = {}) {
    const defaultOptions = {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    };
    const config = { ...defaultOptions, ...options };
    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }
    try {
        const response = await fetch(API_BASE + url, config);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `请求失败 (${response.status})`);
        }
        return data;
    } catch (err) {
        throw err;
    }
}

const AuthAPI = {
    login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
    register: (username, password) => request('/auth/register', { method: 'POST', body: { username, password } }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    check: () => request('/auth/check'),
    changePassword: (oldPassword, newPassword) => request('/auth/change-password', { method: 'POST', body: { oldPassword, newPassword } })
};

const RecordAPI = {
    getAll: () => request('/records'),
    create: (data) => request('/records', { method: 'POST', body: { data } }),
    update: (id, data) => request(`/records/${id}`, { method: 'PUT', body: { data } }),
    delete: (id) => request(`/records/${id}`, { method: 'DELETE' }),
    batchDelete: (ids) => request('/records/batch-delete', { method: 'POST', body: { ids } }),
    import: (records) => request('/records/import', { method: 'POST', body: { records } })
};

const ColumnAPI = {
    getAll: () => request('/columns'),
    create: (col) => request('/columns', { method: 'POST', body: col }),
    update: (id, col) => request(`/columns/${id}`, { method: 'PUT', body: col }),
    delete: (id) => request(`/columns/${id}`, { method: 'DELETE' }),
    reorder: (orderMap) => request('/columns/reorder', { method: 'POST', body: { orderMap } })
};

const SettingAPI = {
    getAll: () => request('/settings'),
    get: (key) => request(`/settings/${key}`),
    set: (key, value) => request('/settings', { method: 'POST', body: { key, value } }),
    batchSet: (settings) => request('/settings/batch', { method: 'POST', body: { settings } }),
    delete: (key) => request(`/settings/${key}`, { method: 'DELETE' }),
    uploadBackground: (file) => {
        const formData = new FormData();
        formData.append('image', file);
        return fetch('/api/upload', {
            method: 'POST',
            credentials: 'include',
            body: formData
        }).then(res => res.json());
    },
    removeBackground: () => request('/settings/background', { method: 'DELETE' })
};

function exportToCSV(data, columns) {
    if (!data || data.length === 0) return '';
    const headers = columns.filter(c => c.col_visible !== 0).map(c => c.col_name);
    const rows = data.map(record => {
        return columns.filter(c => c.col_visible !== 0).map(c => {
            let val = record.data[c.col_key] ?? '';
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        });
    });
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

async function exportToExcel(data, columns) {
    if (typeof XLSX === 'undefined') {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    const headers = columns.filter(c => c.col_visible !== 0).map(c => c.col_name);
    const rows = data.map(record => {
        return columns.filter(c => c.col_visible !== 0).map(c => record.data[c.col_key] ?? '');
    });
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '记账数据');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

function downloadFile(content, filename, mimeType = 'text/csv') {
    const blob = content instanceof ArrayBuffer 
        ? new Blob([content], { type: mimeType })
        : new Blob(['\uFEFF' + content], { type: mimeType + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
