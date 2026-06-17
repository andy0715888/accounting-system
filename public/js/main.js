document.addEventListener('DOMContentLoaded', function() {
    let state = {
        tabs: [],
        currentTabId: null,
        columns: [],
        records: [],
        selectedRows: new Set(),
        filters: {},
        isLoaded: false,
        userName: '',
        isAdmin: false
    };

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    const tabBar = $('#tabBar');
    const tableHead = $('#tableHead');
    const tableBody = $('#tableBody');
    const recordCount = $('#recordCount');
    const statusText = $('#statusText');
    const usernameDisplay = $('#usernameDisplay');
    const addTabBtn = $('#addTabBtn');
    const addRowBtn = $('#addRowBtn');
    const deleteRowsBtn = $('#deleteRowsBtn');
    const importBtn = $('#importBtn');
    const exportBtn = $('#exportBtn');
    const refreshBtn = $('#refreshBtn');
    const manageColumnsBtn = $('#manageColumnsBtn');
    const logoutBtn = $('#logoutBtn');
    const columnModal = $('#columnModal');
    const closeColumnModal = $('#closeColumnModal');
    const addColBtn = $('#addColBtn');
    const columnList = $('#columnList');
    const newColName = $('#newColName');
    const newColType = $('#newColType');
    const importModal = $('#importModal');
    const closeImport = $('#closeImport');
    const importFileInput = $('#importFileInput');
    const confirmImport = $('#confirmImport');
    const cancelImport = $('#cancelImport');
    const importStatus = $('#importStatus');
    const statsContainer = $('#statsContainer');
    const changePwdBtn = $('#changePasswordBtn');
    const oldPwdInput = $('#oldPassword');
    const newPwdInput = $('#newPassword');
    const confirmPwdInput = $('#confirmPassword');
    const changePwdStatus = $('#changePwdStatus');
    const allowRegisterCheckbox = $('#allowRegisterCheckbox');
    const saveRegisterSwitchBtn = $('#saveRegisterSwitchBtn');
    const registerSwitchStatus = $('#registerSwitchStatus');
    const registerSwitchGroup = $('#registerSwitchGroup');

    // 菜单切换
    $$('.menu-item').forEach(item => {
        item.addEventListener('click', function() {
            $$('.menu-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            const view = this.dataset.view;
            $$('.view-panel').forEach(p => p.classList.remove('active'));
            document.getElementById('view-' + view).classList.add('active');
            if (view === 'stats') renderStats();
        });
    });

    // 工具函数
    function setStatus(msg) { statusText.textContent = msg; }
    function formatDate(d) {
        if (!d) return '';
        try { const dt = new Date(d); if (isNaN(dt)) return d; return dt.toLocaleDateString('zh-CN'); } catch { return d; }
    }
    function formatNumber(v) {
        if (v === null || v === undefined || v === '') return '';
        const n = parseFloat(v);
        return isNaN(n) ? v : n.toFixed(2);
    }
    function getCellValue(record, colKey) { return record.data[colKey] ?? ''; }

    function computeDaysRemaining(record, colKey) {
        const dateStr = record.data[colKey];
        if (!dateStr) return '';
        const target = new Date(dateStr);
        if (isNaN(target)) return '';
        const now = new Date();
        now.setHours(0,0,0,0);
        target.setHours(0,0,0,0);
        const diff = Math.ceil((target - now) / (1000*60*60*24));
        return diff;
    }

    // API
    const API = {
        get: (url) => fetch('/api' + url, { credentials: 'include' }).then(r => r.json()),
        post: (url, data) => fetch('/api' + url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        }).then(r => r.json()),
        put: (url, data) => fetch('/api' + url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        }).then(r => r.json()),
        delete: (url) => fetch('/api' + url, {
            method: 'DELETE',
            credentials: 'include'
        }).then(r => r.json())
    };

    // 加载数据
    async function loadTabs() {
        const tabs = await API.get('/tabs');
        state.tabs = tabs;
        return tabs;
    }
    async function loadColumns(tabId) {
        const cols = await API.get('/columns?tabId=' + tabId);
        state.columns = cols;
        return cols;
    }
    async function loadRecords(tabId) {
        const records = await API.get('/records?tabId=' + tabId);
        state.records = records;
        return records;
    }

    // 渲染标签
    function renderTabs() {
        let html = '';
        state.tabs.forEach(tab => {
            const active = tab.id === state.currentTabId ? 'active' : '';
            html += `<button class="tab-item ${active}" data-tab-id="${tab.id}">${tab.name}<span class="tab-close" data-tab-id="${tab.id}">✕</span></button>`;
        });
        tabBar.innerHTML = html;
        tabBar.querySelectorAll('.tab-item').forEach(btn => {
            btn.addEventListener('click', function(e) {
                if (e.target.classList.contains('tab-close')) return;
                switchTab(parseInt(this.dataset.tabId));
            });
            const close = btn.querySelector('.tab-close');
            if (close) close.addEventListener('click', function(e) {
                e.stopPropagation();
                deleteTab(parseInt(this.dataset.tabId));
            });
        });
        if (state.tabs.length === 0) createDefaultTab();
    }

    async function switchTab(tabId) {
        if (tabId === state.currentTabId) return;
        state.currentTabId = tabId;
        state.selectedRows.clear();
        state.filters = {};
        await loadDataForTab(tabId);
        renderTabs();
        renderTable();
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab) document.getElementById('columnModalTabName').textContent = tab.name;
    }

    async function loadDataForTab(tabId) {
        try {
            await loadColumns(tabId);
            await loadRecords(tabId);
            setStatus(`✅ 已加载 ${state.records.length} 条记录`);
        } catch (err) { setStatus('❌ 加载失败: ' + err.message); }
    }

    // 标签管理
    async function createTab(name) {
        try {
            const result = await API.post('/tabs', { name });
            if (result.success) {
                const newTab = { id: result.id, name };
                state.tabs.push(newTab);
                renderTabs();
                switchTab(newTab.id);
                setStatus('✅ 标签创建成功');
            } else setStatus('❌ 创建失败: ' + (result.error || ''));
        } catch (err) { setStatus('❌ 创建失败: ' + err.message); }
    }
    async function createDefaultTab() { await createTab('默认'); }

    async function deleteTab(tabId) {
        if (!confirm('确定删除此标签及其所有数据吗？')) return;
        try {
            await API.delete('/tabs/' + tabId);
            state.tabs = state.tabs.filter(t => t.id !== tabId);
            if (state.currentTabId === tabId) {
                state.currentTabId = state.tabs.length > 0 ? state.tabs[0].id : null;
            }
            renderTabs();
            if (state.currentTabId) await switchTab(state.currentTabId);
            else await createDefaultTab();
            setStatus('✅ 标签已删除');
        } catch (err) { setStatus('❌ 删除失败: ' + err.message); }
    }

    addTabBtn.addEventListener('click', function() {
        const name = prompt('请输入新标签名称：', '新标签');
        if (name && name.trim()) createTab(name.trim());
    });

    // 渲染表格
    function renderTable() {
        if (!state.currentTabId) return;
        const visibleColumns = state.columns.filter(c => c.col_visible !== 0);
        const filteredRecords = getFilteredRecords();

        let theadHtml = `<tr><th style="width:36px;min-width:36px;max-width:36px;text-align:center;"><input type="checkbox" id="selectAll" /></th>`;
        visibleColumns.forEach(col => {
            const isIncome = col.is_income || 0;
            const incomeLabel = isIncome === 1 ? '💰收入' : (isIncome === 2 ? '💸支出' : '');
            theadHtml += `
                <th data-col="${col.col_key}" style="width:${col.col_width || 150}px;min-width:80px;">
                    <div class="th-inner">
                        <span class="col-name">${col.col_name} ${incomeLabel}</span>
                        <button class="col-dropdown-btn" data-col="${col.col_key}">▼</button>
                    </div>
                    <div class="col-dropdown-panel" data-col="${col.col_key}">
                        <input type="text" placeholder="筛选..." class="filter-input" data-col="${col.col_key}" />
                        <div class="filter-actions">
                            <button class="filter-clear" data-col="${col.col_key}">清除</button>
                        </div>
                    </div>
                    <div class="col-resize" data-col="${col.col_key}"></div>
                </th>
            `;
        });
        theadHtml += '</tr>';
        tableHead.innerHTML = theadHtml;

        if (filteredRecords.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="${visibleColumns.length + 1}" style="text-align:center;padding:40px 0;color:#999;">📭 暂无数据</td></tr>`;
            recordCount.textContent = '共 0 条记录';
            return;
        }

        let tbodyHtml = '';
        filteredRecords.forEach((record, index) => {
            const isSelected = state.selectedRows.has(record.id);
            tbodyHtml += `<tr class="${isSelected ? 'selected' : ''}" data-id="${record.id}">`;
            tbodyHtml += `<td><input type="checkbox" class="row-checkbox" data-id="${record.id}" ${isSelected ? 'checked' : ''} /></td>`;
            visibleColumns.forEach(col => {
                let val = getCellValue(record, col.col_key);
                let displayVal = val;
                let inputType = 'text';
                let extraAttrs = '';

                if (col.col_type === 'days_remaining') {
                    const days = computeDaysRemaining(record, col.col_key);
                    displayVal = days !== '' ? days + ' 天' : '';
                    tbodyHtml += `<td><span style="color:${days < 0 ? '#f56c6c' : (days <= 7 ? '#e6a23c' : '#333')};">${displayVal}</span></td>`;
                    return;
                }

                switch (col.col_type) {
                    case 'number': inputType = 'number'; displayVal = formatNumber(val); break;
                    case 'date': inputType = 'date'; displayVal = val || ''; break;
                    case 'select':
                        inputType = 'select';
                        const options = col.col_options || [];
                        extraAttrs = options.map(opt => `<option value="${opt}" ${opt === val ? 'selected' : ''}>${opt}</option>`).join('');
                        break;
                    case 'boolean':
                        inputType = 'select';
                        extraAttrs = `
                            <option value="true" ${val === true || val === 'true' ? 'selected' : ''}>是</option>
                            <option value="false" ${val === false || val === 'false' ? 'selected' : ''}>否</option>
                            <option value="" ${val === '' || val === null || val === undefined ? 'selected' : ''}>-</option>
                        `;
                        break;
                    default: inputType = 'text';
                }

                let inputHtml;
                if (inputType === 'select') {
                    inputHtml = `<select class="cell-input select-cell" data-col="${col.col_key}" data-id="${record.id}"><option value="">-</option>${extraAttrs}</select>`;
                } else if (inputType === 'date') {
                    inputHtml = `<input type="date" class="cell-input" data-col="${col.col_key}" data-id="${record.id}" value="${val || ''}" />`;
                } else if (inputType === 'number') {
                    inputHtml = `<input type="number" step="0.01" class="cell-input" data-col="${col.col_key}" data-id="${record.id}" value="${val !== '' && val !== null && val !== undefined ? val : ''}" />`;
                } else {
                    inputHtml = `<input type="text" class="cell-input" data-col="${col.col_key}" data-id="${record.id}" value="${val || ''}" placeholder="-" />`;
                }
                tbodyHtml += `<td>${inputHtml}</td>`;
            });
            tbodyHtml += '</tr>';
        });
        tableBody.innerHTML = tbodyHtml;
        recordCount.textContent = `共 ${filteredRecords.length} 条记录`;

        bindTableEvents();
        bindFilterEvents();
    }

    // 筛选
    function getFilteredRecords() {
        let records = state.records;
        for (const [colKey, filterText] of Object.entries(state.filters)) {
            if (!filterText) continue;
            records = records.filter(r => {
                const val = getCellValue(r, colKey);
                return String(val).toLowerCase().includes(String(filterText).toLowerCase());
            });
        }
        return records;
    }

    function bindFilterEvents() {
        $$('.col-dropdown-btn').forEach(btn => {
            btn.onclick = function(e) {
                e.stopPropagation();
                const col = this.dataset.col;
                const panel = document.querySelector(`.col-dropdown-panel[data-col="${col}"]`);
                if (!panel) return;
                $$('.col-dropdown-panel.show').forEach(p => { if (p !== panel) p.classList.remove('show'); });
                panel.classList.toggle('show');
            };
        });

        $$('.filter-input').forEach(input => {
            input.oninput = function() {
                const col = this.dataset.col;
                const val = this.value.trim();
                if (val) state.filters[col] = val;
                else delete state.filters[col];
                renderTable();
            };
            input.onclick = (e) => e.stopPropagation();
        });

        $$('.filter-clear').forEach(btn => {
            btn.onclick = function(e) {
                e.stopPropagation();
                const col = this.dataset.col;
                delete state.filters[col];
                const input = document.querySelector(`.filter-input[data-col="${col}"]`);
                if (input) input.value = '';
                renderTable();
                const panel = document.querySelector(`.col-dropdown-panel[data-col="${col}"]`);
                if (panel) panel.classList.remove('show');
            };
        });

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.col-dropdown-btn') && !e.target.closest('.col-dropdown-panel')) {
                $$('.col-dropdown-panel.show').forEach(p => p.classList.remove('show'));
            }
        });
    }

    function bindTableEvents() {
        const selectAll = $('#selectAll');
        if (selectAll) {
            selectAll.onchange = function() {
                const checked = this.checked;
                $$('.row-checkbox').forEach(cb => cb.checked = checked);
                state.selectedRows.clear();
                if (checked) state.records.forEach(r => state.selectedRows.add(r.id));
                updateRowSelection();
            };
        }

        $$('.row-checkbox').forEach(cb => {
            cb.onchange = function() {
                const id = parseInt(this.dataset.id);
                if (this.checked) state.selectedRows.add(id);
                else state.selectedRows.delete(id);
                updateRowSelection();
                const allCbs = $$('.row-checkbox');
                const allChecked = allCbs.length > 0 && allCbs.every(c => c.checked);
                if (selectAll) selectAll.checked = allChecked;
            };
        });

        $$('.cell-input').forEach(input => {
            input.onblur = () => handleCellChange(input);
            input.onkeydown = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
                if (e.key === 'Tab') { /* allow default */ }
            };
            if (input.tagName === 'SELECT') input.onchange = () => handleCellChange(input);
        });

        $$('.col-resize').forEach(handle => {
            let startX, startWidth, colKey;
            handle.onmousedown = (e) => {
                e.preventDefault();
                startX = e.clientX;
                colKey = handle.dataset.col;
                const th = handle.closest('th');
                startWidth = th.offsetWidth;
                document.onmousemove = (ev) => {
                    const diff = ev.clientX - startX;
                    const newWidth = Math.max(60, startWidth + diff);
                    th.style.width = newWidth + 'px';
                    th.style.minWidth = newWidth + 'px';
                };
                document.onmouseup = () => {
                    document.onmousemove = null;
                    document.onmouseup = null;
                    const col = state.columns.find(c => c.col_key === colKey);
                    if (col) {
                        const width = parseInt(th.style.width);
                        if (width > 0) {
                            API.put('/columns/' + col.id, { col_width: width }).catch(() => {});
                        }
                    }
                };
            };
        });
    }

    function handleCellChange(input) {
        const colKey = input.dataset.col;
        const id = parseInt(input.dataset.id);
        let val = input.value;
        const col = state.columns.find(c => c.col_key === colKey);
        if (!col) return;
        if (col.col_type === 'days_remaining') return;
        switch (col.col_type) {
            case 'number': if (val !== '' && !isNaN(val)) val = parseFloat(val); break;
            case 'boolean': if (val === 'true') val = true; else if (val === 'false') val = false; else val = null; break;
            default: break;
        }
        const record = state.records.find(r => r.id === id);
        if (!record) return;
        const oldVal = record.data[colKey];
        if (oldVal === val || (oldVal === undefined && val === '')) return;
        record.data[colKey] = val;
        record._updated = true;
        if (record._saveTimeout) clearTimeout(record._saveTimeout);
        record._saveTimeout = setTimeout(() => saveRecord(record), 300);
    }

    function saveRecord(record) {
        if (!record._updated) return;
        record._updated = false;
        API.put('/records/' + record.id, { data: record.data })
            .then(() => setStatus('✅ 保存成功'))
            .catch(err => { setStatus('❌ 保存失败: ' + err.message); record._updated = true; });
    }

    function updateRowSelection() {
        $$('#tableBody tr').forEach(tr => {
            const id = parseInt(tr.dataset.id);
            if (state.selectedRows.has(id)) tr.classList.add('selected');
            else tr.classList.remove('selected');
        });
    }

    // 添加行
    async function addRow() {
        if (!state.currentTabId) return;
        try {
            setStatus('🔄 添加中...');
            const data = {};
            state.columns.forEach(col => { data[col.col_key] = ''; });
            const result = await API.post('/records', { tab_id: state.currentTabId, data });
            const newRecord = { id: result.id, data };
            state.records.unshift(newRecord);
            renderTable();
            setStatus('✅ 添加成功');
            const firstInput = document.querySelector('.cell-input');
            if (firstInput) firstInput.focus();
        } catch (err) { setStatus('❌ 添加失败: ' + err.message); }
    }

    // 删除选中
    async function deleteSelected() {
        const ids = Array.from(state.selectedRows);
        if (ids.length === 0) { setStatus('⚠️ 请选择行'); return; }
        if (!confirm(`确定删除 ${ids.length} 条记录吗？`)) return;
        try {
            setStatus('🔄 删除中...');
            await API.post('/records/batch-delete', { ids });
            state.records = state.records.filter(r => !ids.includes(r.id));
            state.selectedRows.clear();
            renderTable();
            setStatus(`✅ 已删除 ${ids.length} 条记录`);
        } catch (err) { setStatus('❌ 删除失败: ' + err.message); }
    }

    // 导出/导入
    async function exportData() {
        if (state.records.length === 0) { setStatus('⚠️ 无数据'); return; }
        try {
            setStatus('🔄 导出中...');
            const visibleColumns = state.columns.filter(c => c.col_visible !== 0);
            if (typeof XLSX === 'undefined') await loadXLSX();
            const headers = visibleColumns.map(c => c.col_name);
            const rows = state.records.map(r => visibleColumns.map(c => r.data[c.col_key] ?? ''));
            const wsData = [headers, ...rows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '记账数据');
            const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            downloadFile(buf, `记账数据_${new Date().toISOString().slice(0,10)}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            setStatus('✅ 导出成功');
        } catch (err) { setStatus('❌ 导出失败: ' + err.message); }
    }

    function showImportModal() { importModal.classList.add('show'); importFileInput.value = ''; importStatus.textContent = ''; }
    async function handleImport() {
        const file = importFileInput.files[0];
        if (!file) { importStatus.textContent = '⚠️ 请选择文件'; return; }
        importStatus.textContent = '🔄 读取中...';
        try {
            let records = [];
            if (file.name.endsWith('.csv')) {
                const text = await file.text();
                const lines = text.split('\n').filter(l => l.trim());
                if (lines.length < 2) throw new Error('CSV格式错误');
                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                const visibleColumns = state.columns.filter(c => c.col_visible !== 0);
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                    const data = {};
                    visibleColumns.forEach((col, idx) => { data[col.col_key] = values[idx] || ''; });
                    records.push(data);
                }
            } else {
                await loadXLSX();
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                if (jsonData.length === 0) throw new Error('Excel为空');
                const headers = Object.keys(jsonData[0]);
                const visibleColumns = state.columns.filter(c => c.col_visible !== 0);
                const colMap = {};
                visibleColumns.forEach(col => {
                    const matched = headers.find(h => h === col.col_name || h === col.col_key);
                    if (matched) colMap[col.col_key] = matched;
                });
                records = jsonData.map(row => {
                    const data = {};
                    visibleColumns.forEach(col => {
                        const key = colMap[col.col_key];
                        data[col.col_key] = key ? row[key] : '';
                    });
                    return data;
                });
            }
            if (records.length === 0) throw new Error('无有效数据');
            importStatus.textContent = `🔄 导入 ${records.length} 条...`;
            await API.post('/records/import', { tab_id: state.currentTabId, records });
            await loadDataForTab(state.currentTabId);
            renderTable();
            importStatus.textContent = `✅ 成功导入 ${records.length} 条`;
            setTimeout(() => importModal.classList.remove('show'), 1500);
        } catch (err) {
            importStatus.textContent = '❌ 导入失败: ' + err.message;
        }
    }

    function loadXLSX() { return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.onload = resolve; script.onerror = reject;
        document.head.appendChild(script);
    }); }

    function downloadFile(content, filename, mimeType) {
        const blob = content instanceof ArrayBuffer ? new Blob([content], { type: mimeType }) : new Blob(['\uFEFF' + content], { type: mimeType + ';charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
    }

    // 列管理
    async function showColumnManager() {
        if (!state.currentTabId) {
            setStatus('⚠️ 请先选择一个标签');
            return;
        }
        columnModal.classList.add('show');
        await renderColumnList();
        const tab = state.tabs.find(t => t.id === state.currentTabId);
        if (tab) document.getElementById('columnModalTabName').textContent = tab.name;
    }

    async function renderColumnList() {
        const cols = state.columns;
        let html = '';
        cols.forEach(col => {
            const isIncome = col.is_income || 0;
            const incomeLabel = isIncome === 1 ? '收入' : (isIncome === 2 ? '支出' : '普通');
            const btnClass = isIncome === 1 ? 'active-income' : (isIncome === 2 ? 'active-expense' : '');
            html += `
                <div class="column-item" draggable="true" data-id="${col.id}">
                    <div class="col-info">
                        <span><strong>${col.col_name}</strong></span>
                        <span class="col-key">(${col.col_key})</span>
                        <button class="income-toggle ${btnClass}" data-id="${col.id}">${incomeLabel}</button>
                        <span style="color:#999;font-size:12px;">${col.col_visible === 1 ? '👁️' : '🙈'}</span>
                    </div>
                    <div class="col-actions">
                        <button onclick="toggleColumnVisibility(${col.id}, ${col.col_visible})">${col.col_visible === 1 ? '隐藏' : '显示'}</button>
                        <button class="danger" onclick="deleteColumn(${col.id})">删除</button>
                    </div>
                </div>
            `;
        });
        columnList.innerHTML = html;

        // 拖拽
        const items = columnList.querySelectorAll('.column-item');
        items.forEach(item => {
            item.addEventListener('dragstart', function(e) {
                this.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', this.dataset.id);
            });
            item.addEventListener('dragend', function() {
                this.classList.remove('dragging');
            });
            item.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                this.classList.add('drag-over');
            });
            item.addEventListener('dragleave', function() {
                this.classList.remove('drag-over');
            });
            item.addEventListener('drop', async function(e) {
                e.preventDefault();
                this.classList.remove('drag-over');
                const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
                const targetId = parseInt(this.dataset.id);
                if (draggedId === targetId) return;
                const cols = state.columns;
                const draggedIndex = cols.findIndex(c => c.id === draggedId);
                const targetIndex = cols.findIndex(c => c.id === targetId);
                if (draggedIndex === -1 || targetIndex === -1) return;
                // 交换顺序
                const temp = cols[draggedIndex].col_order;
                cols[draggedIndex].col_order = cols[targetIndex].col_order;
                cols[targetIndex].col_order = temp;
                cols.sort((a, b) => a.col_order - b.col_order);
                const orderMap = {};
                cols.forEach((c, i) => { orderMap[c.id] = i; });
                try {
                    await API.post('/columns/reorder', { orderMap });
                    state.columns = cols;
                    renderColumnList();
                    renderTable();
                    setStatus('✅ 顺序已更新');
                } catch (err) {
                    setStatus('❌ 更新失败: ' + err.message);
                    // 回退重新加载
                    await loadColumns(state.currentTabId);
                    renderColumnList();
                }
            });
        });

        // 收入/支出
        columnList.querySelectorAll('.income-toggle').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = parseInt(this.dataset.id);
                const col = state.columns.find(c => c.id === id);
                if (!col) return;
                let newVal = (col.is_income || 0) + 1;
                if (newVal > 2) newVal = 0;
                try {
                    await API.put('/columns/' + id, { is_income: newVal });
                    col.is_income = newVal;
                    renderColumnList();
                    renderTable();
                    setStatus('✅ 标记已更新');
                } catch (err) { setStatus('❌ 更新失败: ' + err.message); }
            });
        });
    }

    // 全局函数
    window.toggleColumnVisibility = async function(id, currentVisible) {
        try {
            await API.put('/columns/' + id, { col_visible: currentVisible === 1 ? 0 : 1 });
            await loadColumns(state.currentTabId);
            renderColumnList();
            renderTable();
            setStatus('✅ 列状态已更新');
        } catch (err) { setStatus('❌ 更新失败: ' + err.message); }
    };
    window.deleteColumn = async function(id) {
        if (!confirm('确定删除此列吗？')) return;
        try {
            await API.delete('/columns/' + id);
            await loadColumns(state.currentTabId);
            renderColumnList();
            renderTable();
            setStatus('✅ 列已删除');
        } catch (err) { setStatus('❌ 删除失败: ' + err.message); }
    };

    // 添加列
    async function addColumn() {
        const name = newColName.value.trim();
        const type = newColType.value;
        if (!name) {
            setStatus('⚠️ 请输入列名称');
            return;
        }
        if (!state.currentTabId) {
            setStatus('⚠️ 请先选择一个标签');
            return;
        }

        const ts = Date.now();
        const rand = Math.random().toString(36).substring(2, 6);
        const key = `col_${ts}_${rand}`;

        try {
            const result = await API.post('/columns', {
                tab_id: state.currentTabId,
                col_key: key,
                col_name: name,
                col_type: type,
                is_income: 0
            });
            if (result.success) {
                newColName.value = '';
                // 重新加载列，保持后端顺序
                await loadColumns(state.currentTabId);
                renderColumnList();
                renderTable();
                setStatus('✅ 列添加成功');
            } else {
                setStatus('❌ 添加失败: ' + (result.error || '未知错误'));
            }
        } catch (err) {
            setStatus('❌ 添加失败: ' + err.message);
        }
    }

    // 统计
    function renderStats() {
        if (!state.currentTabId) return;
        const records = state.records;
        if (records.length === 0) {
            statsContainer.innerHTML = '<p style="color:#999;text-align:center;padding:40px 0;">暂无数据</p>';
            return;
        }

        const groups = {};
        records.forEach(record => {
            const dateVal = record.data.date || '';
            if (!dateVal) return;
            const d = new Date(dateVal);
            if (isNaN(d)) return;
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(record);
        });

        let totalIncome = 0, totalExpense = 0;
        const dailyStats = [];
        Object.keys(groups).sort().forEach(dateKey => {
            const dayRecords = groups[dateKey];
            let dayIncome = 0, dayExpense = 0;
            dayRecords.forEach(r => {
                const amount = parseFloat(r.data.amount) || 0;
                const typeCol = state.columns.find(c => c.is_income === 1 || c.is_income === 2);
                if (typeCol) {
                    const val = r.data[typeCol.col_key];
                    if (typeCol.is_income === 1) {
                        dayIncome += amount;
                        totalIncome += amount;
                    } else if (typeCol.is_income === 2) {
                        dayExpense += amount;
                        totalExpense += amount;
                    }
                } else {
                    const type = r.data.type || '';
                    if (type === '收入') { dayIncome += amount; totalIncome += amount; }
                    else if (type === '支出') { dayExpense += amount; totalExpense += amount; }
                }
            });
            dailyStats.push({ date: dateKey, income: dayIncome, expense: dayExpense, net: dayIncome - dayExpense });
        });

        const netTotal = totalIncome - totalExpense;

        let html = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-label">总收入</div><div class="stat-value positive">${totalIncome.toFixed(2)}</div></div>
                <div class="stat-card"><div class="stat-label">总支出</div><div class="stat-value negative">${totalExpense.toFixed(2)}</div></div>
                <div class="stat-card"><div class="stat-label">净收入</div><div class="stat-value ${netTotal >= 0 ? 'positive' : 'negative'}">${netTotal.toFixed(2)}</div></div>
                <div class="stat-card"><div class="stat-label">记录总数</div><div class="stat-value neutral">${records.length}</div></div>
            </div>
            <div class="stats-detail">
                <h3>每日明细</h3>
                <table><thead><tr><th>日期</th><th>收入</th><th>支出</th><th>净额</th></tr></thead><tbody>
        `;
        dailyStats.forEach(day => {
            html += `<tr><td>${day.date}</td><td style="color:#67c23a;">${day.income.toFixed(2)}</td><td style="color:#f56c6c;">${day.expense.toFixed(2)}</td><td style="color:${day.net >= 0 ? '#67c23a' : '#f56c6c'};">${day.net.toFixed(2)}</td></tr>`;
        });
        html += '</tbody></table></div>';
        statsContainer.innerHTML = html;
    }

    // 密码修改
    async function changePassword() {
        const oldPwd = oldPwdInput.value.trim();
        const newPwd = newPwdInput.value.trim();
        const confirmPwd = confirmPwdInput.value.trim();
        if (!oldPwd) { changePwdStatus.textContent = '⚠️ 请输入当前密码'; return; }
        if (newPwd.length < 6) { changePwdStatus.textContent = '⚠️ 新密码至少6位'; return; }
        if (newPwd !== confirmPwd) { changePwdStatus.textContent = '⚠️ 两次密码不一致'; return; }
        try {
            await API.post('/auth/change-password', { oldPassword: oldPwd, newPassword: newPwd });
            changePwdStatus.textContent = '✅ 密码修改成功';
            oldPwdInput.value = ''; newPwdInput.value = ''; confirmPwdInput.value = '';
        } catch (err) { changePwdStatus.textContent = '❌ 修改失败: ' + err.message; }
    }

    // 注册开关管理
    async function loadRegisterSwitch() {
        try {
            const data = await API.get('/settings/allow_register');
            if (data.value !== undefined) {
                allowRegisterCheckbox.checked = data.value !== false;
            }
        } catch (err) {}
    }

    async function saveRegisterSwitch() {
        const value = allowRegisterCheckbox.checked;
        try {
            await API.post('/settings', { key: 'allow_register', value });
            registerSwitchStatus.textContent = '✅ 已保存';
            setTimeout(() => { registerSwitchStatus.textContent = ''; }, 3000);
        } catch (err) {
            registerSwitchStatus.textContent = '❌ 保存失败: ' + err.message;
        }
    }

    // 上传 favicon
    async function uploadFavicon() {
        const fileInput = document.getElementById('faviconFileInput');
        const file = fileInput.files[0];
        if (!file) {
            document.getElementById('faviconStatus').textContent = '⚠️ 请选择文件';
            return;
        }
        const formData = new FormData();
        formData.append('image', file);
        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                // 将上传的图片复制到 public/favicon.ico
                const response = await fetch('/api/settings/favicon', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ path: data.url })
                });
                const result = await response.json();
                if (result.success) {
                    document.getElementById('faviconStatus').textContent = '✅ 图标已更新，请刷新浏览器查看';
                    // 强制刷新 favicon
                    const link = document.querySelector("link[rel*='icon']");
                    if (link) {
                        link.href = data.url + '?v=' + Date.now();
                    }
                } else {
                    document.getElementById('faviconStatus').textContent = '❌ 保存图标失败: ' + (result.error || '');
                }
            } else {
                document.getElementById('faviconStatus').textContent = '❌ 上传失败: ' + (data.error || '');
            }
        } catch (err) {
            document.getElementById('faviconStatus').textContent = '❌ 上传失败: ' + err.message;
        }
    }

    // 加载设置
    async function loadSettings() {
        try {
            const cert = await API.get('/settings/cert_path');
            const key = await API.get('/settings/key_path');
            if (cert.value) document.getElementById('certPathInput').value = cert.value;
            if (key.value) document.getElementById('keyPathInput').value = key.value;
            const bg = await API.get('/settings/background');
            if (bg.value) {
                const bgData = bg.value;
                const preview = document.getElementById('bgPreview');
                if (bgData.type === 'url' || bgData.type === 'local') {
                    const url = bgData.type === 'url' ? bgData.url : bgData.path;
                    preview.style.backgroundImage = `url(${url})`;
                    preview.classList.add('has-bg');
                    preview.textContent = '';
                }
            }
            // 加载注册开关
            await loadRegisterSwitch();
            // 判断是否为管理员 (这里简单判断 userId === 1)
            const auth = await API.get('/auth/check');
            if (auth.loggedIn && auth.user.id === 1) {
                registerSwitchGroup.style.display = 'block';
            }
        } catch (err) { console.warn('加载设置失败:', err); }
    }

    // 事件绑定
    addRowBtn.addEventListener('click', addRow);
    deleteRowsBtn.addEventListener('click', deleteSelected);
    exportBtn.addEventListener('click', exportData);
    importBtn.addEventListener('click', showImportModal);
    refreshBtn.addEventListener('click', function() {
        if (state.currentTabId) loadDataForTab(state.currentTabId).then(() => renderTable());
    });
    manageColumnsBtn.addEventListener('click', showColumnManager);
    logoutBtn.addEventListener('click', async function() {
        if (!confirm('确定退出吗？')) return;
        try { await API.post('/auth/logout'); window.location.href = '/login'; } catch (err) { setStatus('❌ 退出失败: ' + err.message); }
    });

    closeColumnModal.addEventListener('click', () => columnModal.classList.remove('show'));

    if (addColBtn) {
        addColBtn.addEventListener('click', addColumn);
    }

    closeImport.addEventListener('click', () => importModal.classList.remove('show'));
    confirmImport.addEventListener('click', handleImport);
    cancelImport.addEventListener('click', () => importModal.classList.remove('show'));

    changePwdBtn.addEventListener('click', changePassword);
    confirmPwdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') changePassword(); });

    document.getElementById('saveCertBtn').addEventListener('click', async function() {
        const certPath = document.getElementById('certPathInput').value.trim();
        const keyPath = document.getElementById('keyPathInput').value.trim();
        if (!certPath || !keyPath) { setStatus('⚠️ 请填写完整路径'); return; }
        try {
            await API.post('/settings/cert', { certPath, keyPath });
            setStatus('✅ 证书路径已保存，重启服务生效');
            document.getElementById('certStatus').textContent = '✅ 已保存，请重启服务';
        } catch (err) { setStatus('❌ 保存失败: ' + err.message); }
    });

    document.getElementById('setBgUrl').addEventListener('click', async function() {
        const url = document.getElementById('bgUrlInput').value.trim();
        if (!url) { setStatus('⚠️ 请输入URL'); return; }
        try {
            await API.post('/settings', { key: 'background', value: { type: 'url', url } });
            const preview = document.getElementById('bgPreview');
            preview.style.backgroundImage = `url(${url})`;
            preview.classList.add('has-bg');
            preview.textContent = '';
            setStatus('✅ 背景已更新');
        } catch (err) { setStatus('❌ 设置失败: ' + err.message); }
    });
    document.getElementById('uploadBgBtn').addEventListener('click', function() {
        document.getElementById('bgFileInput').click();
    });
    document.getElementById('bgFileInput').addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) return;
        try {
            setStatus('🔄 上传中...');
            const formData = new FormData();
            formData.append('image', file);
            const res = await fetch('/api/upload', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                await API.post('/settings', { key: 'background', value: { type: 'local', path: data.url } });
                const preview = document.getElementById('bgPreview');
                preview.style.backgroundImage = `url(${data.url})`;
                preview.classList.add('has-bg');
                preview.textContent = '';
                setStatus('✅ 背景已应用');
            } else { setStatus('❌ 上传失败: ' + (data.error || '')); }
        } catch (err) { setStatus('❌ 上传失败: ' + err.message); }
    });
    document.getElementById('removeBgBtn').addEventListener('click', async function() {
        if (!confirm('确定移除背景吗？')) return;
        try {
            await API.delete('/settings/background');
            const preview = document.getElementById('bgPreview');
            preview.style.backgroundImage = '';
            preview.classList.remove('has-bg');
            preview.textContent = '暂无背景';
            setStatus('✅ 背景已移除');
        } catch (err) { setStatus('❌ 移除失败: ' + err.message); }
    });

    // favicon 上传
    document.getElementById('uploadFaviconBtn').addEventListener('click', uploadFavicon);
    document.getElementById('faviconFileInput').addEventListener('change', function() {
        document.getElementById('faviconStatus').textContent = '';
    });

    // 注册开关保存
    saveRegisterSwitchBtn.addEventListener('click', saveRegisterSwitch);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'n') { e.preventDefault(); addRow(); }
        if (e.key === 'Delete' && !e.target.closest('input') && !e.target.closest('select')) deleteSelected();
    });

    // 初始化
    async function init() {
        try {
            const auth = await API.get('/auth/check');
            if (!auth.loggedIn) { window.location.href = '/login'; return; }
            usernameDisplay.textContent = auth.user.username;
            state.userName = auth.user.username;
            state.isAdmin = (auth.user.id === 1);
            await loadTabs();
            if (state.tabs.length === 0) await createDefaultTab();
            else {
                state.currentTabId = state.tabs[0].id;
                await loadDataForTab(state.currentTabId);
            }
            renderTabs();
            renderTable();
            setStatus('✅ 加载完成');
            const tab = state.tabs.find(t => t.id === state.currentTabId);
            if (tab) document.getElementById('columnModalTabName').textContent = tab.name;
            loadSettings();
        } catch (err) { console.error('初始化失败:', err); setStatus('❌ 初始化失败: ' + err.message); }
    }
    init();
});
