console.log('main.js loaded');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM ready');
    let state = {
        tabs: [],
        currentTabId: null,
        columns: [],
        records: [],
        selectedRows: new Set(),
        filters: {},
        filterOptions: {},
        tabCache: {},
        tabManageMode: false,
        selectedTabs: new Set(),
        renameTabId: null,
        providerOptions: [],
        isLoaded: false,
        userName: '',
        isAdmin: false,
        ipPortSuffix: '',
        domainPortSuffix: ''
    };

    // DOM 引用
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    const tabBar = $('#tabBar');
    const tableHead = $('#tableHead');
    const tableBody = $('#tableBody');
    const recordCount = $('#recordCount');
    const statusText = $('#statusText');
    const usernameDisplay = $('#usernameDisplay');
    const currentTimeDisplay = $('#currentTimeDisplay');
    const addTabBtn = $('#addTabBtn');
    const manageTabsBtn = $('#manageTabsBtn');
    const deleteTabsBtn = $('#deleteTabsBtn');
    const addRowBtn = $('#addRowBtn');
    const deleteRowsBtn = $('#deleteRowsBtn');
    const importBtn = $('#importBtn');
    const exportBtn = $('#exportBtn');
    const refreshBtn = $('#refreshBtn');
    const manageColumnsBtn = $('#manageColumnsBtn');
    const addressSuffixBtn = $('#addressSuffixBtn');
    const providerManageBtn = $('#providerManageBtn');
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

    const addressSuffixModal = $('#addressSuffixModal');
    const closeAddressSuffixModal = $('#closeAddressSuffixModal');
    const ipPortSuffixInput = $('#ipPortSuffixInput');
    const domainPortSuffixInput = $('#domainPortSuffixInput');
    const saveSuffixBtn = $('#saveSuffixBtn');
    const suffixStatus = $('#suffixStatus');
    const renameTabModal = $('#renameTabModal');
    const closeRenameTabModal = $('#closeRenameTabModal');
    const renameTabInput = $('#renameTabInput');
    const saveRenameTabBtn = $('#saveRenameTabBtn');
    const cancelRenameTabBtn = $('#cancelRenameTabBtn');
    const renameTabStatus = $('#renameTabStatus');
    const providerModal = $('#providerModal');
    const closeProviderModal = $('#closeProviderModal');
    const providerNameInput = $('#providerNameInput');
    const addProviderBtn = $('#addProviderBtn');
    const providerList = $('#providerList');
    const providerStatus = $('#providerStatus');

    let filterDocumentClickBound = false;

    // --- 菜单切换 ---
    function initMenu() {
        $$('.menu-item').forEach(item => {
            item.addEventListener('click', function() {
                $$('.menu-item').forEach(i => i.classList.remove('active'));
                this.classList.add('active');
                const view = this.dataset.view;
                $$('.view-panel').forEach(p => p.classList.remove('active'));
                const target = document.getElementById('view-' + view);
                if (target) target.classList.add('active');
                if (view === 'stats') renderStats();
            });
        });
    }
    initMenu();

    function updateClock() {
        const now = new Date();
        const weekdays = ['日','一','二','三','四','五','六'];
        currentTimeDisplay.textContent = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} 星期${weekdays[now.getDay()]} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    }
    setInterval(updateClock, 10000);
    updateClock();

    function setStatus(msg) { statusText.textContent = msg; }
    function formatDate(d) {
        if (!d) return '';
        try { const dt = new Date(d); if (isNaN(dt)) return d; return dt.toISOString().split('T')[0]; } catch { return d; }
    }
    function formatDisplayDate(d) {
        if (!d) return '';
        try { const dt = new Date(d); if (isNaN(dt)) return d; return dt.toLocaleDateString('zh-CN'); } catch { return d; }
    }
    function getCellValue(record, colKey) { return record.data[colKey] ?? ''; }

    function escapeHtml(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function escapeAttr(value) { return escapeHtml(value); }
    function cssUrl(url) { return String(url ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }

    function getChineseInitials(text) {
        const extraMap = {
            '烟': 'y', '火': 'h', '云': 'y'
        };
        const initials = 'ABCDEFGHJKLMNOPQRSTWXYZ';
        const boundary = '阿八嚓哒妸发旮哈讥咔垃妈拿噢啪期然撒塌穵昔压匝';
        return String(text || '').split('').map(ch => {
            if (extraMap[ch]) return extraMap[ch];
            if (/^[a-zA-Z0-9]$/.test(ch)) return ch.toLowerCase();
            for (let i = boundary.length - 1; i >= 0; i--) {
                if (ch.localeCompare(boundary[i], 'zh-Hans-CN') >= 0) {
                    return initials[i] ? initials[i].toLowerCase() : '';
                }
            }
            return '';
        }).join('');
    }

    function providerMatchesKeyword(name, keyword) {
        const source = String(name || '').trim().toLowerCase();
        const kw = String(keyword || '').trim().toLowerCase();
        if (!kw) return true;
        const initials = getChineseInitials(source);
        return source.includes(kw) || initials.includes(kw);
    }

    function measureTextWidth(text, fontWeight = 600, fontSize = 14) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
        return Math.ceil(ctx.measureText(text).width);
    }

    function getDisplayValue(record, col) {
        if (!record || !col) return '';
        const colKey = col.col_key;
        const val = getCellValue(record, colKey);
        if (col.col_type === 'days_remaining') {
            let dateKey = colKey === 'host_remaining' ? 'host_expire' : (colKey === 'client_remaining' ? 'client_expire' : '');
            const days = computeDaysRemaining(record.data[dateKey]);
            return days !== '' ? days + ' 天' : '';
        } else if (colKey === 'ip_info') {
            return record.data.ip_address || '';
        } else if (colKey === 'is_expired') {
            return checkExpired(record.data.host_expire);
        } else if (colKey === 'fee') {
            const result = computeFeeValue(val);
            return result !== null ? String(result) : (val || '');
        } else if (colKey === 'expense') {
            const months = parseInt(record.data.months) || 0;
            const result = computeExpenseValue(val, months);
            return result !== null ? String(Math.round(result)) : (val || '');
        } else {
            return val === null || val === undefined ? '' : String(val);
        }
    }

    function computeFeeValue(raw) {
        if (!raw && raw !== 0) return '';
        const str = String(raw).trim();
        if (str.startsWith('=')) {
            const res = evalExpression(str);
            if (typeof res === 'number' && !isNaN(res)) return res;
            return raw;
        }
        const num = parseFloat(str);
        return isNaN(num) ? raw : num;
    }

    // 修正后的支出计算：支持 =50 或 =50+(20) 或 纯数字
    function computeExpenseValue(raw, months) {
        if (raw === null || raw === undefined) return 0;
        const str = String(raw).trim();
        const m = months || 0;
        const match = str.match(/^=(\d+(?:\.\d+)?)(?:\+\((.+)\))?$/);
        if (match) {
            const unitPrice = parseFloat(match[1]) || 0;
            const extraExpr = match[2];
            const extra = extraExpr ? safeEval(extraExpr) : 0;
            return m * unitPrice + extra;
        }
        const num = parseFloat(str);
        if (!isNaN(num)) return m * num;
        return safeEval(str);
    }

    function safeEval(expr) {
        try {
            const sanitized = expr.replace(/[^0-9+\-*/().]/g, '');
            if (!sanitized) return 0;
            const result = Function('"use strict"; return (' + sanitized + ')')();
            if (typeof result === 'number' && !isNaN(result)) return result;
            return 0;
        } catch (e) { return 0; }
    }

    function calcColumnWidth(col) {
        let headerText = getColumnDisplayName(col);
        let lines = headerText.split('<br>');
        let maxHeaderWidth = 0;
        lines.forEach(line => {
            const w = measureTextWidth(line) + 22;
            if (w > maxHeaderWidth) maxHeaderWidth = w;
        });
        if (col.is_income === 1 || col.is_income === 2) maxHeaderWidth += 20;
        maxHeaderWidth += 8;
        let maxCellWidth = 0;
        state.records.forEach(record => {
            const displayVal = getDisplayValue(record, col);
            let w = measureTextWidth(displayVal, 400, 14) + 16;
            if (col.col_key === 'expense') w = Math.max(w, 60);
            if (w > maxCellWidth) maxCellWidth = w;
        });
        return Math.max(60, Math.min(400, Math.max(maxHeaderWidth, maxCellWidth)));
    }

    function getColumnDisplayName(col) {
        const key = col.col_key;
        if (key === 'host_purchase') return '主机<br>购买时间';
        if (key === 'host_expire') return '主机<br>到期时间';
        if (key === 'host_remaining') return '主机<br>剩余天数';
        if (key === 'client_purchase') return '客户<br>购买时间';
        if (key === 'client_expire') return '客户<br>到期时间';
        if (key === 'client_remaining') return '客户<br>剩余天数';
        if (key === 'unit_price') return '单价<br>备注';
        return col.col_name;
    }

    function computeDaysRemaining(dateStr) {
        if (!dateStr) return '';
        const target = new Date(dateStr);
        if (isNaN(target)) return '';
        const now = new Date(); now.setHours(0,0,0,0);
        target.setHours(0,0,0,0);
        return Math.ceil((target - now) / (1000*60*60*24));
    }

    function checkExpired(expireDateStr) {
        if (!expireDateStr) return '未知';
        const days = computeDaysRemaining(expireDateStr);
        if (days === '') return '未知';
        return days >= 0 ? '有效' : '过期';
    }

    function calcHostExpire(purchaseDate, months) {
        if (!purchaseDate) return '';
        const d = new Date(purchaseDate);
        if (isNaN(d)) return '';
        d.setMonth(d.getMonth() + (parseInt(months) || 0));
        return d.toISOString().split('T')[0];
    }

    function getNextMonth(date) {
        const d = new Date(date);
        d.setMonth(d.getMonth() + 1);
        return d;
    }

    function evalExpression(expr) {
        if (!expr || typeof expr !== 'string') return expr;
        if (!expr.startsWith('=')) return expr;
        try {
            const sanitized = expr.slice(1).replace(/[^0-9+\-*/().]/g, '');
            if (!sanitized) return '';
            const result = Function('"use strict"; return (' + sanitized + ')')();
            if (typeof result === 'number' && !isNaN(result)) return result;
            return expr;
        } catch (e) { return expr; }
    }

    async function parseResponse(response) {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.error) {
            throw new Error(data.error || `请求失败 (${response.status})`);
        }
        return data;
    }

    const API = {
        get: (url) => fetch('/api' + url, { credentials: 'include' }).then(parseResponse),
        post: (url, data) => fetch('/api' + url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data)
        }).then(parseResponse),
        put: (url, data) => fetch('/api' + url, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data)
        }).then(parseResponse),
        delete: (url) => fetch('/api' + url, { method: 'DELETE', credentials: 'include' }).then(parseResponse)
    };

    async function loadTabs() { state.tabs = await API.get('/tabs'); return state.tabs; }
    async function loadColumns(tabId) { state.columns = await API.get('/columns?tabId=' + tabId); return state.columns; }
    async function loadRecords(tabId) {
        state.records = await API.get('/records?tabId=' + tabId);
        updateAllFilterOptions();
        return state.records;
    }

    function updateTabCache(tabId) {
        if (!tabId) return;
        state.tabCache[tabId] = {
            columns: state.columns,
            records: state.records
        };
    }

    function invalidateTabCache(tabId) {
        if (!tabId) return;
        delete state.tabCache[tabId];
    }

    function invalidateCurrentTabCache() {
        invalidateTabCache(state.currentTabId);
    }

    function updateAllFilterOptions() {
        state.columns.forEach(col => {
            const valueCountMap = new Map();
            state.records.forEach(r => {
                const dv = normalizeFilterValue(getDisplayValue(r, col));
                valueCountMap.set(dv, (valueCountMap.get(dv) || 0) + 1);
            });
            state.filterOptions[col.col_key] = Array.from(valueCountMap.entries())
                .map(([val, cnt]) => ({ value: val, count: cnt }))
                .sort((a, b) => String(a.value).localeCompare(String(b.value)));
        });
    }

    function updateFilterOptionsForCol(colKey) {
        const col = state.columns.find(c => c.col_key === colKey);
        if (!col) return;
        const valueCountMap = new Map();
        state.records.forEach(r => {
            const dv = normalizeFilterValue(getDisplayValue(r, col));
            valueCountMap.set(dv, (valueCountMap.get(dv) || 0) + 1);
        });
        state.filterOptions[colKey] = Array.from(valueCountMap.entries())
            .map(([val, cnt]) => ({ value: val, count: cnt }))
            .sort((a, b) => String(a.value).localeCompare(String(b.value)));
    }

    async function loadDataForTab(tabId, force = false) {
        try {
            if (!force && state.tabCache[tabId] && state.tabCache[tabId].columns && state.tabCache[tabId].records) {
                state.columns = state.tabCache[tabId].columns;
                state.records = state.tabCache[tabId].records;
                updateAllFilterOptions();
                setStatus(`✅ 已加载 ${state.records.length} 条记录`);
                return;
            }
            const [columns, records] = await Promise.all([
                API.get('/columns?tabId=' + tabId),
                API.get('/records?tabId=' + tabId)
            ]);
            state.columns = columns;
            state.records = records;
            updateAllFilterOptions();
            updateTabCache(tabId);
            setStatus(`✅ 已加载 ${state.records.length} 条记录`);
        }
        catch (err) { setStatus('❌ 加载失败: ' + err.message); }
    }

    function renderTabs() {
        let html = '';
        state.tabs.forEach(tab => {
            const active = tab.id === state.currentTabId ? 'active' : '';
            const checked = state.selectedTabs.has(tab.id) ? 'checked' : '';
            const checkbox = state.tabManageMode
                ? `<input type="checkbox" class="tab-select" data-tab-id="${tab.id}" ${checked} />`
                : '';
            html += `<button class="tab-item ${active}" data-tab-id="${tab.id}">
                ${checkbox}
                <span class="tab-name" data-id="${tab.id}">${escapeHtml(tab.name)}</span>
            </button>`;
        });
        tabBar.innerHTML = html;
        if (manageTabsBtn) {
            manageTabsBtn.classList.toggle('active', state.tabManageMode);
            manageTabsBtn.textContent = state.tabManageMode ? '完成' : '管理';
        }
        tabBar.querySelectorAll('.tab-select').forEach(el => {
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                const tabId = parseInt(this.dataset.tabId);
                if (this.checked) state.selectedTabs.add(tabId);
                else state.selectedTabs.delete(tabId);
            });
        });
        tabBar.querySelectorAll('.tab-name').forEach(el => {
            el.addEventListener('dblclick', async function(e) {
                e.stopPropagation();
                const tabId = parseInt(this.dataset.id);
                openRenameTabModal(tabId);
            });
        });
        tabBar.querySelectorAll('.tab-item').forEach(btn => {
            btn.addEventListener('click', function(e) {
                if (e.target.classList.contains('tab-select')) return;
                switchTab(parseInt(this.dataset.tabId));
            });
        });
        if (state.tabs.length === 0) createDefaultTab();
    }

    async function switchTab(tabId, force = false) {
        if (tabId === state.currentTabId && !force) return;
        state.currentTabId = tabId;
        state.selectedRows.clear();
        state.filters = {};
        renderTabs();
        await loadDataForTab(tabId, force);
        renderTable(false);
        const tab = state.tabs.find(t => t.id === tabId);
        if (tab) document.getElementById('columnModalTabName').textContent = tab.name;
    }

    async function createTab(name) {
        const result = await API.post('/tabs', { name });
        if (result.success) {
            state.tabs.push({ id: result.id, name });
            renderTabs();
            switchTab(result.id, true);
        }
    }
    async function createDefaultTab() { await createTab('默认'); }
    async function deleteTabs(tabIds) {
        if (!tabIds || tabIds.length === 0) { setStatus('⚠️ 请先在管理模式中勾选标签'); return; }
        if (!confirm(`确定删除 ${tabIds.length} 个标签及其所有数据吗？`)) return;
        try {
            setStatus('🔄 删除标签中...');
            await Promise.all(tabIds.map(tabId => API.delete('/tabs/' + tabId)));
            tabIds.forEach(tabId => {
                invalidateTabCache(tabId);
                state.selectedTabs.delete(tabId);
            });
            state.tabs = state.tabs.filter(t => !tabIds.includes(t.id));
            if (!state.tabs.some(t => t.id === state.currentTabId)) {
                state.currentTabId = state.tabs.length > 0 ? state.tabs[0].id : null;
            }
            renderTabs();
            if (state.currentTabId) await switchTab(state.currentTabId, true);
            else await createDefaultTab();
            setStatus(`✅ 已删除 ${tabIds.length} 个标签`);
        } catch (err) { setStatus('❌ 删除标签失败: ' + err.message); }
    }
    addTabBtn.addEventListener('click', () => {
        state.renameTabId = null;
        renameTabInput.value = '新标签';
        renameTabStatus.textContent = '';
        renameTabModal.classList.add('show');
        setTimeout(() => renameTabInput.select(), 0);
    });
    manageTabsBtn.addEventListener('click', () => {
        state.tabManageMode = !state.tabManageMode;
        if (!state.tabManageMode) state.selectedTabs.clear();
        renderTabs();
    });
    deleteTabsBtn.addEventListener('click', () => deleteTabs(Array.from(state.selectedTabs)));

    function openRenameTabModal(tabId) {
        const tab = state.tabs.find(t => t.id === tabId);
        if (!tab) return;
        state.renameTabId = tabId;
        renameTabInput.value = tab.name;
        renameTabStatus.textContent = '';
        renameTabModal.classList.add('show');
        setTimeout(() => renameTabInput.select(), 0);
    }

    function closeRenameModal() {
        renameTabModal.classList.remove('show');
        renameTabStatus.textContent = '';
    }

    async function saveRenameTab() {
        const name = renameTabInput.value.trim();
        if (!name) { renameTabStatus.textContent = '⚠️ 标签名称不能为空'; return; }
        try {
            if (state.renameTabId) {
                await API.put('/tabs/' + state.renameTabId, { name });
                const tab = state.tabs.find(t => t.id === state.renameTabId);
                if (tab) tab.name = name;
                renderTabs();
                closeRenameModal();
                setStatus('✅ 标签名称已更新');
            } else {
                await createTab(name);
                closeRenameModal();
                setStatus('✅ 标签已添加');
            }
        } catch (err) { renameTabStatus.textContent = '❌ 保存失败: ' + err.message; }
    }

    closeRenameTabModal.addEventListener('click', closeRenameModal);
    cancelRenameTabBtn.addEventListener('click', closeRenameModal);
    saveRenameTabBtn.addEventListener('click', saveRenameTab);
    renameTabInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveRenameTab();
        if (e.key === 'Escape') closeRenameModal();
    });

    function normalizeFilterValue(value) {
        if (value === null || value === undefined || String(value).trim() === '') return '(空白)';
        return String(value).trim();
    }
    function isFilterActive(colKey) { return state.filters.hasOwnProperty(colKey); }
    function recordMatchesFilter(record, colKey, selectedValues) {
        const col = state.columns.find(c => c.col_key === colKey);
        if (!col) return true;
        return selectedValues.includes(normalizeFilterValue(getDisplayValue(record, col)));
    }
    function getFilteredRecords() {
        return state.records.filter(record => {
            for (const [colKey, selectedValues] of Object.entries(state.filters)) {
                if (!recordMatchesFilter(record, colKey, selectedValues)) return false;
            }
            return true;
        });
    }

    // 渲染表格（刷新时不自动适配列宽）
    function renderTable(shouldAutoFit = false) {
        if (!state.currentTabId) return;
        const visibleColumns = state.columns.filter(c => c.col_visible !== 0);
        const filteredRecords = getFilteredRecords();

        let theadHtml = `<tr><th style="width:36px;min-width:36px;max-width:36px;text-align:center;"><input type="checkbox" id="selectAll" /></th>`;
        visibleColumns.forEach(col => {
            const isIncome = col.is_income || 0;
            let incomeLabel = isIncome === 1 ? '💰' : (isIncome === 2 ? '💸' : '');
            const hasFilter = isFilterActive(col.col_key) ? 'filter-active' : '';
            const savedWidth = col.col_width;
            const width = shouldAutoFit
                ? ((savedWidth && savedWidth !== 150) ? savedWidth : calcColumnWidth(col))
                : (savedWidth || 150);
            const displayName = getColumnDisplayName(col);
            theadHtml += `
                <th data-col="${escapeAttr(col.col_key)}" style="width:${width}px;min-width:${width}px;max-width:${width}px;">
                    <div class="th-inner">
                        <span class="col-name">${displayName} ${incomeLabel}</span>
                        <button class="col-dropdown-btn ${hasFilter}" data-col="${escapeAttr(col.col_key)}">▼</button>
                    </div>
                    <div class="col-resize" data-col="${escapeAttr(col.col_key)}"></div>
                </th>
            `;
        });
        theadHtml += '</tr>';
        tableHead.innerHTML = theadHtml;

        if (filteredRecords.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="${visibleColumns.length + 1}" style="text-align:center;padding:40px 0;color:#999;">📭 暂无数据</td></tr>`;
            recordCount.textContent = Object.keys(state.filters).length > 0 ? `共 0 / 全部 ${state.records.length} 条记录` : `共 0 条记录`;
            bindFilterEvents();
            return;
        }

        let tbodyHtml = '';
        filteredRecords.forEach((record) => {
            const isSelected = state.selectedRows.has(record.id);
            tbodyHtml += `<tr class="${isSelected ? 'selected' : ''}" data-id="${record.id}">`;
            tbodyHtml += `<td><input type="checkbox" class="row-checkbox" data-id="${record.id}" ${isSelected ? 'checked' : ''} /></td>`;
            visibleColumns.forEach(col => {
                const colKey = col.col_key;
                let val = getCellValue(record, colKey);
                let inputHtml = '';

                if (col.col_type === 'days_remaining') {
                    let dateKey = colKey === 'host_remaining' ? 'host_expire' : (colKey === 'client_remaining' ? 'client_expire' : '');
                    const days = computeDaysRemaining(record.data[dateKey]);
                    const displayVal = days !== '' ? days + ' 天' : '';
                    const color = days < 0 ? '#f56c6c' : (days <= 7 ? '#e6a23c' : '#333');
                    inputHtml = `<span style="color:${color};">${escapeHtml(displayVal)}</span>`;
                } else if (colKey === 'ip_info') {
                    inputHtml = `<span>${escapeHtml(record.data.ip_address || '')}</span>`;
                } else if (col.col_type === 'address_select') {
                    const optionsArr = col.col_options || [];
                    const options = optionsArr.map(opt => {
                        let display = opt;
                        if (opt === 'IP地址') display = 'IP';
                        else if (opt === '域名地址') display = '域名';
                        return `<option value="${escapeAttr(opt)}" ${val === opt ? 'selected' : ''}>${escapeHtml(display)}</option>`;
                    }).join('');
                    const addressValue = val || '';
                    inputHtml = `
                        <div class="address-control">
                            <select class="cell-input address-select" data-col="${escapeAttr(colKey)}" data-id="${record.id}">${options}</select>
                            <button class="open-link" data-address="${escapeAttr(addressValue)}">打开</button>
                        </div>
                    `;
                } else if (col.col_type === 'number' && colKey === 'months') {
                    const num = parseInt(val) || 0;
                    inputHtml = `
                        <div class="months-control">
                            <button class="months-dec" data-col="${escapeAttr(colKey)}" data-id="${record.id}">-</button>
                            <input type="number" class="cell-input months-input" data-col="${escapeAttr(colKey)}" data-id="${record.id}" value="${num}" min="0" step="1" />
                            <button class="months-inc" data-col="${escapeAttr(colKey)}" data-id="${record.id}">+</button>
                        </div>
                    `;
                } else if (col.col_type === 'date') {
                    const dateVal = val || '';
                    if (colKey === 'host_expire') {
                        const display = formatDisplayDate(dateVal);
                        inputHtml = `<span style="color:#333;">${escapeHtml(display)}</span>`;
                    } else {
                        inputHtml = `<div class="date-control"><input type="date" class="cell-input date-input" data-col="${escapeAttr(colKey)}" data-id="${record.id}" value="${escapeAttr(dateVal)}" /></div>`;
                    }
                } else if (colKey === 'provider') {
                    const currentProvider = val || '';
                    const providerOptions = [...state.providerOptions];
                    if (currentProvider && !providerOptions.includes(currentProvider)) providerOptions.push(currentProvider);
                    const options = providerOptions.map(opt => `
                        <div class="provider-search-option" data-value="${escapeAttr(opt)}">
                            <span>${escapeHtml(opt)}</span>
                            <small>${escapeHtml(getChineseInitials(opt))}</small>
                        </div>
                    `).join('');
                    inputHtml = `
                        <div class="provider-search-box" data-id="${record.id}" data-col="${escapeAttr(colKey)}">
                            <input type="text" class="cell-input provider-search-input" data-col="${escapeAttr(colKey)}" data-id="${record.id}" value="${escapeAttr(currentProvider)}" placeholder="搜索服务商" autocomplete="off" />
                            <div class="provider-search-dropdown">${options}<div class="provider-search-empty">暂无匹配服务商</div></div>
                        </div>
                    `;
                } else if (col.col_type === 'select') {
                    const options = (col.col_options || []).map(opt => `<option value="${escapeAttr(opt)}" ${val === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('');
                    inputHtml = `<select class="cell-input select-cell" data-col="${escapeAttr(colKey)}" data-id="${record.id}"><option value="">-</option>${options}</select>`;
                } else if (colKey === 'is_expired') {
                    const expireDate = record.data.host_expire;
                    const status = checkExpired(expireDate);
                    const color = status === '有效' ? '#67c23a' : (status === '过期' ? '#f56c6c' : '#999');
                    inputHtml = `<span style="color:${color};">${escapeHtml(status)}</span>`;
                } else if (colKey === 'expense') {
                    const rawValue = val || '';
                    const months = parseInt(record.data.months) || 0;
                    const displayValue = Math.round(computeExpenseValue(rawValue, months));
                    inputHtml = `
                        <div class="expense-inline">
                            <span class="expense-display">${displayValue}</span>
                            <input type="text" class="cell-input expense-input" value="${escapeAttr(rawValue)}" style="display:none;" />
                        </div>
                    `;
                } else if (colKey === 'fee') {
                    const rawValue = val || '';
                    const displayVal = computeFeeValue(rawValue);
                    const displayText = (displayVal !== '' && displayVal !== null && !isNaN(Number(displayVal))) ? Number(displayVal) : (displayVal || '0');
                    inputHtml = `
                        <div class="fee-control" data-col="${escapeAttr(colKey)}" data-id="${record.id}">
                            <span class="fee-display">${escapeHtml(String(displayText))}</span>
                            <input type="text" class="cell-input fee-input" value="${escapeAttr(rawValue)}" style="display:none;" />
                        </div>
                    `;
                } else {
                    const inputType = col.col_type === 'number' ? 'number' : 'text';
                    const step = col.col_type === 'number' ? 'step="0.01"' : '';
                    inputHtml = `<input type="${inputType}" class="cell-input" data-col="${escapeAttr(colKey)}" data-id="${record.id}" value="${escapeAttr(val || '')}" ${step} />`;
                }
                tbodyHtml += `<td class="${colKey === 'expense' || colKey === 'fee' ? 'editable-td' : ''}">${inputHtml}</td>`;
            });
            tbodyHtml += '</tr>';
        });
        tableBody.innerHTML = tbodyHtml;
        recordCount.textContent = Object.keys(state.filters).length > 0 ? `共 ${filteredRecords.length} / 全部 ${state.records.length} 条记录` : `共 ${filteredRecords.length} 条记录`;

        bindTableEvents();
        bindFilterEvents();
        bindSpecialEvents();

        if (shouldAutoFit) autoFitColumns();
    }

    function autoFitColumns() {
        const table = document.getElementById('dataTable');
        if (!table) return;
        table.querySelectorAll('th').forEach((th, index) => {
            if (index === 0) return;
            const colKey = th.dataset.col;
            const col = state.columns.find(c => c.col_key === colKey);
            if (!col) return;
            const width = calcColumnWidth(col);
            th.style.width = width + 'px';
            th.style.minWidth = width + 'px';
            col.col_width = width;
            API.put('/columns/' + col.id, { col_width: width }).catch(() => {});
        });
    }

    // --- 筛选面板动态生成 ---
    function getOrCreateFilterPanel(colKey) {
        let panel = document.querySelector(`.col-dropdown-panel[data-col="${colKey}"]`);
        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'col-dropdown-panel';
            panel.dataset.col = colKey;
            panel.innerHTML = `
                <div class="filter-input-wrap">
                    <input type="text" placeholder="搜索..." class="filter-search" data-col="${escapeAttr(colKey)}" />
                </div>
                <div class="filter-options"></div>
                <div class="filter-summary">已选 0 / 0</div>
                <div class="filter-actions">
                    <div class="btn-row">
                        <button class="filter-ok" data-col="${escapeAttr(colKey)}">确定</button>
                        <button class="filter-cancel" data-col="${escapeAttr(colKey)}">取消</button>
                    </div>
                    <div class="btn-row full-width">
                        <button class="filter-clear" data-col="${escapeAttr(colKey)}">清除筛选</button>
                    </div>
                </div>
            `;
            document.body.appendChild(panel);
        }
        return panel;
    }

    function refreshFilterPanelContent(panel, colKey) {
        const options = state.filterOptions[colKey] || [];
        const optionsHtml = options.map(opt => `
            <label class="filter-option-label" data-filter-label="${escapeHtml(String(opt.value).toLowerCase())}">
                <input type="checkbox" class="filter-option" data-col="${escapeAttr(colKey)}" value="${escapeAttr(opt.value)}" />
                <span class="filter-option-text">${escapeHtml(opt.value)}</span>
                <span class="filter-count">(${opt.count})</span>
            </label>
        `).join('');

        const allHtml = `
            <label class="filter-option-label filter-select-all">
                <input type="checkbox" class="filter-select-all-checkbox" data-col="${escapeAttr(colKey)}" /> <span class="filter-option-text">全选</span>
            </label>
            ${optionsHtml}
        `;
        panel.querySelector('.filter-options').innerHTML = allHtml;
        panel.querySelector('.filter-summary').textContent = `已选 0 / ${options.length}`;

        const allCheckboxes = Array.from(panel.querySelectorAll('.filter-option:not(.filter-select-all-checkbox)'));
        const selected = isFilterActive(colKey) ? state.filters[colKey] : allCheckboxes.map(cb => cb.value);
        allCheckboxes.forEach(cb => { cb.checked = selected.includes(cb.value); });
        updateSelectAllCheckbox(panel);
    }

    function positionFilterPanel(panel, colKey) {
        const th = document.querySelector(`th[data-col="${colKey}"]`);
        if (!th) return;
        const rect = th.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1200;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
        const panelWidth = Math.min(Math.max(rect.width, 180), Math.max(180, viewportWidth - 16));
        const maxLeft = Math.max(8, viewportWidth - panelWidth - 8);
        const left = Math.min(Math.max(8, rect.left), maxLeft);
        const top = Math.min(rect.bottom + 2, Math.max(8, viewportHeight - 300));
        panel.style.position = 'fixed';
        panel.style.left = left + 'px';
        panel.style.top = top + 'px';
        panel.style.width = panelWidth + 'px';
        panel.style.maxHeight = '280px';
        panel.style.overflowY = 'auto';
        panel.style.zIndex = '10000';
    }

    function closeFilterPanels() {
        $$('.col-dropdown-panel.show').forEach(p => p.classList.remove('show'));
    }

    function getVisibleFilterOptions(panel) {
        return Array.from(panel.querySelectorAll('.filter-option-label'))
            .filter(label => label.style.display !== 'none' && !label.classList.contains('filter-select-all'))
            .map(label => label.querySelector('.filter-option'))
            .filter(Boolean);
    }

    function updateSelectAllCheckbox(panel) {
        const allCb = panel.querySelector('.filter-select-all-checkbox');
        if (!allCb) return;
        const visibleOptions = getVisibleFilterOptions(panel);
        if (visibleOptions.length === 0) {
            allCb.checked = false;
            allCb.indeterminate = false;
            updateFilterSummary(panel);
            return;
        }
        const checkedCount = visibleOptions.filter(opt => opt.checked).length;
        allCb.checked = checkedCount === visibleOptions.length;
        allCb.indeterminate = checkedCount > 0 && checkedCount < visibleOptions.length;
        updateFilterSummary(panel);
    }

    // 修正后的计数：基于可见选项
    function updateFilterSummary(panel) {
        const summary = panel.querySelector('.filter-summary');
        if (!summary) return;
        const visibleOptions = getVisibleFilterOptions(panel);
        const total = visibleOptions.length;
        const checked = visibleOptions.filter(opt => opt.checked).length;
        summary.textContent = `已选 ${checked} / ${total}`;
    }

    function bindFilterEvents() {
        if (filterDocumentClickBound) return;
        filterDocumentClickBound = true;

        document.body.addEventListener('click', function(e) {
            if (e.target.classList.contains('col-dropdown-btn')) {
                e.stopPropagation();
                const colKey = e.target.dataset.col;
                const panel = getOrCreateFilterPanel(colKey);
                const isOpen = panel.classList.contains('show');
                closeFilterPanels();
                if (!isOpen) {
                    refreshFilterPanelContent(panel, colKey);
                    positionFilterPanel(panel, colKey);
                    panel.classList.add('show');
                    const search = panel.querySelector('.filter-search');
                    if (search) setTimeout(() => search.focus(), 0);
                }
                return;
            }

            if (!e.target.closest('.col-dropdown-btn') && !e.target.closest('.col-dropdown-panel')) {
                closeFilterPanels();
            }

            if (e.target.classList.contains('filter-ok')) {
                const colKey = e.target.dataset.col;
                const panel = document.querySelector(`.col-dropdown-panel[data-col="${colKey}"]`);
                if (!panel) return;
                const searchInput = panel.querySelector('.filter-search');
                const searchText = searchInput ? searchInput.value.trim() : '';
                const allCbs = Array.from(panel.querySelectorAll('.filter-option:not(.filter-select-all-checkbox)'));
                const allValues = allCbs.map(cb => cb.value);

                let checkedValues;
                if (searchText === '') {
                    // 无搜索：直接读全部勾选状态
                    checkedValues = allCbs.filter(cb => cb.checked).map(cb => cb.value);
                } else {
                    // 有搜索关键字时：只把【当前可见且勾选】的值作为筛选结果
                    // 不合并隐藏项，用户搜索后勾选什么就只显示什么
                    const visibleCbs = allCbs.filter(cb => {
                        const label = cb.closest('.filter-option-label');
                        return label && label.style.display !== 'none';
                    });
                    checkedValues = visibleCbs.filter(cb => cb.checked).map(cb => cb.value);
                }

                if (checkedValues.length === 0) {
                    // 没有选中任何项，不做筛选（清除该列筛选）
                    delete state.filters[colKey];
                } else if (checkedValues.length === allValues.length) {
                    // 全部都选了，等于没有筛选
                    delete state.filters[colKey];
                } else {
                    state.filters[colKey] = checkedValues;
                }
                panel.classList.remove('show');
                renderTable(false);
                return;
            }

            if (e.target.classList.contains('filter-cancel')) {
                const panel = e.target.closest('.col-dropdown-panel');
                if (panel) panel.classList.remove('show');
                return;
            }

            if (e.target.classList.contains('filter-clear')) {
                const colKey = e.target.dataset.col;
                delete state.filters[colKey];
                const panel = document.querySelector(`.col-dropdown-panel[data-col="${colKey}"]`);
                if (panel) panel.classList.remove('show');
                renderTable(false);
                return;
            }
        });

        document.body.addEventListener('change', function(e) {
            if (e.target.classList.contains('filter-select-all-checkbox')) {
                const panel = e.target.closest('.col-dropdown-panel');
                const visibleOptions = getVisibleFilterOptions(panel);
                visibleOptions.forEach(opt => { opt.checked = e.target.checked; });
                updateSelectAllCheckbox(panel);
            } else if (e.target.classList.contains('filter-option') && !e.target.classList.contains('filter-select-all-checkbox')) {
                updateSelectAllCheckbox(e.target.closest('.col-dropdown-panel'));
            }
        });

        // 搜索过滤
        document.body.addEventListener('input', function(e) {
            if (e.target.classList.contains('filter-search')) {
                const panel = e.target.closest('.col-dropdown-panel');
                if (!panel) return;
                const searchText = e.target.value.trim().toLowerCase();
                const labels = panel.querySelectorAll('.filter-option-label:not(.filter-select-all)');
                labels.forEach(label => {
                    const text = (label.dataset.filterLabel || '').toLowerCase();
                    if (searchText === '' || text.includes(searchText)) {
                        label.style.display = 'flex';
                    } else {
                        label.style.display = 'none';
                    }
                });
                const selectAllLabel = panel.querySelector('.filter-select-all');
                if (selectAllLabel) {
                    selectAllLabel.style.display = searchText === '' ? 'flex' : 'none';
                }
                updateSelectAllCheckbox(panel);
            }
        });
    }

    // 表格事件
    function bindTableEvents() {
        const selectAll = $('#selectAll');
        if (selectAll) {
            selectAll.onchange = function() {
                const checked = this.checked;
                $$('.row-checkbox').forEach(cb => cb.checked = checked);
                state.selectedRows.clear();
                if (checked) $$('.row-checkbox').forEach(cb => state.selectedRows.add(parseInt(cb.dataset.id)));
                updateRowSelection();
            };
        }
        $$('.row-checkbox').forEach(cb => {
            cb.onchange = function() {
                const id = parseInt(this.dataset.id);
                if (this.checked) state.selectedRows.add(id);
                else state.selectedRows.delete(id);
                updateRowSelection();
                if (selectAll) selectAll.checked = $$('.row-checkbox').length > 0 && Array.from($$('.row-checkbox')).every(c => c.checked);
            };
        });

        $$('.cell-input:not(.address-select):not(.provider-search-input):not(.months-input):not(.date-input):not(.expense-input):not(.fee-input)').forEach(input => {
            input.onblur = () => handleCellChange(input);
            input.onkeydown = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
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
                            col.col_width = width;
                            API.put('/columns/' + col.id, { col_width: width }).catch(() => {});
                        }
                    }
                };
            };
        });
    }

    function bindSpecialEvents() {
        // 日期
        $$('.date-input').forEach(input => {
            input.onchange = function() {
                const col = this.dataset.col;
                const id = parseInt(this.dataset.id);
                const record = state.records.find(r => r.id === id);
                if (!record) return;
                const dateVal = this.value;
                record.data[col] = dateVal;
                record._updated = true;
                if (col === 'host_purchase') {
                    const months = parseInt(record.data.months) || 0;
                    record.data.host_expire = calcHostExpire(dateVal, months);
                }
                if (col === 'client_purchase') {
                    if (dateVal) {
                        const d = new Date(dateVal);
                        d.setMonth(d.getMonth() + 1);
                        record.data.client_expire = d.toISOString().split('T')[0];
                    }
                }
                renderTable(false);
                saveRecord(record);
            };
        });

        // 月数
        $$('.months-dec').forEach(btn => {
            btn.onclick = function() {
                const col = this.dataset.col;
                const id = parseInt(this.dataset.id);
                const input = document.querySelector(`.months-input[data-col="${col}"][data-id="${id}"]`);
                if (!input) return;
                let val = parseInt(input.value) || 0;
                if (val > 0) val--;
                input.value = val;
                handleCellChange(input);
            };
        });
        $$('.months-inc').forEach(btn => {
            btn.onclick = function() {
                const col = this.dataset.col;
                const id = parseInt(this.dataset.id);
                const input = document.querySelector(`.months-input[data-col="${col}"][data-id="${id}"]`);
                if (!input) return;
                let val = parseInt(input.value) || 0;
                val++;
                input.value = val;
                handleCellChange(input);
            };
        });
        $$('.months-input').forEach(input => { input.onchange = function() { handleCellChange(this); }; });

        // 地址下拉
        $$('.address-select').forEach(sel => {
            sel.onchange = function() {
                const tr = this.closest('tr');
                const openBtn = tr.querySelector('.open-link');
                if (openBtn) openBtn.dataset.address = this.value;
                const col = this.dataset.col;
                const id = parseInt(this.dataset.id);
                const record = state.records.find(r => r.id === id);
                if (!record) return;
                if (col === 'address') {
                    record.data.ip_info = record.data.ip_address || '';
                    renderTable(false);
                    saveRecord(record);
                }
                handleCellChange(this);
            };
        });

        // 服务商快速检索下拉
        $$('.provider-search-box').forEach(box => {
            const input = box.querySelector('.provider-search-input');
            const dropdown = box.querySelector('.provider-search-dropdown');
            if (!input || !dropdown) return;

            const refreshOptions = () => {
                const keyword = input.value.trim();
                const rect = input.getBoundingClientRect();
                dropdown.style.left = rect.left + 'px';
                dropdown.style.top = (rect.bottom + 2) + 'px';
                dropdown.style.width = Math.max(rect.width, 160) + 'px';
                const options = Array.from(dropdown.querySelectorAll('.provider-search-option'));
                let visibleCount = 0;
                options.forEach(option => {
                    const name = option.dataset.value || '';
                    const visible = providerMatchesKeyword(name, keyword);
                    option.style.display = visible ? 'flex' : 'none';
                    if (visible) visibleCount++;
                });
                const empty = dropdown.querySelector('.provider-search-empty');
                if (empty) empty.style.display = visibleCount === 0 ? 'block' : 'none';
                dropdown.classList.add('show');
            };

            const saveProviderValue = (value) => {
                const colKey = input.dataset.col;
                const id = parseInt(input.dataset.id);
                const record = state.records.find(r => r.id === id);
                if (!record) return;
                record.data[colKey] = value;
                record._updated = true;
                input.value = value;
                updateFilterOptionsForCol(colKey);
                saveRecord(record);
            };

            input.addEventListener('focus', refreshOptions);
            input.addEventListener('input', refreshOptions);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const firstVisible = Array.from(dropdown.querySelectorAll('.provider-search-option'))
                        .find(option => option.style.display !== 'none');
                    if (firstVisible) {
                        saveProviderValue(firstVisible.dataset.value || '');
                        dropdown.classList.remove('show');
                    }
                }
                if (e.key === 'Escape') dropdown.classList.remove('show');
            });
            input.addEventListener('blur', () => {
                setTimeout(() => dropdown.classList.remove('show'), 180);
            });
            dropdown.querySelectorAll('.provider-search-option').forEach(option => {
                option.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    saveProviderValue(option.dataset.value || '');
                    dropdown.classList.remove('show');
                });
            });
        });

        $$('.cell-input[data-col="ip_address"]').forEach(input => {
            input.onchange = function() {
                const id = parseInt(this.dataset.id);
                const record = state.records.find(r => r.id === id);
                if (!record) return;
                record.data.ip_info = this.value.trim();
                renderTable(false);
                saveRecord(record);
            };
        });

        $$('.open-link').forEach(btn => {
            btn.onclick = function() {
                const address = this.dataset.address;
                if (!address) { setStatus('⚠️ 请先选择地址类型'); return; }
                const tr = this.closest('tr');
                const rowId = parseInt(tr.dataset.id);
                const record = state.records.find(r => r.id === rowId);
                if (!record) return;
                const ip = record.data.ip_address || '';
                const domain = record.data.domain || '';
                let base = '';
                let suffix = '';
                if (address === 'IP地址' || address === 'IP') {
                    if (!ip) { setStatus('⚠️ IP地址为空'); return; }
                    base = ip;
                    suffix = state.ipPortSuffix || '';
                } else if (address === '域名地址' || address === '域名') {
                    if (!domain) { setStatus('⚠️ 域名为空'); return; }
                    base = domain;
                    suffix = state.domainPortSuffix || '';
                }
                if (base) {
                    const url = base + suffix;
                    let fullUrl = url;
                    if (!/^https?:\/\//i.test(fullUrl)) fullUrl = 'http://' + fullUrl;
                    window.open(fullUrl, '_blank');
                }
            };
        });

        // 支出交互（点击显示文字切换为编辑）
        $$('.expense-display').forEach(display => {
            display.addEventListener('click', function(e) {
                const parent = this.parentElement; // .expense-inline
                const input = parent.querySelector('.expense-input');
                const td = parent.closest('td');
                this.style.display = 'none';
                input.style.display = 'inline-block';
                td.classList.add('editing-cell');
                input.focus();
                input.select();
            });
        });

        $$('.expense-input').forEach(input => {
            const finishEditing = () => {
                const parent = input.closest('.expense-inline');
                const display = parent.querySelector('.expense-display');
                const td = parent.closest('td');
                const id = parseInt(parent.closest('tr').dataset.id);
                const record = state.records.find(r => r.id === id);
                if (!record) return;

                const rawValue = input.value.trim();
                record.data['expense'] = rawValue || '0';
                record._updated = true;

                const months = parseInt(record.data.months) || 0;
                const computed = Math.round(computeExpenseValue(rawValue, months));
                display.textContent = computed;

                input.style.display = 'none';
                display.style.display = 'inline';
                td.classList.remove('editing-cell');

                if (record._saveTimeout) clearTimeout(record._saveTimeout);
                record._saveTimeout = setTimeout(() => saveRecord(record), 300);
                updateFilterOptionsForCol('expense');
                renderTable(false);
            };

            input.addEventListener('blur', finishEditing);
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    finishEditing();
                }
                if (e.key === 'Escape') {
                    const parent = input.closest('.expense-inline');
                    const display = parent.querySelector('.expense-display');
                    const td = parent.closest('td');
                    const id = parseInt(parent.closest('tr').dataset.id);
                    const record = state.records.find(r => r.id === id);
                    const raw = record ? (record.data['expense'] || '') : '';
                    input.value = raw;
                    input.blur();
                }
            });
            input.addEventListener('focus', function() {
                const td = this.closest('td');
                if (td) td.classList.add('editing-cell');
            });
            input.addEventListener('blur', function() {
                const td = this.closest('td');
                if (td) td.classList.remove('editing-cell');
            });
        });

        // 收入交互（同样处理）
        $$('.fee-display').forEach(display => {
            display.addEventListener('click', function(e) {
                const parent = this.parentElement;
                const input = parent.querySelector('.fee-input');
                const td = parent.closest('td');
                this.style.display = 'none';
                input.style.display = 'inline-block';
                td.classList.add('editing-cell');
                input.focus();
                input.select();
            });
        });

        $$('.fee-input').forEach(input => {
            const finishEditing = () => {
                const parent = input.closest('.fee-control');
                const display = parent.querySelector('.fee-display');
                const td = parent.closest('td');
                const colKey = parent.dataset.col;
                const id = parseInt(parent.dataset.id);
                const record = state.records.find(r => r.id === id);
                if (!record) return;

                const rawValue = input.value.trim();
                record.data[colKey] = rawValue;
                record._updated = true;

                const computed = computeFeeValue(rawValue);
                const displayText = (computed !== '' && computed !== null && !isNaN(Number(computed))) ? Number(computed) : (computed || '0');
                display.textContent = String(displayText);

                input.style.display = 'none';
                display.style.display = 'inline';
                td.classList.remove('editing-cell');

                if (record._saveTimeout) clearTimeout(record._saveTimeout);
                record._saveTimeout = setTimeout(() => saveRecord(record), 300);
                updateFilterOptionsForCol(colKey);
                renderTable(false);
            };

            input.addEventListener('blur', finishEditing);
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    finishEditing();
                }
                if (e.key === 'Escape') {
                    const parent = input.closest('.fee-control');
                    const display = parent.querySelector('.fee-display');
                    const td = parent.closest('td');
                    const id = parseInt(parent.dataset.id);
                    const record = state.records.find(r => r.id === id);
                    const raw = record ? (record.data[parent.dataset.col] || '') : '';
                    input.value = raw;
                    input.blur();
                }
            });
            input.addEventListener('focus', function() {
                const td = this.closest('td');
                if (td) td.classList.add('editing-cell');
            });
            input.addEventListener('blur', function() {
                const td = this.closest('td');
                if (td) td.classList.remove('editing-cell');
            });
        });
    }

    function handleCellChange(input) {
        const colKey = input.dataset.col;
        const id = parseInt(input.dataset.id);
        let val = input.value;
        const col = state.columns.find(c => c.col_key === colKey);
        if (!col) return;
        if (colKey === 'expense' || colKey === 'fee' || colKey === 'host_expire' || col.col_type === 'days_remaining' || colKey === 'is_expired') return;

        const record = state.records.find(r => r.id === id);
        if (!record) return;

        if (col.col_type === 'number') {
            if (val !== '' && !isNaN(val)) val = parseFloat(val);
            else val = 0;
        } else if (col.col_type === 'boolean') {
            if (val === 'true') val = true;
            else if (val === 'false') val = false;
            else val = null;
        }

        if (record.data[colKey] === val || (record.data[colKey] === undefined && val === '')) return;
        record.data[colKey] = val;
        record._updated = true;

        if (colKey === 'months') {
            const purchase = record.data.host_purchase;
            if (purchase) record.data.host_expire = calcHostExpire(purchase, val);
            else record.data.host_expire = '';
            renderTable(false);
        }
        if (colKey === 'ip_address') record.data.ip_info = val;

        if (record._saveTimeout) clearTimeout(record._saveTimeout);
        record._saveTimeout = setTimeout(() => saveRecord(record), 300);
        renderTable(false);
    }

    function saveRecord(record) {
        if (!record._updated) return;
        record._updated = false;
        API.put('/records/' + record.id, { data: record.data })
            .then(() => {
                updateTabCache(state.currentTabId);
                setStatus('✅ 保存成功');
            })
            .catch(err => { setStatus('❌ 保存失败: ' + err.message); record._updated = true; });
    }

    function updateRowSelection() {
        $$('#tableBody tr').forEach(tr => {
            const id = parseInt(tr.dataset.id);
            if (state.selectedRows.has(id)) tr.classList.add('selected');
            else tr.classList.remove('selected');
        });
    }

    // --- 增删 ---
    async function addRow() {
        if (!state.currentTabId) return;
        try {
            setStatus('🔄 添加中...');
            const data = {};
            state.columns.forEach(col => { data[col.col_key] = ''; });
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            data.host_purchase = today;
            data.months = 1;
            data.host_expire = calcHostExpire(today, 1);
            data.client_purchase = today;
            data.client_expire = getNextMonth(now).toISOString().split('T')[0];
            data.expense = '0';
            data.fee = '';
            data.address = 'IP地址';

            const result = await API.post('/records', { tab_id: state.currentTabId, data });
            const newRecord = { id: result.id, data };
            state.records.unshift(newRecord);
            updateTabCache(state.currentTabId);
            renderTable(false);
            setStatus('✅ 添加成功');
            const firstInput = document.querySelector('.cell-input');
            if (firstInput) firstInput.focus();
        } catch (err) { setStatus('❌ 添加失败: ' + err.message); }
    }

    async function deleteSelected() {
        const ids = Array.from(state.selectedRows);
        if (ids.length === 0) { setStatus('⚠️ 请选择行'); return; }
        if (!confirm(`确定删除 ${ids.length} 条记录吗？`)) return;
        try {
            setStatus('🔄 删除中...');
            await API.post('/records/batch-delete', { ids });
            state.records = state.records.filter(r => !ids.includes(r.id));
            state.selectedRows.clear();
            updateTabCache(state.currentTabId);
            renderTable(false);
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
            invalidateCurrentTabCache();
            await loadDataForTab(state.currentTabId, true);
            renderTable(false);
            importStatus.textContent = `✅ 成功导入 ${records.length} 条`;
            setTimeout(() => importModal.classList.remove('show'), 1500);
        } catch (err) { importStatus.textContent = '❌ 导入失败: ' + err.message; }
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

    // --- 列管理 ---
    async function showColumnManager() {
        if (!state.currentTabId) { setStatus('⚠️ 请先选择一个标签'); return; }
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
            let incomeLabel = '';
            if (isIncome === 1) incomeLabel = '💰';
            else if (isIncome === 2) incomeLabel = '💸';
            html += `
                <div class="column-item" draggable="true" data-id="${col.id}">
                    <div class="col-info">
                        <span><strong>${escapeHtml(col.col_name)}</strong></span>
                        <span class="col-key">(${escapeHtml(col.col_key)})</span>
                        <button class="income-toggle ${isIncome === 1 ? 'active-income' : (isIncome === 2 ? 'active-expense' : '')}" data-id="${col.id}">${incomeLabel || '普通'}</button>
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

        const items = columnList.querySelectorAll('.column-item');
        items.forEach(item => {
            item.addEventListener('dragstart', function(e) {
                this.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', this.dataset.id);
            });
            item.addEventListener('dragend', function() { this.classList.remove('dragging'); });
            item.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                this.classList.add('drag-over');
            });
            item.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
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
                const temp = cols[draggedIndex].col_order;
                cols[draggedIndex].col_order = cols[targetIndex].col_order;
                cols[targetIndex].col_order = temp;
                cols.sort((a, b) => a.col_order - b.col_order);
                const orderMap = {};
                cols.forEach((c, i) => { orderMap[c.id] = i; });
                try {
                    await API.post('/columns/reorder', { orderMap });
                    state.columns = cols;
                    updateTabCache(state.currentTabId);
                    renderColumnList();
                    renderTable(false);
                    setStatus('✅ 顺序已更新');
                } catch (err) {
                    setStatus('❌ 更新失败: ' + err.message);
                    await loadColumns(state.currentTabId);
                    renderColumnList();
                }
            });
        });

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
                    updateTabCache(state.currentTabId);
                    renderColumnList();
                    renderTable(false);
                    setStatus('✅ 标记已更新');
                } catch (err) { setStatus('❌ 更新失败: ' + err.message); }
            });
        });
    }

    window.toggleColumnVisibility = async function(id, currentVisible) {
        try {
            await API.put('/columns/' + id, { col_visible: currentVisible === 1 ? 0 : 1 });
            await loadColumns(state.currentTabId);
            updateTabCache(state.currentTabId);
            renderColumnList();
            renderTable(false);
            setStatus('✅ 列状态已更新');
        } catch (err) { setStatus('❌ 更新失败: ' + err.message); }
    };
    window.deleteColumn = async function(id) {
        if (!confirm('确定删除此列吗？')) return;
        try {
            await API.delete('/columns/' + id);
            await loadColumns(state.currentTabId);
            updateTabCache(state.currentTabId);
            renderColumnList();
            renderTable(false);
            setStatus('✅ 列已删除');
        } catch (err) { setStatus('❌ 删除失败: ' + err.message); }
    };

    async function addColumn() {
        const name = newColName.value.trim();
        const type = newColType.value;
        if (!name) { setStatus('⚠️ 请输入列名称'); return; }
        if (!state.currentTabId) { setStatus('⚠️ 请先选择一个标签'); return; }

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
                await loadColumns(state.currentTabId);
                updateTabCache(state.currentTabId);
                renderColumnList();
                renderTable(false);
                setStatus('✅ 列添加成功');
            } else {
                setStatus('❌ 添加失败: ' + (result.error || '未知错误'));
            }
        } catch (err) { setStatus('❌ 添加失败: ' + err.message); }
    }

    // --- 统计 ---
    async function getAllTabRecordsForStats() {
        const all = [];
        for (const tab of state.tabs) {
            let records;
            if (tab.id === state.currentTabId) {
                records = state.records;
            } else if (state.tabCache[tab.id] && state.tabCache[tab.id].records) {
                records = state.tabCache[tab.id].records;
            } else {
                records = await API.get('/records?tabId=' + tab.id);
                state.tabCache[tab.id] = state.tabCache[tab.id] || {};
                state.tabCache[tab.id].records = records;
            }
            records.forEach(record => all.push({ ...record, tabId: tab.id, tabName: tab.name }));
        }
        return all;
    }

    function getStatsDate(record) {
        const dateVal = record.data.host_purchase || record.data.client_purchase || record.created_at || '';
        const d = new Date(dateVal);
        return isNaN(d) ? null : d;
    }

    function getRecordFinancials(record) {
        const months = parseInt(record.data.months) || 0;
        const expense = computeExpenseValue(record.data.expense, months) || 0;
        const feeNum = computeFeeValue(record.data.fee || '');
        const income = typeof feeNum === 'number' ? feeNum : (parseFloat(feeNum) || 0);
        return { income, expense, net: income - expense };
    }

    function sumStats(records) {
        return records.reduce((acc, record) => {
            const f = getRecordFinancials(record);
            acc.income += f.income;
            acc.expense += f.expense;
            acc.net += f.net;
            acc.count += 1;
            return acc;
        }, { income: 0, expense: 0, net: 0, count: 0 });
    }

    function formatMoney(value) {
        return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function renderMiniBars(items, maxValue, valueKey, colorClass) {
        if (items.length === 0) return '<div class="stats-empty">暂无数据</div>';
        return items.map(item => {
            const value = Math.abs(item[valueKey] || 0);
            const width = maxValue > 0 ? Math.max(4, Math.round(value / maxValue * 100)) : 4;
            return `
                <div class="stats-bar-row">
                    <div class="stats-bar-label">${escapeHtml(item.label)}</div>
                    <div class="stats-bar-track"><div class="stats-bar ${colorClass}" style="width:${width}%;"></div></div>
                    <div class="stats-bar-value">${formatMoney(item[valueKey])}</div>
                </div>
            `;
        }).join('');
    }

    async function renderStats() {
        try {
            statsContainer.innerHTML = '<div class="stats-loading">正在汇总所有标签数据...</div>';
            const records = await getAllTabRecordsForStats();
            if (records.length === 0) {
                statsContainer.innerHTML = '<div class="stats-empty large">暂无可统计数据</div>';
                return;
            }

            const total = sumStats(records);
            const profitRate = total.income > 0 ? (total.net / total.income * 100) : 0;
            const avgIncome = total.count ? total.income / total.count : 0;
            const avgExpense = total.count ? total.expense / total.count : 0;
            const expiredCount = records.filter(r => checkExpired(r.data.host_expire) === '过期').length;
            const activeCount = records.filter(r => checkExpired(r.data.host_expire) === '有效').length;

            const monthMap = {};
            const yearMap = {};
            const tabMap = {};
            const providerMap = {};

            records.forEach(record => {
                const f = getRecordFinancials(record);
                const d = getStatsDate(record);
                if (d) {
                    const year = String(d.getFullYear());
                    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    monthMap[month] = monthMap[month] || { label: month, income: 0, expense: 0, net: 0, count: 0 };
                    yearMap[year] = yearMap[year] || { label: year, income: 0, expense: 0, net: 0, count: 0 };
                    [monthMap[month], yearMap[year]].forEach(item => {
                        item.income += f.income;
                        item.expense += f.expense;
                        item.net += f.net;
                        item.count += 1;
                    });
                }
                const tabName = record.tabName || '未命名标签';
                tabMap[tabName] = tabMap[tabName] || { label: tabName, income: 0, expense: 0, net: 0, count: 0 };
                tabMap[tabName].income += f.income;
                tabMap[tabName].expense += f.expense;
                tabMap[tabName].net += f.net;
                tabMap[tabName].count += 1;

                const provider = record.data.provider || '未填写服务商';
                providerMap[provider] = providerMap[provider] || { label: provider, income: 0, expense: 0, net: 0, count: 0 };
                providerMap[provider].income += f.income;
                providerMap[provider].expense += f.expense;
                providerMap[provider].net += f.net;
                providerMap[provider].count += 1;
            });

            const months = Object.values(monthMap).sort((a, b) => a.label.localeCompare(b.label));
            const recentMonths = months.slice(-12);
            const years = Object.values(yearMap).sort((a, b) => a.label.localeCompare(b.label));
            const tabs = Object.values(tabMap).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
            const providers = Object.values(providerMap).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).slice(0, 8);
            const maxMonthAmount = Math.max(1, ...recentMonths.map(m => Math.max(Math.abs(m.income), Math.abs(m.expense), Math.abs(m.net))));
            const maxTabNet = Math.max(1, ...tabs.map(t => Math.abs(t.net)));
            const maxProviderNet = Math.max(1, ...providers.map(p => Math.abs(p.net)));

            const bestMonth = months.length ? months.reduce((best, item) => item.net > best.net ? item : best, months[0]) : null;
            const worstMonth = months.length ? months.reduce((worst, item) => item.net < worst.net ? item : worst, months[0]) : null;

            const monthRows = recentMonths.map(item => `
                <tr>
                    <td>${escapeHtml(item.label)}</td>
                    <td class="positive">${formatMoney(item.income)}</td>
                    <td class="negative">${formatMoney(item.expense)}</td>
                    <td class="${item.net >= 0 ? 'positive' : 'negative'}">${formatMoney(item.net)}</td>
                    <td>${item.count}</td>
                </tr>
            `).join('');

            const yearRows = years.map(item => `
                <tr>
                    <td>${escapeHtml(item.label)}</td>
                    <td class="positive">${formatMoney(item.income)}</td>
                    <td class="negative">${formatMoney(item.expense)}</td>
                    <td class="${item.net >= 0 ? 'positive' : 'negative'}">${formatMoney(item.net)}</td>
                    <td>${item.count}</td>
                </tr>
            `).join('');

            statsContainer.innerHTML = `
                <div class="stats-hero">
                    <div>
                        <div class="stats-eyebrow">All Tabs Financial Intelligence</div>
                        <h2>全标签财务统计</h2>
                        <p>已合并 ${state.tabs.length} 个标签，共 ${records.length} 条记录。</p>
                    </div>
                    <div class="stats-hero-net ${total.net >= 0 ? 'positive' : 'negative'}">
                        <span>净收入</span>
                        <strong>${formatMoney(total.net)}</strong>
                    </div>
                </div>

                <div class="stats-grid premium">
                    <div class="stat-card dark"><div class="stat-label">总收入</div><div class="stat-value positive">${formatMoney(total.income)}</div><div class="stat-sub">平均每条 ${formatMoney(avgIncome)}</div></div>
                    <div class="stat-card dark"><div class="stat-label">总支出</div><div class="stat-value negative">${formatMoney(total.expense)}</div><div class="stat-sub">平均每条 ${formatMoney(avgExpense)}</div></div>
                    <div class="stat-card dark"><div class="stat-label">利润率</div><div class="stat-value neutral">${profitRate.toFixed(1)}%</div><div class="stat-sub">收入转化净额占比</div></div>
                    <div class="stat-card dark"><div class="stat-label">到期状态</div><div class="stat-value neutral">${activeCount}/${expiredCount}</div><div class="stat-sub">有效 / 过期</div></div>
                </div>

                <div class="stats-insight-grid">
                    <div class="stats-panel">
                        <h3>近 12 个月趋势</h3>
                        <div class="stats-month-bars">
                            ${recentMonths.map(item => `
                                <div class="month-bar-card">
                                    <div class="month-bar-title">${escapeHtml(item.label)}</div>
                                    <div class="month-bar-stack">
                                        <div class="month-bar income" style="height:${Math.max(6, Math.abs(item.income) / maxMonthAmount * 100)}%;"></div>
                                        <div class="month-bar expense" style="height:${Math.max(6, Math.abs(item.expense) / maxMonthAmount * 100)}%;"></div>
                                        <div class="month-bar net ${item.net >= 0 ? 'positive' : 'negative'}" style="height:${Math.max(6, Math.abs(item.net) / maxMonthAmount * 100)}%;"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="stats-legend"><span class="income"></span>收入 <span class="expense"></span>支出 <span class="net"></span>净额</div>
                    </div>

                    <div class="stats-panel">
                        <h3>关键洞察</h3>
                        <div class="insight-list">
                            <div><span>最佳月份</span><strong>${bestMonth ? `${escapeHtml(bestMonth.label)} / ${formatMoney(bestMonth.net)}` : '暂无'}</strong></div>
                            <div><span>压力月份</span><strong>${worstMonth ? `${escapeHtml(worstMonth.label)} / ${formatMoney(worstMonth.net)}` : '暂无'}</strong></div>
                            <div><span>标签数量</span><strong>${state.tabs.length}</strong></div>
                            <div><span>服务商数量</span><strong>${Object.keys(providerMap).length}</strong></div>
                        </div>
                    </div>
                </div>

                <div class="stats-insight-grid">
                    <div class="stats-panel">
                        <h3>标签净额排行</h3>
                        ${renderMiniBars(tabs, maxTabNet, 'net', 'net')}
                    </div>
                    <div class="stats-panel">
                        <h3>服务商贡献排行</h3>
                        ${renderMiniBars(providers, maxProviderNet, 'net', 'net')}
                    </div>
                </div>

                <div class="stats-detail premium-table">
                    <h3>年度对比</h3>
                    <table><thead><tr><th>年份</th><th>收入</th><th>支出</th><th>净额</th><th>记录数</th></tr></thead><tbody>${yearRows}</tbody></table>
                </div>

                <div class="stats-detail premium-table">
                    <h3>月份明细</h3>
                    <table><thead><tr><th>月份</th><th>收入</th><th>支出</th><th>净额</th><th>记录数</th></tr></thead><tbody>${monthRows}</tbody></table>
                </div>
            `;
        } catch (err) {
            statsContainer.innerHTML = `<div class="stats-empty large">统计加载失败：${escapeHtml(err.message)}</div>`;
        }
    }

    // --- 密码修改 ---
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

    // --- 注册开关 ---
    async function loadRegisterSwitch() {
        try {
            const data = await API.get('/settings/allow_register');
            if (data.value !== undefined) allowRegisterCheckbox.checked = data.value !== false;
        } catch (err) {}
    }
    async function saveRegisterSwitch() {
        const value = allowRegisterCheckbox.checked;
        try {
            await API.post('/settings', { key: 'allow_register', value });
            registerSwitchStatus.textContent = '✅ 已保存';
            setTimeout(() => registerSwitchStatus.textContent = '', 3000);
        } catch (err) { registerSwitchStatus.textContent = '❌ 保存失败: ' + err.message; }
    }

    // --- 地址后缀 ---
    async function loadSuffixSettings() {
        try {
            const ipSuffix = await API.get('/settings/ip_port_suffix');
            const domainSuffix = await API.get('/settings/domain_port_suffix');
            if (ipSuffix.value !== null) { state.ipPortSuffix = ipSuffix.value; ipPortSuffixInput.value = ipSuffix.value; }
            if (domainSuffix.value !== null) { state.domainPortSuffix = domainSuffix.value; domainPortSuffixInput.value = domainSuffix.value; }
        } catch (err) { console.warn('加载后缀设置失败:', err); }
    }
    async function saveSuffixSettings() {
        const ipSuffix = ipPortSuffixInput.value.trim();
        const domainSuffix = domainPortSuffixInput.value.trim();
        try {
            await API.post('/settings', { key: 'ip_port_suffix', value: ipSuffix });
            await API.post('/settings', { key: 'domain_port_suffix', value: domainSuffix });
            state.ipPortSuffix = ipSuffix; state.domainPortSuffix = domainSuffix;
            suffixStatus.textContent = '✅ 已保存';
            setTimeout(() => suffixStatus.textContent = '', 3000);
        } catch (err) { suffixStatus.textContent = '❌ 保存失败: ' + err.message; }
    }

    // --- 服务商管理 ---
    function normalizeProviderOptions(options) {
        const result = [];
        (options || []).forEach(item => {
            const name = String(item || '').trim();
            if (name && !result.includes(name)) result.push(name);
        });
        return result;
    }

    function collectProviderOptionsFromRecords() {
        const values = state.records.map(r => r.data.provider).filter(Boolean);
        state.providerOptions = normalizeProviderOptions([...state.providerOptions, ...values]);
    }

    async function loadProviderOptions() {
        try {
            const data = await API.get('/settings/provider_options');
            state.providerOptions = normalizeProviderOptions(Array.isArray(data.value) ? data.value : []);
        } catch (err) {
            state.providerOptions = [];
        }
    }

    async function saveProviderOptions() {
        await API.post('/settings', { key: 'provider_options', value: state.providerOptions });
    }

    function renderProviderList() {
        if (!providerList) return;
        if (state.providerOptions.length === 0) {
            providerList.innerHTML = '<div class="provider-empty">暂无服务商</div>';
            return;
        }
        providerList.innerHTML = state.providerOptions.map(name => `
            <div class="provider-item">
                <span class="provider-item-name">${escapeHtml(name)}</span>
                <button type="button" class="delete-provider-btn" data-name="${escapeAttr(name)}">删除</button>
            </div>
        `).join('');
        providerList.querySelectorAll('.delete-provider-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const name = this.dataset.name;
                if (!confirm(`确定删除服务商“${name}”吗？已使用的记录不会被清空。`)) return;
                try {
                    state.providerOptions = state.providerOptions.filter(item => item !== name);
                    await saveProviderOptions();
                    renderProviderList();
                    renderTable(false);
                    providerStatus.textContent = '✅ 已删除';
                    setTimeout(() => providerStatus.textContent = '', 2000);
                } catch (err) { providerStatus.textContent = '❌ 删除失败: ' + err.message; }
            });
        });
    }

    function openProviderModal() {
        collectProviderOptionsFromRecords();
        providerNameInput.value = '';
        providerStatus.textContent = '';
        renderProviderList();
        providerModal.classList.add('show');
        setTimeout(() => providerNameInput.focus(), 0);
    }

    async function addProvider() {
        const name = providerNameInput.value.trim();
        if (!name) { providerStatus.textContent = '⚠️ 请输入服务商名称'; return; }
        if (state.providerOptions.includes(name)) { providerStatus.textContent = '⚠️ 服务商已存在'; return; }
        try {
            state.providerOptions.unshift(name);
            state.providerOptions = normalizeProviderOptions(state.providerOptions);
            await saveProviderOptions();
            providerNameInput.value = '';
            providerStatus.textContent = '✅ 已添加';
            renderProviderList();
            renderTable(false);
            setTimeout(() => providerStatus.textContent = '', 2000);
        } catch (err) { providerStatus.textContent = '❌ 添加失败: ' + err.message; }
    }

    // --- Favicon ---
    async function uploadFavicon() {
        const fileInput = document.getElementById('faviconFileInput');
        const file = fileInput.files[0];
        if (!file) { document.getElementById('faviconStatus').textContent = '⚠️ 请选择文件'; return; }
        const formData = new FormData();
        formData.append('image', file);
        try {
            const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: formData });
            const data = await res.json().catch(() => ({ error: '服务器返回格式错误，请确认上传接口正常' }));
            if (!res.ok || data.error) throw new Error(data.error || '上传失败');
            if (data.success) {
                const response = await fetch('/api/settings/favicon', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ path: data.url })
                });
                const result = await response.json().catch(() => ({ error: '服务器返回格式错误，请确认图标保存接口正常' }));
                if (!response.ok || result.error) throw new Error(result.error || '保存图标失败');
                if (result.success) {
                    document.getElementById('faviconStatus').textContent = '✅ 图标已更新，请刷新浏览器查看';
                    const link = document.querySelector("link[rel*='icon']");
                    if (link) link.href = data.url + '?v=' + Date.now();
                } else { document.getElementById('faviconStatus').textContent = '❌ 保存图标失败: ' + (result.error || ''); }
            } else { document.getElementById('faviconStatus').textContent = '❌ 上传失败: ' + (data.error || ''); }
        } catch (err) { document.getElementById('faviconStatus').textContent = '❌ 上传失败: ' + err.message; }
    }

    // --- 加载设置 ---
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
                    preview.style.backgroundImage = `url("${cssUrl(url)}")`;
                    preview.classList.add('has-bg'); preview.textContent = '';
                }
            }
            await loadRegisterSwitch();
            await loadSuffixSettings();
            await loadProviderOptions();
            collectProviderOptionsFromRecords();
            const auth = await API.get('/auth/check');
            if (auth.loggedIn && auth.user.id === 1) registerSwitchGroup.style.display = 'block';
        } catch (err) { console.warn('加载设置失败:', err); }
    }

    // --- 事件绑定 ---
    addRowBtn.addEventListener('click', addRow);
    deleteRowsBtn.addEventListener('click', deleteSelected);
    exportBtn.addEventListener('click', exportData);
    importBtn.addEventListener('click', showImportModal);
    refreshBtn.addEventListener('click', function() {
        if (state.currentTabId) {
            invalidateCurrentTabCache();
            loadDataForTab(state.currentTabId, true).then(() => renderTable(false));
        }
    });
    manageColumnsBtn.addEventListener('click', showColumnManager);
    logoutBtn.addEventListener('click', async function() {
        if (!confirm('确定退出吗？')) return;
        try { await API.post('/auth/logout'); window.location.href = '/login'; } catch (err) { setStatus('❌ 退出失败: ' + err.message); }
    });

    addressSuffixBtn.addEventListener('click', () => addressSuffixModal.classList.add('show'));
    providerManageBtn.addEventListener('click', openProviderModal);
    closeAddressSuffixModal.addEventListener('click', () => addressSuffixModal.classList.remove('show'));
    closeProviderModal.addEventListener('click', () => providerModal.classList.remove('show'));
    closeColumnModal.addEventListener('click', () => columnModal.classList.remove('show'));
    if (addColBtn) addColBtn.addEventListener('click', addColumn);
    closeImport.addEventListener('click', () => importModal.classList.remove('show'));
    confirmImport.addEventListener('click', handleImport);
    cancelImport.addEventListener('click', () => importModal.classList.remove('show'));
    changePwdBtn.addEventListener('click', changePassword);
    confirmPwdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') changePassword(); });
    addProviderBtn.addEventListener('click', addProvider);
    providerNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addProvider();
        if (e.key === 'Escape') providerModal.classList.remove('show');
    });

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
        if (!/^https?:\/\//i.test(url)) { setStatus('⚠️ 图片地址必须以 http:// 或 https:// 开头'); return; }
        try {
            await API.post('/settings', { key: 'background', value: { type: 'url', url } });
            const preview = document.getElementById('bgPreview');
            preview.style.backgroundImage = `url("${cssUrl(url)}")`; preview.classList.add('has-bg'); preview.textContent = '';
            setStatus('✅ 背景已更新');
        } catch (err) { setStatus('❌ 设置失败: ' + err.message); }
    });
    document.getElementById('uploadBgBtn').addEventListener('click', () => document.getElementById('bgFileInput').click());
    document.getElementById('bgFileInput').addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) return;
        try {
            setStatus('🔄 上传中...');
            const formData = new FormData();
            formData.append('image', file);
            const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: formData });
            const data = await res.json().catch(() => ({ error: '服务器返回格式错误，请确认上传接口正常' }));
            if (!res.ok || data.error) throw new Error(data.error || '上传失败');
            if (data.success) {
                await API.post('/settings', { key: 'background', value: { type: 'local', path: data.url } });
                const preview = document.getElementById('bgPreview');
                preview.style.backgroundImage = `url("${cssUrl(data.url)}")`; preview.classList.add('has-bg'); preview.textContent = '';
                setStatus('✅ 背景已应用');
            } else { setStatus('❌ 上传失败: ' + (data.error || '')); }
        } catch (err) { setStatus('❌ 上传失败: ' + err.message); }
    });
    document.getElementById('removeBgBtn').addEventListener('click', async function() {
        if (!confirm('确定移除背景吗？')) return;
        try {
            await API.delete('/settings/background');
            const preview = document.getElementById('bgPreview');
            preview.style.backgroundImage = ''; preview.classList.remove('has-bg'); preview.textContent = '暂无背景';
            setStatus('✅ 背景已移除');
        } catch (err) { setStatus('❌ 移除失败: ' + err.message); }
    });

    document.getElementById('uploadFaviconBtn').addEventListener('click', uploadFavicon);
    document.getElementById('faviconFileInput').addEventListener('change', () => document.getElementById('faviconStatus').textContent = '');
    saveRegisterSwitchBtn.addEventListener('click', saveRegisterSwitch);
    saveSuffixBtn.addEventListener('click', saveSuffixSettings);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'n') { e.preventDefault(); addRow(); }
        if (e.key === 'Delete' && !e.target.closest('input') && !e.target.closest('select')) deleteSelected();
    });

    // --- 初始化 ---
    async function init() {
        try {
            const auth = await API.get('/auth/check');
            if (!auth.loggedIn) { window.location.href = '/login'; return; }
            usernameDisplay.textContent = auth.user.username;
            state.userName = auth.user.username;
            state.isAdmin = (auth.user.id === 1);
            await loadProviderOptions();
            await loadTabs();
            if (state.tabs.length === 0) await createDefaultTab();
            else {
                state.currentTabId = state.tabs[0].id;
                await loadDataForTab(state.currentTabId);
            }
            collectProviderOptionsFromRecords();
            renderTabs();
            renderTable(true);
            setStatus('✅ 加载完成');
            const tab = state.tabs.find(t => t.id === state.currentTabId);
            if (tab) document.getElementById('columnModalTabName').textContent = tab.name;
            loadSettings();
        } catch (err) { console.error('初始化失败:', err); setStatus('❌ 初始化失败: ' + err.message); }
    }
    init();
});
