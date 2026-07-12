const TASKS_ENDPOINT = "http://127.0.0.1:7777/windows-tasks";
const POLL_INTERVAL_MS = 10000;

let lastFetchTime = null;
let allTasks = [];
let isFetching = false;
let retryCount = 0;
let retryTimeout = null;
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 1000;

// Sorting state
let sortKey = "name";
let sortAsc = true;

// Pagination state
let tasksPerPage = 50;
let currentPage = 1;

function setStatus(state, ts) {
    const el = document.getElementById("status");
    if (!el) return;
    el.textContent = state === "OK"
        ? `OK — ${ts}`
        : "ERROR — Unable to fetch tasks";
}

function showError(msg) {
    const el = document.getElementById("errors");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 5000);
}

function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    return `${diffHr}h ago`;
}

function updateTimestamp() {
    const el = document.getElementById("updateTime");
    if (!el || !lastFetchTime) return;

    const spinner = isFetching ? '<span class="spinner"></span>' : '';
    el.innerHTML = `${spinner} ${formatTimeAgo(lastFetchTime)}`.trim();
}

function getFilteredTasks() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return allTasks;

    const query = searchInput.value.toLowerCase();
    if (!query) return allTasks;

    return allTasks.filter(task => (task.name || "").toLowerCase().includes(query));
}

function getSortedTasks(tasks) {
    const sorted = [...tasks];
    sorted.sort((a, b) => {
        let aVal = a[sortKey];
        let bVal = b[sortKey];

        if (aVal == null) aVal = "";
        if (bVal == null) bVal = "";

        if (typeof aVal === "string") {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
            return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else {
            return sortAsc ? aVal - bVal : bVal - aVal;
        }
    });
    return sorted;
}

function setSortKey(key) {
    if (sortKey === key) {
        sortAsc = !sortAsc;
    } else {
        sortKey = key;
        sortAsc = true;
    }
    currentPage = 1;
    renderDashboard(getFilteredTasks());
}

async function fetchTasks() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    isFetching = true;
    updateTimestamp();

    try {
        const res = await fetch(TASKS_ENDPOINT, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        allTasks = data.tasks || [];
        lastFetchTime = new Date(data.generatedAt);
        renderDashboard(getFilteredTasks());
        setStatus("OK", new Date(data.generatedAt).toLocaleTimeString());
        retryCount = 0;
    } catch (err) {
        setStatus("ERROR", null);
        const errorMsg = err.message.includes("AbortError")
            ? "Fetch timeout (harvester not responding)"
            : err.message;

        if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount - 1);
            showError(`${errorMsg}. Retrying in ${Math.round(delayMs / 1000)}s... (${retryCount}/${MAX_RETRIES})`);

            if (retryTimeout) clearTimeout(retryTimeout);
            retryTimeout = setTimeout(fetchTasks, delayMs);
        } else {
            showError(`${errorMsg}. Max retries reached.`);
            retryCount = 0;
        }
    } finally {
        isFetching = false;
        updateTimestamp();
        clearTimeout(timeout);
    }
}

function renderDashboard(tasks) {
    if (!tasks || tasks.length === 0) {
        document.getElementById("taskList").innerHTML = "<p>No tasks found.</p>";
        return;
    }

    renderTaskList(tasks);
    renderTimeline(tasks);
    renderTaskHealth(tasks);
    renderTriggers(tasks);
    renderActions(tasks);
    renderEventLog(tasks);
}

function renderTaskList(tasks) {
    const el = document.getElementById("taskList");
    el.innerHTML = "";

    const sorted = getSortedTasks(tasks);
    const start = (currentPage - 1) * tasksPerPage;
    const end = start + tasksPerPage;
    const pageTasks = sorted.slice(start, end);

    const table = document.createElement("table");
    table.className = "task-table";

    const makeHeader = (label, key) => {
        const arrow = sortKey === key ? (sortAsc ? "↑" : "↓") : "";
        const th = document.createElement("th");
        th.style.cursor = "pointer";
        th.style.userSelect = "none";
        th.textContent = `${label} ${arrow}`;
        th.addEventListener("click", () => setSortKey(key));
        return th;
    };

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.appendChild(makeHeader("Name", "name"));
    headerRow.appendChild(makeHeader("Status", "status"));
    headerRow.appendChild(makeHeader("Enabled", "enabled"));
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    pageTasks.forEach(task => {
        const row = document.createElement("tr");
        const status = task.status || "unknown";

        const nameCell = document.createElement("td");
        const taskName = task.name || "Unknown";
        nameCell.textContent = taskName.length > 30 ? taskName.substring(0, 27) + "…" : taskName;
        row.appendChild(nameCell);

        const statusCell = document.createElement("td");
        statusCell.innerHTML = `<span class="badge ${status.toLowerCase()}">${status}</span>`;
        row.appendChild(statusCell);

        const enabledCell = document.createElement("td");
        enabledCell.textContent = task.enabled ? "Yes" : "No";
        row.appendChild(enabledCell);

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    el.appendChild(table);

    // Pagination controls
    if (sorted.length > tasksPerPage) {
        const pageInfo = document.createElement("div");
        pageInfo.className = "pagination-info";
        pageInfo.textContent = `Page ${currentPage} of ${Math.ceil(sorted.length / tasksPerPage)} (${sorted.length} tasks)`;
        el.appendChild(pageInfo);

        const btnContainer = document.createElement("div");
        btnContainer.className = "pagination-buttons";

        if (currentPage > 1) {
            const prevBtn = document.createElement("button");
            prevBtn.textContent = "← Previous";
            prevBtn.onclick = () => { currentPage--; renderDashboard(getFilteredTasks()); };
            btnContainer.appendChild(prevBtn);
        }

        if (end < sorted.length) {
            const nextBtn = document.createElement("button");
            nextBtn.textContent = "Next →";
            nextBtn.onclick = () => { currentPage++; renderDashboard(getFilteredTasks()); };
            btnContainer.appendChild(nextBtn);
        }

        el.appendChild(btnContainer);
    }
}

function renderTimeline(tasks) {
    const el = document.getElementById("timeline");
    el.innerHTML = "<div class='panel-title'>Timeline (Last 10)</div>";

    const withTime = tasks.filter(t => t.lastRunTime).sort((a, b) => {
        const aTime = new Date(a.lastRunTime || 0);
        const bTime = new Date(b.lastRunTime || 0);
        return bTime - aTime;
    }).slice(0, 10);

    withTime.forEach(task => {
        const bar = document.createElement("div");
        bar.className = "timeline-bar";

        const taskEl = document.createElement("div");
        const status = (task.status || "unknown").toLowerCase();
        taskEl.className = `timeline-task ${status}`;
        taskEl.title = `${task.name || "Unknown"} — ${task.lastRunTime}`;
        taskEl.textContent = (task.name || "Unknown").substring(0, 20);

        bar.appendChild(taskEl);
        el.appendChild(bar);
    });

    if (withTime.length === 0) {
        el.innerHTML += "<p style='color: #9a9088;'>No recent executions.</p>";
    }
}

function renderTaskHealth(tasks) {
    const el = document.getElementById("taskHealth");
    el.innerHTML = "<div class='panel-title'>Health</div>";

    const total = tasks.length;
    const ready = tasks.filter(t => t.status === "Ready").length;
    const running = tasks.filter(t => t.status === "Running").length;
    const error = tasks.filter(t => t.status === "Error").length;

    const healthPercent = total > 0 ? (ready / total) * 100 : 0;

    el.innerHTML += `<div style='font-size: 10px; margin: 4px 0;'>Ready: ${ready}/${total}</div>`;
    el.innerHTML += `<div class='health-bar'><div class='health-fill' style='width: ${healthPercent}%;'></div></div>`;
    el.innerHTML += `<div style='font-size: 10px; color: #B8922A;'>Running: ${running}</div>`;
    el.innerHTML += `<div style='font-size: 10px; color: #8B3A1A;'>Error: ${error}</div>`;
}

function renderTriggers(tasks) {
    const el = document.getElementById("triggersPanel");
    el.innerHTML = "<div class='panel-title'>Triggers (Top 5)</div>";

    const allTriggers = [];
    tasks.forEach(task => {
        if (task.triggers && Array.isArray(task.triggers)) {
            task.triggers.forEach(trigger => {
                allTriggers.push({
                    taskName: task.name,
                    type: trigger.type,
                    schedule: trigger.schedule,
                    startBoundary: trigger.startBoundary
                });
            });
        }
    });

    allTriggers.slice(0, 5).forEach(trig => {
        if (!trig) return;
        const item = document.createElement("div");
        item.className = "trigger-item";
        const taskName = (trig.taskName || "Unknown").substring(0, 20);
        const type = trig.type || "N/A";
        const schedule = trig.schedule || "N/A";
        item.innerHTML = `<strong>${taskName}</strong><br/>Type: ${type}<br/>Schedule: ${schedule}`;
        el.appendChild(item);
    });

    if (allTriggers.length === 0) {
        el.innerHTML += "<p style='color: #9a9088;'>No triggers.</p>";
    }
}

function renderActions(tasks) {
    const el = document.getElementById("actionsPanel");
    el.innerHTML = "<div class='panel-title'>Actions (Top 5)</div>";

    const allActions = [];
    tasks.forEach(task => {
        if (task.actions && Array.isArray(task.actions)) {
            task.actions.forEach(action => {
                allActions.push({
                    taskName: task.name,
                    type: action.type,
                    path: action.path,
                    arguments: action.arguments
                });
            });
        }
    });

    allActions.slice(0, 5).forEach(act => {
        if (!act) return;
        const item = document.createElement("div");
        item.className = "action-item";
        const taskName = (act.taskName || "Unknown").substring(0, 20);
        const type = act.type || "N/A";
        const path = (act.path || "N/A").substring(0, 30);
        item.innerHTML = `<strong>${taskName}</strong><br/>Type: ${type}<br/>Path: ${path}`;
        el.appendChild(item);
    });

    if (allActions.length === 0) {
        el.innerHTML += "<p style='color: #9a9088;'>No actions.</p>";
    }
}

function renderEventLog(tasks) {
    const el = document.getElementById("eventLog");
    el.innerHTML = "<div class='panel-title'>Event Log</div>";

    const events = [];
    tasks.forEach(task => {
        if (task.lastRunTime) {
            events.push({
                timestamp: task.lastRunTime,
                taskName: task.name,
                result: task.lastResult === 0 ? "OK" : `Error (${task.lastResult})`
            });
        }
    });

    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const table = document.createElement("table");
    table.className = "task-table";
    table.innerHTML = "<thead><tr><th>Time</th><th>Task</th><th>Result</th></tr></thead>";
    const tbody = document.createElement("tbody");

    events.slice(0, 20).forEach(evt => {
        const row = tbody.insertRow();
        const d = new Date(evt.timestamp);
        row.insertCell(0).textContent = d.toLocaleTimeString();
        row.insertCell(1).textContent = (evt.taskName || "Unknown").substring(0, 20);
        row.insertCell(2).textContent = evt.result;
    });

    table.appendChild(tbody);
    el.appendChild(table);
}

window.refreshNow = fetchTasks;
window.setSortKey = setSortKey;

function exportTasks(format) {
    const sorted = getSortedTasks(getFilteredTasks());
    let content, filename, type;

    if (format === "csv") {
        const headers = ["Name", "Status", "Enabled", "Last Run", "Last Result", "Next Run"];
        const rows = sorted.map(t => [
            `"${t.name.replace(/"/g, '""')}"`,
            t.status,
            t.enabled ? "Yes" : "No",
            t.lastRunTime ? new Date(t.lastRunTime).toLocaleString() : "N/A",
            t.lastResult ?? "N/A",
            t.nextRunTime ? new Date(t.nextRunTime).toLocaleString() : "N/A"
        ]);
        content = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        filename = `tasks-${new Date().toISOString().split('T')[0]}.csv`;
        type = "text/csv";
    } else {
        const data = { exportedAt: new Date().toISOString(), taskCount: sorted.length, tasks: sorted };
        content = JSON.stringify(data, null, 2);
        filename = `tasks-${new Date().toISOString().split('T')[0]}.json`;
        type = "application/json";
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Search input listener
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            currentPage = 1;
            renderDashboard(getFilteredTasks());
        });
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === "r") {
                e.preventDefault();
                fetchTasks();
            } else if (e.key === "f") {
                e.preventDefault();
                searchInput?.focus();
            } else if (e.key === "s") {
                e.preventDefault();
                exportTasks("csv");
            } else if (e.key === "e") {
                e.preventDefault();
                exportTasks("json");
            }
        }
    });
});

// Update timestamp every second
setInterval(updateTimestamp, 1000);

// Poll tasks every 10 seconds
setInterval(fetchTasks, POLL_INTERVAL_MS);

// Initial fetch
fetchTasks();
