(function () {
  'use strict';

  const guide = window.H3C_TENDER_GUIDE || window.S12500G_AF_GUIDE;
  const refs = {
    guideTitleTop: document.getElementById('guideTitleTop'),
    guideSubtitle: document.getElementById('guideSubtitle'),
    applicableModelsMain: document.getElementById('applicableModelsMain'),
    applicableModelsSub: document.getElementById('applicableModelsSub'),
    totalRows: document.getElementById('totalRows'),
    guideVersion: document.getElementById('guideVersion'),
    extendedFieldCount: document.getElementById('extendedFieldCount'),
    searchInput: document.getElementById('searchInput'),
    typeFilter: document.getElementById('typeFilter'),
    categoryFilter: document.getElementById('categoryFilter'),
    competitorToggle: document.getElementById('competitorToggle'),
    comparisonHint: document.getElementById('comparisonHint'),
    resultCount: document.getElementById('resultCount'),
    guideHead: document.getElementById('guideHead'),
    guideBody: document.getElementById('guideBody'),
    guideTable: document.getElementById('guideTable'),
    emptyState: document.getElementById('emptyState'),
    sourceNote: document.getElementById('sourceNote'),
    printButton: document.getElementById('printButton'),
    selectedCount: document.getElementById('selectedCount'),
    selectionHint: document.querySelector('.selection-status small'),
    clearSelection: document.getElementById('clearSelection'),
    generatePreview: document.getElementById('generatePreview'),
    previewPanel: document.getElementById('previewPanel'),
    previewSummary: document.getElementById('previewSummary'),
    previewStats: document.getElementById('previewStats'),
    previewList: document.getElementById('previewList'),
    finalText: document.getElementById('finalText'),
    backToSelection: document.getElementById('backToSelection'),
    copyText: document.getElementById('copyText'),
  };

  if (!guide || !Array.isArray(guide.rows)) {
    refs.resultCount.textContent = '招标引导数据加载失败';
    refs.emptyState.classList.remove('hidden');
    return;
  }

  const baseColumnCount = Number(guide.baseColumnCount) || 5;
  const columnClasses = ['number-column', 'category-column', 'type-column', 'detail-column', 'note-column'];
  const isPlaceholder = value => /^(?:11|12)$/.test(String(value ?? '').trim());
  const visibleComparisonIndexes = guide.headers.map((header, index) => ({ header, index }))
    .filter(({ header, index }) => index >= baseColumnCount
      && String(header ?? '').trim()
      && guide.rows.some(row => String(row[index] ?? '').trim() && !isPlaceholder(row[index])))
    .map(item => item.index);
  const selectedRows = new Set();
  const selectedOrder = [];
  let showComparison = false;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function uniqueValues(index) {
    return [...new Set(guide.rows.map(row => String(row[index] ?? '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
  }

  function populateSelect(select, values) {
    select.insertAdjacentHTML('beforeend', values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join(''));
  }

  function filteredRows() {
    const keyword = normalize(refs.searchInput.value);
    const type = refs.typeFilter.value;
    const category = refs.categoryFilter.value;
    return guide.rows.map((row, index) => ({ row, index })).filter(item => {
      const row = item.row;
      if (type && String(row[2] ?? '').trim() !== type) return false;
      if (category && String(row[1] ?? '').trim() !== category) return false;
      if (!keyword) return true;
      return row.some(value => normalize(value).includes(keyword));
    });
  }

  function selectedItems() {
    return selectedOrder.filter(index => selectedRows.has(index)).map(index => ({ row: guide.rows[index], index }));
  }

  function setRowSelected(index, selected) {
    if (selected) {
      if (!selectedRows.has(index)) {
        selectedRows.add(index);
        selectedOrder.push(index);
      }
      return;
    }
    selectedRows.delete(index);
    const position = selectedOrder.indexOf(index);
    if (position >= 0) selectedOrder.splice(position, 1);
  }

  function reorderSelected(position, target) {
    if (position < 0 || target < 0 || position >= selectedOrder.length || target >= selectedOrder.length || position === target) return;
    const [moved] = selectedOrder.splice(position, 1);
    selectedOrder.splice(target, 0, moved);
    renderPreview();
  }

  function moveSelected(position, offset) {
    reorderSelected(position, position + offset);
  }

  function clearDragState() {
    refs.previewList.querySelectorAll('.preview-item').forEach(item => item.classList.remove('is-dragging', 'is-drag-over'));
  }

  function wirePreviewReorder() {
    refs.previewList.querySelectorAll('.preview-drag-handle').forEach(handle => {
      const beginDrag = position => {
        handle.closest('.preview-item')?.classList.add('is-dragging');
        document.body.classList.add('is-reordering');
        return position;
      };
      const highlightTarget = (clientX, clientY) => {
        refs.previewList.querySelectorAll('.preview-item.is-drag-over').forEach(active => active.classList.remove('is-drag-over'));
        document.elementFromPoint(clientX, clientY)?.closest('.preview-item')?.classList.add('is-drag-over');
      };
      const finishDrag = (source, clientX, clientY) => {
        const targetItem = document.elementFromPoint(clientX, clientY)?.closest('.preview-item');
        const target = targetItem ? Number(targetItem.dataset.position) : -1;
        clearDragState();
        document.body.classList.remove('is-reordering');
        reorderSelected(source, target);
      };

      handle.addEventListener('mousedown', event => {
        event.preventDefault();
        const source = beginDrag(Number(event.currentTarget.dataset.position));
        const onMove = moveEvent => highlightTarget(moveEvent.clientX, moveEvent.clientY);
        const onUp = upEvent => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          finishDrag(source, upEvent.clientX, upEvent.clientY);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });

      handle.addEventListener('touchstart', event => {
        const touch = event.touches[0];
        if (!touch) return;
        event.preventDefault();
        const source = beginDrag(Number(event.currentTarget.dataset.position));
        const onMove = moveEvent => {
          const activeTouch = moveEvent.touches[0];
          if (!activeTouch) return;
          moveEvent.preventDefault();
          highlightTarget(activeTouch.clientX, activeTouch.clientY);
        };
        const onEnd = endEvent => {
          const lastTouch = endEvent.changedTouches[0];
          window.removeEventListener('touchmove', onMove);
          window.removeEventListener('touchend', onEnd);
          window.removeEventListener('touchcancel', onCancel);
          if (lastTouch) finishDrag(source, lastTouch.clientX, lastTouch.clientY);
          else {
            clearDragState();
            document.body.classList.remove('is-reordering');
          }
        };
        const onCancel = () => {
          window.removeEventListener('touchmove', onMove);
          window.removeEventListener('touchend', onEnd);
          window.removeEventListener('touchcancel', onCancel);
          clearDragState();
          document.body.classList.remove('is-reordering');
        };
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
        window.addEventListener('touchcancel', onCancel);
      });
    });
  }

  function renderHead() {
    const baseHeaders = guide.headers.slice(0, baseColumnCount)
      .map((header, index) => `<th scope="col" class="${columnClasses[index]}">${escapeHtml(header)}</th>`).join('');
    const comparisonHeaders = showComparison
      ? visibleComparisonIndexes.map(index => {
          const vendor = guide.headers[index];
          const rawModel = guide.comparisonModels[index];
          const model = rawModel && !/^\d+$/.test(String(rawModel).trim()) ? rawModel : '';
          return `<th scope="col" class="comparison-header"><span class="comparison-vendor">${escapeHtml(vendor)}</span>${model ? `<span class="comparison-model">${escapeHtml(model)}</span>` : ''}</th>`;
        }).join('')
      : '';
    refs.guideHead.innerHTML = `<tr><th scope="col" class="select-column"><input id="selectVisible" type="checkbox" aria-label="选择当前筛选结果中的全部参数"></th>${baseHeaders}${comparisonHeaders}</tr>`;
    const tableWidth = 1080 + (showComparison ? visibleComparisonIndexes.length * 280 : 0);
    refs.guideTable.style.width = `${tableWidth}px`;
    refs.guideTable.style.minWidth = `${tableWidth}px`;
    refs.guideTable.classList.toggle('comparison-expanded', showComparison);
  }

  function comparisonClass(value) {
    const text = normalize(value);
    if (text.startsWith('不满足')) return ' is-fail';
    if (text.startsWith('满足')) return ' is-pass';
    return '';
  }

  function updateSelectionControls(items = filteredRows()) {
    const count = selectedRows.size;
    const visibleSelected = items.filter(item => selectedRows.has(item.index)).length;
    const retainedSelected = Math.max(0, count - visibleSelected);
    refs.selectedCount.textContent = count;
    refs.clearSelection.disabled = count === 0;
    refs.generatePreview.disabled = count === 0;
    if (count === 0) refs.selectionHint.textContent = '可按“指标分类”筛选，并跨分类继续勾选';
    else if (retainedSelected > 0) refs.selectionHint.textContent = `当前筛选中已选 ${visibleSelected} 条；其他分类已保留 ${retainedSelected} 条`;
    else refs.selectionHint.textContent = `当前筛选中已选 ${visibleSelected} 条；切换分类后仍会保留`;
  }

  function wireTableEvents(items) {
    refs.guideBody.querySelectorAll('.row-selector').forEach(input => {
      input.addEventListener('change', event => {
        const index = Number(event.currentTarget.dataset.index);
        setRowSelected(index, event.currentTarget.checked);
        renderBody();
        if (!refs.previewPanel.classList.contains('hidden')) renderPreview();
      });
    });

    const selectVisible = document.getElementById('selectVisible');
    if (!selectVisible) return;
    const visibleIndexes = items.map(item => item.index);
    const selectedVisible = visibleIndexes.filter(index => selectedRows.has(index)).length;
    selectVisible.checked = visibleIndexes.length > 0 && selectedVisible === visibleIndexes.length;
    selectVisible.indeterminate = selectedVisible > 0 && selectedVisible < visibleIndexes.length;
    selectVisible.disabled = visibleIndexes.length === 0;
    selectVisible.addEventListener('change', event => {
      visibleIndexes.forEach(index => setRowSelected(index, event.currentTarget.checked));
      renderBody();
      if (!refs.previewPanel.classList.contains('hidden')) renderPreview();
    });
  }

  function renderBody() {
    const items = filteredRows();
    refs.resultCount.textContent = `显示 ${items.length} / ${guide.rows.length} 条参数`;
    refs.emptyState.classList.toggle('hidden', items.length > 0);
    refs.guideTable.classList.toggle('hidden', items.length === 0);
    refs.guideBody.innerHTML = items.map(({ row, index }) => {
      const selected = selectedRows.has(index);
      const baseCells = row.slice(0, baseColumnCount).map((value, columnIndex) => {
        const displayValue = isPlaceholder(value) ? '' : value;
        if (columnIndex === 2) return `<td class="${columnClasses[columnIndex]}">${displayValue ? `<span class="type-chip">${escapeHtml(displayValue)}</span>` : '<span class="cell-empty">—</span>'}</td>`;
        return `<td class="${columnClasses[columnIndex]}">${displayValue ? escapeHtml(displayValue) : '<span class="cell-empty">—</span>'}</td>`;
      }).join('');
      const comparisonCells = showComparison
        ? visibleComparisonIndexes.map(index => {
            const value = isPlaceholder(row[index]) ? '' : row[index];
            return `<td class="comparison-cell${comparisonClass(value)}${value ? '' : ' is-empty'}">${value ? escapeHtml(value) : '—'}</td>`;
          }).join('')
        : '';
      return `<tr class="${selected ? 'is-selected' : ''}"><td class="select-column"><input class="row-selector" data-index="${index}" type="checkbox" ${selected ? 'checked' : ''} aria-label="选择参数 ${escapeHtml(row[0])}"></td>${baseCells}${comparisonCells}</tr>`;
    }).join('');
    wireTableEvents(items);
    updateSelectionControls(items);
  }

  function buildFinalText(items) {
    const lines = [guide.title.replace('招标引导', '招标参数'), `适用型号：${guide.applicableModels.join('、')}`, ''];
    items.forEach(({ row }, index) => {
      const detail = String(row[3] ?? '').trim();
      lines.push(`${index + 1}. ${detail}`);
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  function renderPreview() {
    const items = selectedItems();
    if (!items.length) {
      refs.previewPanel.classList.add('hidden');
      return;
    }
    const typeCounts = items.reduce((acc, { row }) => {
      const type = String(row[2] ?? '').trim() || '未分类';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    refs.previewSummary.textContent = `已选择 ${items.length} 条参数，可拖动排序，也可使用上移、下移微调。`;
    refs.previewStats.innerHTML = `<span class="preview-stat">合计 ${items.length} 条</span>${Object.entries(typeCounts).map(([type, count]) => `<span class="preview-stat">${escapeHtml(type)} ${count} 条</span>`).join('')}`;
    refs.previewList.innerHTML = items.map(({ row }, index) => `<article class="preview-item" data-position="${index}"><div class="preview-item-head"><span class="preview-index">${index + 1}</span><span class="preview-category">${escapeHtml(row[1] || '未分类')}</span><span class="preview-type">${escapeHtml(row[2] || '未分类')}</span><span class="preview-drag-handle" data-position="${index}" title="按住并拖动调整顺序" aria-label="拖动第${index + 1}条参数排序">⋮⋮ 拖动排序</span><span class="preview-reorder"><button type="button" class="reorder-button" data-position="${index}" data-offset="-1" ${index === 0 ? 'disabled' : ''} aria-label="将第${index + 1}条参数上移">↑ 上移</button><button type="button" class="reorder-button" data-position="${index}" data-offset="1" ${index === items.length - 1 ? 'disabled' : ''} aria-label="将第${index + 1}条参数下移">↓ 下移</button></span></div><div class="preview-parameter">${escapeHtml(row[3])}</div>${row[4] && !isPlaceholder(row[4]) ? `<div class="preview-note"><strong>我司参数说明：</strong>${escapeHtml(row[4])}</div>` : ''}</article>`).join('');
    wirePreviewReorder();
    refs.previewList.querySelectorAll('.reorder-button').forEach(button => {
      button.addEventListener('click', event => {
        const position = Number(event.currentTarget.dataset.position);
        const offset = Number(event.currentTarget.dataset.offset);
        moveSelected(position, offset);
      });
    });
    refs.finalText.value = buildFinalText(items);
    refs.previewPanel.classList.remove('hidden');
  }

  function render() {
    renderHead();
    renderBody();
  }

  async function copyFinalText() {
    const text = refs.finalText.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      refs.finalText.focus();
      refs.finalText.select();
      document.execCommand('copy');
      window.getSelection()?.removeAllRanges();
    }
    const original = refs.copyText.textContent;
    refs.copyText.textContent = '已复制';
    window.setTimeout(() => { refs.copyText.textContent = original; }, 1600);
  }

  document.title = guide.title;
  refs.guideTitleTop.textContent = guide.title;
  refs.guideSubtitle.textContent = guide.description || '汇总我司招标参数、选型说明及竞品与补充资料。';
  refs.applicableModelsMain.textContent = guide.applicableModels[0] || '—';
  refs.applicableModelsSub.textContent = guide.applicableModels.slice(1).join(' · ') || '单一适用型号';
  refs.totalRows.textContent = guide.rows.length;
  refs.guideVersion.textContent = guide.version;
  refs.extendedFieldCount.textContent = visibleComparisonIndexes.length;
  refs.sourceNote.textContent = `数据来源：${guide.source}；页面内容与该版本Excel保持一致。`;
  populateSelect(refs.typeFilter, uniqueValues(2));
  populateSelect(refs.categoryFilter, uniqueValues(1));

  refs.searchInput.addEventListener('input', renderBody);
  refs.typeFilter.addEventListener('change', renderBody);
  refs.categoryFilter.addEventListener('change', renderBody);
  refs.competitorToggle.addEventListener('click', () => {
    showComparison = !showComparison;
    refs.competitorToggle.setAttribute('aria-pressed', String(showComparison));
    refs.competitorToggle.textContent = showComparison ? '收起竞品及补充资料' : '展开竞品及补充资料';
    refs.comparisonHint.textContent = showComparison ? `已展开 ${visibleComparisonIndexes.length} 列有效竞品及补充资料，可横向滚动查看` : '当前仅显示我司招标参数';
    render();
    document.querySelector('.table-wrap').scrollLeft = 0;
  });
  refs.clearSelection.addEventListener('click', () => {
    selectedRows.clear();
    selectedOrder.length = 0;
    refs.previewPanel.classList.add('hidden');
    renderBody();
  });
  refs.generatePreview.addEventListener('click', () => {
    renderPreview();
    refs.previewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  refs.backToSelection.addEventListener('click', () => document.querySelector('.selection-toolbar').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  refs.copyText.addEventListener('click', copyFinalText);
  refs.printButton.addEventListener('click', () => window.print());

  render();
})();
