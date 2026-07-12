const TASKS_ENDPOINT = "http://localhost:7777/windows-tasks";
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

// Filter state
let categoryFilter = "my-tasks"; // "my-tasks", "system", "all"

const VENDOR_PREFIXES = ["hp", "google", "mcafee", "softlanding", "avast", "avg", "norton", "kaspersky", "bitdefender", "trend micro", "adobe", "java", "apple"];

function getCategoryFromTaskName(taskName) {
    if (!taskName) return "other";
    const parts = taskName.split("\\").filter(p => p);
    if (parts.length === 0) return "other";

    const firstPart = parts[0].toLowerCase();
    if (firstPart === "microsoft") return "system";

    // Check if first part matches known vendor
    if (VENDOR_PREFIXES.some(vendor => firstPart.includes(vendor))) return "vendor";

    return "user";
}

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

function createPanelItems(panelId, title, items, renderFn, emptyMsg) {
    const el = document.getElementById(panelId);
    if (!el) return;
    el.innerHTML = `<div class='panel-title'>${title}</div>`;

    items.slice(0, 5).forEach(item => {
        if (!item) return;
        renderFn(el, item);
    });

    if (items.length === 0) {
        el.innerHTML += `<p style='color: #9a9088;'>${emptyMsg}</p>`;
    }
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
    let filtered = allTasks;

    // Apply category filter
    if (categoryFilter === "my-tasks") {
        filtered = filtered.filter(task => getCategoryFromTaskName(task.name) === "user");
    } else if (categoryFilter === "system") {
        filtered = filtered.filter(task => getCategoryFromTaskName(task.name) === "system");
    } else if (categoryFilter === "vendor") {
        filtered = filtered.filter(task => getCategoryFromTaskName(task.name) === "vendor");
    }

    // Apply search filter
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return filtered;

    const query = searchInput.value.toLowerCase();
    if (!query) return filtered;

    return filtered.filter(task => (task.name || "").toLowerCase().includes(query));
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

function setCategoryFilter(filter) {
    categoryFilter = filter;
    currentPage = 1;
    renderDashboard(getFilteredTasks());
}

async function toggleTaskState(taskName, newState) {
    try {
        const endpoint = newState === "enable" ? "http://localhost:7777/task-action/enable" : "http://localhost:7777/task-action/disable";
        const res = await fetch(`${endpoint}?name=${encodeURIComponent(taskName)}`, { method: "POST" });
        const data = await res.json();

        if (res.ok) {
            showError(`✓ ${data.message}`);
            await fetchTasks();
        } else {
            showError(`✗ ${data.error}`);
        }
    } catch (err) {
        showError(`Error: ${err.message}`);
    }
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
    renderAgenda(tasks);
    renderTimeline(tasks);
    renderTaskHealth(tasks);
    renderTriggers(tasks);
    renderActions(tasks);
    renderEventLog(tasks);
}

function renderTaskList(tasks) {
    const el = document.getElementById("taskList");
    el.innerHTML = "";

    // Add category filter dropdown
    const filterContainer = document.createElement("div");
    filterContainer.style.marginBottom = "12px";
    filterContainer.style.display = "flex";
    filterContainer.style.gap = "8px";
    filterContainer.style.alignItems = "center";

    const filterLabel = document.createElement("label");
    filterLabel.textContent = "Category:";
    filterLabel.style.fontSize = "12px";
    filterLabel.style.color = "#9a9088";
    filterContainer.appendChild(filterLabel);

    const filterSelect = document.createElement("select");
    filterSelect.style.background = "#0d0b08";
    filterSelect.style.color = "#e8e0d4";
    filterSelect.style.border = "1px solid #D4AF9E";
    filterSelect.style.borderRadius = "4px";
    filterSelect.style.padding = "4px 8px";
    filterSelect.style.fontSize = "12px";
    filterSelect.style.fontFamily = "JetBrains Mono, Consolas, monospace";
    filterSelect.style.cursor = "pointer";

    const opts = [
        { value: "my-tasks", label: "My Tasks" },
        { value: "vendor", label: "Vendor Tasks" },
        { value: "system", label: "System Tasks" },
        { value: "all", label: "All Tasks" }
    ];

    opts.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        option.selected = opt.value === categoryFilter;
        filterSelect.appendChild(option);
    });

    filterSelect.addEventListener("change", (e) => {
        setCategoryFilter(e.target.value);
    });

    filterContainer.appendChild(filterSelect);
    el.appendChild(filterContainer);

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
        th.tabIndex = 0;
        th.setAttribute("role", "button");
        th.setAttribute("aria-sort", sortKey === key ? (sortAsc ? "ascending" : "descending") : "none");
        th.addEventListener("click", () => setSortKey(key));
        th.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSortKey(key);
            }
        });
        return th;
    };

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.appendChild(makeHeader("Name", "name"));
    headerRow.appendChild(makeHeader("Status", "status"));
    headerRow.appendChild(makeHeader("Enabled", "enabled"));

    const actionsHeader = document.createElement("th");
    actionsHeader.textContent = "Actions";
    actionsHeader.style.textAlign = "center";
    headerRow.appendChild(actionsHeader);

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
        const badgeSpan = document.createElement("span");
        badgeSpan.className = `badge ${status.toLowerCase()}`;
        badgeSpan.textContent = status;
        statusCell.appendChild(badgeSpan);
        row.appendChild(statusCell);

        const enabledCell = document.createElement("td");
        enabledCell.textContent = task.enabled ? "Yes" : "No";
        row.appendChild(enabledCell);

        const actionsCell = document.createElement("td");
        actionsCell.style.textAlign = "center";
        actionsCell.style.whiteSpace = "nowrap";

        if (task.enabled) {
            const disableBtn = document.createElement("button");
            disableBtn.textContent = "Disable";
            disableBtn.style.fontSize = "10px";
            disableBtn.style.padding = "2px 6px";
            disableBtn.onclick = () => toggleTaskState(task.name, "disable");
            actionsCell.appendChild(disableBtn);
        } else {
            const enableBtn = document.createElement("button");
            enableBtn.textContent = "Enable";
            enableBtn.style.fontSize = "10px";
            enableBtn.style.padding = "2px 6px";
            enableBtn.onclick = () => toggleTaskState(task.name, "enable");
            actionsCell.appendChild(enableBtn);
        }

        row.appendChild(actionsCell);
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

function renderAgenda(tasks) {
    const el = document.getElementById("agenda");
    el.innerHTML = "<div class='panel-title'>Schedule (Upcoming)</div>";

    const now = new Date();
    const scheduled = tasks
        .filter(t => t.nextRunTime)
        .map(t => ({
            name: t.name,
            time: new Date(t.nextRunTime),
            enabled: t.enabled
        }))
        .sort((a, b) => a.time - b.time)
        .slice(0, 15);

    if (scheduled.length === 0) {
        el.innerHTML += "<p style='color: #9a9088;'>No scheduled tasks.</p>";
        return;
    }

    const groups = {};
    scheduled.forEach(task => {
        const date = task.time;
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        const taskDate = new Date(date);
        taskDate.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((taskDate - today) / (1000 * 60 * 60 * 24));

        let group = "Later";
        if (diffDays === 0) group = "Today";
        else if (diffDays === 1) group = "Tomorrow";
        else if (diffDays < 7) group = "This Week";

        if (!groups[group]) groups[group] = [];
        groups[group].push(task);
    });

    const groupOrder = ["Today", "Tomorrow", "This Week", "Later"];
    groupOrder.forEach(groupName => {
        if (groups[groupName]) {
            const groupEl = document.createElement("div");
            groupEl.style.marginBottom = "12px";

            const groupTitle = document.createElement("div");
            groupTitle.style.fontSize = "11px";
            groupTitle.style.color = "#D85A24";
            groupTitle.style.fontWeight = "bold";
            groupTitle.style.marginBottom = "4px";
            groupTitle.textContent = groupName;
            groupEl.appendChild(groupTitle);

            groups[groupName].forEach(task => {
                const item = document.createElement("div");
                item.style.fontSize = "10px";
                item.style.padding = "4px 6px";
                item.style.background = "#0d0b08";
                item.style.border = "1px solid #8B3A1A";
                item.style.borderRadius = "3px";
                item.style.marginBottom = "2px";
                item.style.color = task.enabled ? "#e8e0d4" : "#9a9088";
                item.style.opacity = task.enabled ? "1" : "0.6";

                const time = task.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const taskName = (task.name || "Unknown").substring(0, 35);
                item.textContent = `${time} — ${taskName}`;
                item.title = task.name;
                groupEl.appendChild(item);
            });

            el.appendChild(groupEl);
        }
    });
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
    const total = tasks.length;
    const ready = tasks.filter(t => t.status === "Ready").length;
    const running = tasks.filter(t => t.status === "Running").length;
    const error = tasks.filter(t => t.status === "Error").length;

    const healthPercent = total > 0 ? (ready / total) * 100 : 0;

    const healthStat = document.getElementById("healthStat");
    if (!healthStat) return;
    healthStat.textContent = `${ready}/${total}`;

    const healthBar = document.getElementById("healthBar");
    if (healthBar) healthBar.style.width = `${healthPercent}%`;

    const runningCount = document.getElementById("runningCount");
    if (runningCount) runningCount.textContent = running;

    const errorCount = document.getElementById("errorCount");
    if (errorCount) errorCount.textContent = error;
}

function renderTriggers(tasks) {
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

    createPanelItems("triggersPanel", "Triggers (Top 5)", allTriggers, (el, trig) => {
        const item = document.createElement("div");
        item.className = "trigger-item";
        const taskName = (trig.taskName || "Unknown").substring(0, 20);
        const type = trig.type || "N/A";
        const schedule = trig.schedule || "N/A";
        const strong = document.createElement("strong");
        strong.textContent = taskName;
        item.appendChild(strong);
        item.appendChild(document.createElement("br"));
        item.appendChild(document.createTextNode(`Type: ${type}`));
        item.appendChild(document.createElement("br"));
        item.appendChild(document.createTextNode(`Schedule: ${schedule}`));
        el.appendChild(item);
    }, "No triggers.");
}

function renderActions(tasks) {
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

    createPanelItems("actionsPanel", "Actions (Top 5)", allActions, (el, act) => {
        const item = document.createElement("div");
        item.className = "action-item";
        const taskName = (act.taskName || "Unknown").substring(0, 20);
        const type = act.type || "N/A";
        const path = (act.path || "N/A").substring(0, 30);
        const strong = document.createElement("strong");
        strong.textContent = taskName;
        item.appendChild(strong);
        item.appendChild(document.createElement("br"));
        item.appendChild(document.createTextNode(`Type: ${type}`));
        item.appendChild(document.createElement("br"));
        item.appendChild(document.createTextNode(`Path: ${path}`));
        el.appendChild(item);
    }, "No actions.");
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
window.setCategoryFilter = setCategoryFilter;

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
