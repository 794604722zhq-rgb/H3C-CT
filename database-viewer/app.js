(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const key = params.get('db') || 'switch';
  const databases = window.ZHQ_DATABASES || {};
  const database = databases[key] || databases.switch;
  const config = window.ZHQ_DATABASE_VIEWER_CONFIG || { homeUrl: '../', downloadBase: '../' };
  const refs = {
    pageTitle: document.getElementById('pageTitle'), homeLink: document.getElementById('homeLink'),
    downloadLink: document.getElementById('downloadLink'), sheetSelect: document.getElementById('sheetSelect'),
    searchInput: document.getElementById('searchInput'), rowCount: document.getElementById('rowCount'),
    sheetNotes: document.getElementById('sheetNotes'), tableHead: document.getElementById('tableHead'),
    tableBody: document.getElementById('tableBody'), emptyState: document.getElementById('emptyState'),
    showMoreButton: document.getElementById('showMoreButton'),
  };
  const state = { sheetIndex: '__all__', visible: 100, filteredRows: [] };
  const guideByModel = {
    'S12504G-AF': 's12500g-af', 'S12508G-AF': 's12500g-af', 'S12516G-AF': 's12500g-af',
    'S6800-2C': 's6800', 'S6800-32Q': 's6800', 'S6800-4C': 's6800', 'S6800-54HF': 's6800', 'S6800-54HT': 's6800', 'S6800-54QF': 's6800', 'S6800-54QT': 's6800',
    'S6805-54HF': 's6805', 'S6805-54HT': 's6805', 'S6825-54HF': 's6825',
    'S6850-2C': 's6850', 'S6850-56HF': 's6850', 'S6850-56HF-H1': 's6850', 'S6850-56HF-H3': 's6850', 'S6850-56HF-CP': 's6850', 'S6850-56HF-IM': 's6850',
    'S6805-56HF-G': 's6850-g', 'S6805-56HT-G': 's6850-g', 'S6850-56HF-G': 's6850-g',
    'S7503X-G': 's7500x-g', 'S7503X-M-G': 's7500x-g', 'S7506X-G': 's7500x-g', 'S7506X-G-MF': 's7500x-g', 'S7510X-G': 's7500x-g',
    'S6880-48X8C': 's6880', 'S6880-48Y8C': 's6880',
    'S9820-64H': 's9820-64h', 'S9820-8C': 's9820-8c', 'S9820-8M': 's9820-8m', 'S9820-8C-G': 's9820-8c-g',
    'S9827-128DH': 's9827-128dh', 'S9827-128DH-H1': 's9827-128dh', 'S9827-64E': 's9827-64e', 'S9827-64EP': 's9827-64ep',
    'S9850-32H': 's9850', 'S9850-4C': 's9850', 'S9850-32H-G': 's9850-g',
    'S9855-24B8D': 's9855-24b8d', 'S9855-32D': 's9855-32d', 'S9855-40B': 's9855-40b', 'S9855-48CD8D': 's9855-48cd8d',
    'S9855-24B16DH-G': 's9855-g', 'S9855-32DH-G': 's9855-g',
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function guideInfo(value) {
    const candidates = String(value ?? '').toUpperCase().match(/S\d[\w-]*/g) || [];
    const model = candidates.find(candidate => guideByModel[candidate]);
    return model ? { model, slug: guideByModel[model] } : null;
  }

  function renderValue(value, header = '') {
    const text = String(value ?? '');
    if (/^https?:\/\//i.test(text)) return `<a class="source-link" href="${escapeHtml(text)}" target="_blank" rel="noopener">查看来源</a>`;
    const guide = /型号/.test(header) ? guideInfo(text) : null;
    return `${escapeHtml(text)}${guide ? `<a class="guide-link" href="../guides/${guide.slug}/index.html">招标引导</a>` : ''}`;
  }

  function headerIndex(headers, patterns) {
    return headers.findIndex(header => patterns.some(pattern => pattern.test(String(header || ''))));
  }

  function valueByHeader(sheet, row, patterns) {
    const index = headerIndex(sheet.headers, patterns);
    return index >= 0 ? row[index] : '';
  }

  function currentSheet() { return database.sheets[Number(state.sheetIndex)]; }

  function allSheetRows(query) {
    const output = [];
    for (const sheet of database.sheets) {
      for (const row of sheet.rows) {
        if (query && !row.some(value => String(value ?? '').toLowerCase().includes(query))) continue;
        const model = valueByHeader(sheet, row, [/^具体型号$/, /^产品型号$/, /^机箱型号$/, /^源表型号$/, /^适用型号$/]);
        const series = valueByHeader(sheet, row, [/^产品系列$/, /^来源页$/, /^产品小类$/, /^AP形态/]);
        const category = valueByHeader(sheet, row, [/^产品大类$/, /^分类$/, /^设备类型$/, /^目录统计$/]);
        const url = valueByHeader(sheet, row, [/官网.*链接/, /^官网链接$/, /^来源链接$/]);
        const excluded = new Set([model, series, category, url].map(value => String(value ?? '')));
        const summary = sheet.headers.map((header, index) => ({ header, value: row[index] }))
          .filter(item => item.value !== '' && item.value !== null && item.value !== undefined && !excluded.has(String(item.value)))
          .slice(0, 6).map(item => `${item.header || '参数'}：${item.value}`).join('；');
        output.push([sheet.name, model, series, category, summary, url]);
      }
    }
    return output;
  }

  function renderSheet() {
    const query = refs.searchInput.value.trim().toLowerCase();
    let headers;
    let notes;
    if (state.sheetIndex === '__all__') {
      headers = ['来源工作表', '产品型号', '产品系列/形态', '产品分类', '参数摘要', '官网来源'];
      state.filteredRows = allSheetRows(query);
      notes = [`正在跨 ${database.sheets.length} 个工作表筛选；结果中的“招标引导”按钮仅对已有引导的型号显示。`];
    } else {
      const sheet = currentSheet();
      state.filteredRows = sheet.rows.filter(row => !query || row.some(value => String(value ?? '').toLowerCase().includes(query)));
      const columnCount = Math.max(sheet.columns || 0, ...sheet.rows.map(row => row.length), 1);
      headers = Array.from({ length: columnCount }, (_, index) => sheet.headers[index] || `列 ${index + 1}`);
      notes = sheet.notes;
    }
    refs.tableHead.innerHTML = `<tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr>`;
    refs.tableBody.innerHTML = state.filteredRows.slice(0, state.visible).map(row => `<tr>${headers.map((header, index) => `<td>${renderValue(row[index], header)}</td>`).join('')}</tr>`).join('');
    refs.rowCount.textContent = `${state.filteredRows.length.toLocaleString()} 条数据 · ${headers.length} 列`;
    refs.emptyState.classList.toggle('hidden', state.filteredRows.length > 0);
    refs.showMoreButton.classList.toggle('hidden', state.visible >= state.filteredRows.length);
    refs.sheetNotes.innerHTML = notes.map(note => `<p>${escapeHtml(note)}</p>`).join('');
    refs.sheetNotes.classList.toggle('hidden', !notes.length);
  }

  if (!database || !Array.isArray(database.sheets)) {
    refs.pageTitle.textContent = '产品数据库加载失败';
    return;
  }

  document.title = database.title;
  refs.pageTitle.textContent = database.title;
  refs.homeLink.href = config.homeUrl;
  refs.downloadLink.href = `${config.downloadBase}${database.file}`;
  refs.sheetSelect.innerHTML = `<option value="__all__">全部工作表（全库筛选）</option>${database.sheets.map((sheet, index) => `<option value="${index}">${escapeHtml(sheet.name)}</option>`).join('')}`;
  refs.sheetSelect.addEventListener('change', () => { state.sheetIndex = refs.sheetSelect.value; state.visible = 100; refs.searchInput.value = ''; renderSheet(); });
  refs.searchInput.addEventListener('input', () => { state.visible = 100; renderSheet(); });
  refs.showMoreButton.addEventListener('click', () => { state.visible += 100; renderSheet(); });
  renderSheet();
})();
