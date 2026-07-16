'use strict';

// ============================================================
// Toolforge Dashboard v2 — Execution History tab logic
// Phase 2b Step 1 (docs/meta/specs/toolforge-phase-2b-step1-design.md §3/§4/§5)
// ============================================================

(function () {
  const API_BASE = `${window.location.origin}/api/toolforge`;
  const FILTERS_KEY = 'tf.filters';
  const DEBOUNCE_MS = 300;
  const AUTOPOLL_MS = 30000;

  // ---- State ----
  // offset/limit are in-memory only (reset on reload); filters mirror to localStorage.
  let state = {
    offset: 0,
    limit: 25,
    tool: '',
    status: '',
    from: '',
    to: ''
  };

  let autopollTimer = null;
  let toolDebounceTimer = null;

  // ============================================================
  // Tabs — ARIA tablist pattern, keyboard navigable
  // ============================================================
  function initTabs() {
    const tabButtons = Array.from(document.querySelectorAll('[role="tab"]'));

    function activateTab(button) {
      tabButtons.forEach((btn) => {
        const isActive = btn === button;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
        const panel = document.getElementById(btn.getAttribute('aria-controls'));
        if (panel) {
          if (isActive) {
            panel.hidden = false;
            panel.classList.add('active');
          } else {
            panel.hidden = true;
            panel.classList.remove('active');
          }
        }
      });

      // Auto-poll only runs while the History tab is active.
      if (button.dataset.tab !== 'history') {
        stopAutopoll();
      } else if (document.getElementById('autopoll-toggle').checked) {
        startAutopoll();
      }

      // Lazy-load the Errors tab on activation (Step 2).
      if (button.dataset.tab === 'errors') { loadErrors(); }
      // Lazy-load the Badges tab on activation (Step 4).
      if (button.dataset.tab === 'badges') { loadBadges(); }
    }

    tabButtons.forEach((btn, idx) => {
      btn.addEventListener('click', () => activateTab(btn));
      btn.addEventListener('keydown', (e) => {
        let targetIdx = null;
        if (e.key === 'ArrowRight') targetIdx = (idx + 1) % tabButtons.length;
        else if (e.key === 'ArrowLeft') targetIdx = (idx - 1 + tabButtons.length) % tabButtons.length;
        else if (e.key === 'Home') targetIdx = 0;
        else if (e.key === 'End') targetIdx = tabButtons.length - 1;

        if (targetIdx !== null) {
          e.preventDefault();
          tabButtons[targetIdx].focus();
          activateTab(tabButtons[targetIdx]);
        }
      });
    });
  }

  // ============================================================
  // Filter persistence
  // ============================================================
  function loadFiltersFromStorage() {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      state.tool = saved.tool || '';
      state.status = saved.status || '';
      state.from = saved.from || '';
      state.to = saved.to || '';
      state.limit = saved.pageSize || 25;
    } catch (e) {
      // Corrupt localStorage entry — ignore, fall back to defaults.
      console.warn('[dashboard-v2] failed to parse saved filters', e);
    }
  }

  function saveFiltersToStorage() {
    localStorage.setItem(FILTERS_KEY, JSON.stringify({
      tool: state.tool,
      status: state.status,
      from: state.from,
      to: state.to,
      pageSize: state.limit
    }));
  }

  function applyFiltersToForm() {
    document.getElementById('filter-tool').value = state.tool;
    document.getElementById('filter-from').value = state.from;
    document.getElementById('filter-to').value = state.to;
    document.getElementById('page-size').value = String(state.limit);
    const radios = document.querySelectorAll('input[name="status"]');
    radios.forEach((r) => { r.checked = r.value === state.status; });
  }

  // ============================================================
  // Fetch + render
  // ============================================================
  function buildQuery() {
    const params = new URLSearchParams();
    params.set('limit', state.limit);
    params.set('offset', state.offset);
    if (state.tool) params.set('tool', state.tool);
    if (state.status) params.set('status', state.status);
    if (state.from) params.set('from', state.from);
    if (state.to) params.set('to', state.to);
    return params.toString();
  }

  async function loadRuns() {
    const statusEl = document.getElementById('runs-status');
    statusEl.textContent = 'Loading…';

    try {
      const res = await fetch(`${API_BASE}/runs?${buildQuery()}`);
      const data = await res.json();

      if (!res.ok) {
        const msg = (data && data.error && data.error.message) || `Request failed (${res.status})`;
        statusEl.textContent = `Error: ${msg}`;
        return;
      }

      renderRunsTable(data.runs);
      renderStats(data.stats, data.pagination);
      renderPagination(data.pagination);

      statusEl.textContent = data.runs.length === 0 ? 'No runs found.' : '';
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
    }
  }

  function renderRunsTable(runs) {
    const tbody = document.getElementById('runs-tbody');
    tbody.innerHTML = '';

    runs.forEach((run) => {
      const tr = document.createElement('tr');
      tr.className = run.status === 'fail' ? 'run-fail' : 'run-success';

      const tdTimestamp = document.createElement('td');
      tdTimestamp.textContent = formatTimestamp(run.timestamp);
      tr.appendChild(tdTimestamp);

      const tdTool = document.createElement('td');
      tdTool.textContent = run.tool; // textContent, never innerHTML — untrusted field
      tr.appendChild(tdTool);

      const tdDuration = document.createElement('td');
      tdDuration.textContent = run.duration_ms != null ? `${run.duration_ms} ms` : '—';
      tr.appendChild(tdDuration);

      const tdStatus = document.createElement('td');
      tdStatus.className = run.status === 'fail' ? 'status-fail' : 'status-success';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.textContent = '●';
      tdStatus.appendChild(dot);
      tdStatus.appendChild(document.createTextNode(` ${run.status.toUpperCase()}`));
      tr.appendChild(tdStatus);

      const tdVersion = document.createElement('td');
      tdVersion.textContent = run.version || '—'; // textContent — untrusted field
      tr.appendChild(tdVersion);

      const tdActions = document.createElement('td');
      const btn = document.createElement('button');
      btn.className = 'link-btn';
      btn.dataset.id = run.invocation_id;
      btn.textContent = 'Details →';
      btn.addEventListener('click', () => showRunDetails(run.invocation_id));
      tdActions.appendChild(btn);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  function showRunDetails(invocationId) {
    // Step 1: minimal inline disclosure via alert-free status line (no modal in scope).
    fetch(`${API_BASE}/runs/${encodeURIComponent(invocationId)}`)
      .then((res) => res.json())
      .then((run) => {
        const statusEl = document.getElementById('runs-status');
        if (run && run.invocation_id) {
          statusEl.textContent = `Run ${run.invocation_id}: ${run.status.toUpperCase()} — ${run.error_message || 'no error'}`;
        } else {
          statusEl.textContent = 'Run not found.';
        }
      })
      .catch((err) => {
        document.getElementById('runs-status').textContent = `Error: ${err.message}`;
      });
  }

  function formatTimestamp(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch (e) {
      return iso;
    }
  }

  function renderStats(stats, pagination) {
    document.getElementById('stat-total').textContent = pagination.total;
    document.getElementById('stat-success-rate').textContent = `${stats.success_rate_pct}%`;
    const avgEl = document.getElementById('stat-avg-duration');
    avgEl.textContent = stats.avg_duration_ms ? `${Math.round(stats.avg_duration_ms)}ms` : '—';

    const windowEl = document.getElementById('stat-window');
    if (state.from || state.to) {
      windowEl.textContent = `${state.from || '…'} → ${state.to || '…'}`;
    } else {
      windowEl.textContent = 'ALL TIME';
    }
  }

  function renderPagination(pagination) {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    prevBtn.disabled = !pagination.hasPrev;
    nextBtn.disabled = !pagination.hasNext;

    const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
    const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
    pageInfo.textContent = `Page ${currentPage} of ${totalPages} — ${pagination.total} runs`;
  }

  // ============================================================
  // Auto-poll
  // ============================================================
  function startAutopoll() {
    stopAutopoll();
    autopollTimer = setInterval(loadRuns, AUTOPOLL_MS);
  }

  function stopAutopoll() {
    if (autopollTimer) {
      clearInterval(autopollTimer);
      autopollTimer = null;
    }
  }

  // ============================================================
  // Event wiring
  // ============================================================
  function initHistoryControls() {
    document.getElementById('refresh-btn').addEventListener('click', loadRuns);

    document.getElementById('autopoll-toggle').addEventListener('change', (e) => {
      if (e.target.checked) startAutopoll();
      else stopAutopoll();
    });

    const toolInput = document.getElementById('filter-tool');
    toolInput.addEventListener('input', () => {
      clearTimeout(toolDebounceTimer);
      toolDebounceTimer = setTimeout(() => {
        state.tool = toolInput.value.trim();
        state.offset = 0;
        saveFiltersToStorage();
        loadRuns();
      }, DEBOUNCE_MS);
    });

    document.querySelectorAll('input[name="status"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        state.status = radio.value;
        state.offset = 0;
        saveFiltersToStorage();
        loadRuns();
      });
    });

    document.getElementById('filter-from').addEventListener('change', (e) => {
      state.from = e.target.value;
      state.offset = 0;
      saveFiltersToStorage();
      loadRuns();
    });

    document.getElementById('filter-to').addEventListener('change', (e) => {
      state.to = e.target.value;
      state.offset = 0;
      saveFiltersToStorage();
      loadRuns();
    });

    document.getElementById('history-filters').addEventListener('submit', (e) => {
      e.preventDefault();
      state.offset = 0;
      loadRuns();
    });

    document.getElementById('page-size').addEventListener('change', (e) => {
      state.limit = parseInt(e.target.value, 10);
      state.offset = 0;
      saveFiltersToStorage();
      loadRuns();
    });

    document.getElementById('prev-page').addEventListener('click', () => {
      state.offset = Math.max(0, state.offset - state.limit);
      loadRuns();
    });

    document.getElementById('next-page').addEventListener('click', () => {
      state.offset = state.offset + state.limit;
      loadRuns();
    });
  }

  // ============================================================
  // Errors tab (Step 2)
  // ============================================================
  const ERR_ACCENTS = ['E_RUNTIME', 'E_TIMEOUT', 'E_DEPENDENCY', 'E_ENVIRONMENT', 'E_VALIDATION'];

  let errState = { offset: 0, limit: 50, tool: '', errorCode: '', window: '24h' };
  let errRowsById = Object.create(null); // error_id -> row (for stack-trace detail)

  function buildErrorQuery() {
    const params = new URLSearchParams();
    params.set('limit', errState.limit);
    params.set('offset', errState.offset);
    params.set('window', errState.window);
    if (errState.tool) params.set('tool', errState.tool);
    if (errState.errorCode) params.set('error_code', errState.errorCode);
    return params.toString();
  }

  async function loadErrors() {
    const statusEl = document.getElementById('errors-status');
    statusEl.textContent = 'Loading…';
    try {
      const res = await fetch(`${API_BASE}/errors?${buildErrorQuery()}`);
      const data = await res.json();
      if (!res.ok) {
        const msg = (data && data.error && data.error.message) || `Request failed (${res.status})`;
        statusEl.textContent = `Error: ${msg}`;
        return;
      }
      renderErrorsTable(data.errors);
      renderErrorPagination(data.pagination);
      statusEl.textContent = data.errors.length === 0 ? 'No errors found.' : '';
      loadErrorTaxonomy();
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
    }
  }

  function renderErrorsTable(errors) {
    const tbody = document.getElementById('errors-tbody');
    tbody.innerHTML = '';
    errRowsById = Object.create(null);

    errors.forEach((e) => {
      errRowsById[e.error_id] = e;
      const codeClass = ERR_ACCENTS.includes(e.error_code) ? `err-${e.error_code}` : 'err-E_RUNTIME';

      const tr = document.createElement('tr');
      tr.className = `error-row ${codeClass}`;

      const tdTs = document.createElement('td');
      tdTs.textContent = formatTimestamp(e.timestamp);
      tr.appendChild(tdTs);

      const tdTool = document.createElement('td');
      tdTool.textContent = e.tool;                 // textContent — untrusted
      tr.appendChild(tdTool);

      const tdCode = document.createElement('td');
      tdCode.className = 'err-code-cell';
      tdCode.setAttribute('aria-label', `Error code: ${e.error_code}`);
      const dot = document.createElement('span');
      dot.className = 'err-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.textContent = '●';
      const codeText = document.createElement('span');
      codeText.className = 'err-code-text';
      codeText.textContent = e.error_code;
      tdCode.appendChild(dot);
      tdCode.appendChild(codeText);
      tr.appendChild(tdCode);

      const tdMsg = document.createElement('td');
      tdMsg.className = 'err-message';
      tdMsg.textContent = e.error_message || '—';  // textContent — untrusted
      tr.appendChild(tdMsg);

      const tdAct = document.createElement('td');
      const btn = document.createElement('button');
      btn.className = 'link-btn';
      btn.textContent = 'Stack →';
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', () => toggleStack(e.error_id, tr, btn));
      tdAct.appendChild(btn);
      tr.appendChild(tdAct);

      tbody.appendChild(tr);
    });
  }

  function toggleStack(errorId, tr, btn) {
    const next = tr.nextElementSibling;
    if (next && next.classList.contains('err-detail-row')) {
      const willHide = !next.hidden ? true : false;
      next.hidden = willHide;
      btn.setAttribute('aria-expanded', String(!willHide));
      return;
    }
    const rec = errRowsById[errorId];
    const detail = document.createElement('tr');
    detail.className = 'err-detail-row';
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = (rec && rec.stack_trace) ? rec.stack_trace : 'No stack trace recorded.';
    detail.appendChild(td);
    tr.insertAdjacentElement('afterend', detail);
    btn.setAttribute('aria-expanded', 'true');
  }

  async function loadErrorTaxonomy() {
    try {
      const res = await fetch(`${API_BASE}/errors/taxonomy?window=${encodeURIComponent(errState.window)}`);
      const data = await res.json();
      if (!res.ok) return;
      renderTaxonomy(data.taxonomy);
    } catch (err) {
      /* taxonomy is non-critical; silent on failure */
    }
  }

  function renderTaxonomy(taxonomy) {
    const chart = document.getElementById('taxonomy-chart');
    chart.innerHTML = '';
    const maxCount = taxonomy.reduce((m, t) => Math.max(m, t.count), 0) || 1; // scale by max (D12)

    taxonomy.forEach((t) => {
      const codeClass = ERR_ACCENTS.includes(t.error_code) ? `err-${t.error_code}` : 'err-E_RUNTIME';
      const row = document.createElement('div');
      row.className = `taxonomy-row ${codeClass}`;
      row.setAttribute('aria-label', `${t.error_code}: ${t.count} errors`);

      const code = document.createElement('span');
      code.className = 'tax-code';
      code.textContent = t.error_code;

      const track = document.createElement('span');
      track.className = 'tax-bar-track';
      const bar = document.createElement('span');
      bar.className = 'tax-bar';
      bar.style.width = `${Math.round((t.count / maxCount) * 100)}%`;
      track.appendChild(bar);

      const count = document.createElement('span');
      count.className = 'tax-count';
      count.textContent = t.count;

      row.appendChild(code);
      row.appendChild(track);
      row.appendChild(count);
      chart.appendChild(row);
    });
  }

  function renderErrorPagination(p) {
    document.getElementById('err-prev-page').disabled = !p.hasPrev;
    document.getElementById('err-next-page').disabled = !p.hasNext;
    const currentPage = Math.floor(p.offset / p.limit) + 1;
    const totalPages = Math.max(1, Math.ceil(p.total / p.limit));
    document.getElementById('err-page-info').textContent =
      `Page ${currentPage} of ${totalPages} — ${p.total} errors`;
  }

  function initErrors() {
    document.getElementById('error-filters').addEventListener('submit', (ev) => {
      ev.preventDefault();
      errState.tool = document.getElementById('filter-error-tool').value.trim();
      errState.errorCode = document.getElementById('filter-error-code').value;
      errState.window = document.getElementById('filter-error-window').value;
      errState.offset = 0;
      loadErrors();
    });
    document.getElementById('err-page-size').addEventListener('change', (ev) => {
      errState.limit = parseInt(ev.target.value, 10);
      errState.offset = 0;
      loadErrors();
    });
    document.getElementById('err-prev-page').addEventListener('click', () => {
      errState.offset = Math.max(0, errState.offset - errState.limit);
      loadErrors();
    });
    document.getElementById('err-next-page').addEventListener('click', () => {
      errState.offset = errState.offset + errState.limit;
      loadErrors();
    });
  }

  // ============================================================
  // Badges tab (Step 4)
  // ============================================================
  function badgeUrl(kind, tool) {
    return `${API_BASE}/badge/${kind}/${encodeURIComponent(tool)}`;
  }

  function buildMarkdownSnippet(tool) {
    return [
      `![${tool} health](${badgeUrl('health', tool)})`,
      `![${tool} p95 latency](${badgeUrl('latency', tool)})`,
      `![${tool} errors (24h)](${badgeUrl('errors', tool)})`
    ].join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // file:// contexts / older browsers may not expose the async Clipboard
    // API — fall back to a hidden textarea + execCommand so "copy" still
    // works instead of silently failing.
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  function renderBadgeCard(tool) {
    const card = document.createElement('div');
    card.className = 'badge-card';

    const name = document.createElement('div');
    name.className = 'badge-card-name';
    name.textContent = tool; // textContent — untrusted field

    const images = document.createElement('div');
    images.className = 'badge-card-images';
    ['health', 'latency', 'errors'].forEach((kind) => {
      const img = document.createElement('img');
      img.src = badgeUrl(kind, tool);
      img.alt = `${tool} ${kind}`;
      img.width = 100;
      img.height = 20;
      img.loading = 'lazy';
      images.appendChild(img);
    });

    const snippet = document.createElement('pre');
    snippet.className = 'badge-card-snippet';
    snippet.textContent = buildMarkdownSnippet(tool);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'badge-copy-btn';
    copyBtn.textContent = 'Copy markdown';
    copyBtn.setAttribute('aria-expanded', 'false');
    copyBtn.addEventListener('click', () => {
      const isVisible = snippet.classList.toggle('visible');
      copyBtn.setAttribute('aria-expanded', String(isVisible));
      copyText(buildMarkdownSnippet(tool))
        .then(() => { copyBtn.textContent = 'Copied!'; })
        .catch(() => { copyBtn.textContent = 'Copy markdown (select above)'; })
        .finally(() => {
          setTimeout(() => { copyBtn.textContent = 'Copy markdown'; }, 2000);
        });
    });

    card.appendChild(name);
    card.appendChild(images);
    card.appendChild(copyBtn);
    card.appendChild(snippet);
    return card;
  }

  async function loadBadges() {
    const statusEl = document.getElementById('badges-status');
    const grid = document.getElementById('badges-grid');
    statusEl.textContent = 'Loading…';

    try {
      const res = await fetch(`${API_BASE}/tools`);
      const data = await res.json();

      if (!res.ok) {
        const msg = (data && data.error && data.error.message) || `Request failed (${res.status})`;
        statusEl.textContent = `Error: ${msg}`;
        return;
      }

      grid.innerHTML = '';
      const tools = data.tools || [];
      tools.forEach((t) => grid.appendChild(renderBadgeCard(t.name)));

      statusEl.textContent = tools.length === 0 ? 'No tools recorded yet.' : '';
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
    }
  }

  // ============================================================
  // Init
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadFiltersFromStorage();
    applyFiltersToForm();
    initHistoryControls();
    initErrors();
    loadRuns();
  });
})();
