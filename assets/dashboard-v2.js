'use strict';

// ============================================================
// Toolforge Dashboard v2 — Execution History tab logic
// Phase 2b Step 1 (docs/meta/toolforge-phase-2b-step1-design.md §3/§4/§5)
// ============================================================

(function () {
  const API_BASE = 'http://127.0.0.1:3000/api/toolforge';
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
  // Init
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadFiltersFromStorage();
    applyFiltersToForm();
    initHistoryControls();
    loadRuns();
  });
})();
