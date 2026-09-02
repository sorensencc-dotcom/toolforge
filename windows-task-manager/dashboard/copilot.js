const TASKS_ENDPOINT = "http://127.0.0.1:7777/copilot-tasks";
const POLL_INTERVAL_MS = 10000;

let retryCount = 0;
let retryTimeout = null;
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 1000;

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

async function fetchTasks() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
        const res = await fetch(TASKS_ENDPOINT, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        renderDashboard(data);
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
        clearTimeout(timeout);
    }
}

function renderDashboard(data) {
    if (!data.tasks || data.tasks.length === 0) {
        document.getElementById("activeTasks").innerHTML = "<div class='panel-title'>Active Tasks</div><p>No tasks.</p>";
        return;
    }

    renderTimeline(data.tasks);
    renderOwnerLoad(data.tasks);
    renderStageFlow(data.tasks);
    renderActiveTasks(data.tasks);
    renderEventLog(data.tasks);
}

function renderTimeline(tasks) {
    const el = document.getElementById("timeline");
    el.innerHTML = "<div class='panel-title'>Timeline</div>";

    tasks.forEach(task => {
        if (!task.startedAt) return;

        const bar = document.createElement("div");
        bar.className = "timeline-bar";

        const taskEl = document.createElement("div");
        taskEl.className = `timeline-task ${task.priority ? task.priority.toLowerCase() : 'p2'}`;
        taskEl.title = `${task.title || "Unknown"} (${task.owner || "Unknown"})`;
        taskEl.textContent = (task.title || "Unknown").substring(0, 20);

        bar.appendChild(taskEl);
        el.appendChild(bar);
    });
}

function renderOwnerLoad(tasks) {
    const el = document.getElementById("ownerLoad");
    el.innerHTML = "<div class='panel-title'>Owner Load</div>";

    const byOwner = {};
    tasks.forEach(task => {
        if (!byOwner[task.owner]) {
            byOwner[task.owner] = { count: 0, effort: 0 };
        }
        byOwner[task.owner].count++;
        byOwner[task.owner].effort += task.effortEstimate || 0;
    });

    const table = document.createElement("table");
    table.className = "task-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Owner", "Tasks", "Effort"].forEach(label => {
        const th = document.createElement("th");
        th.textContent = label;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    Object.entries(byOwner).forEach(([owner, stats]) => {
        const row = document.createElement("tr");

        const ownerCell = document.createElement("td");
        ownerCell.textContent = owner;
        row.appendChild(ownerCell);

        const countCell = document.createElement("td");
        countCell.textContent = stats.count;
        row.appendChild(countCell);

        const effortCell = document.createElement("td");
        effortCell.textContent = `${stats.effort.toFixed(1)}h`;
        row.appendChild(effortCell);

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    el.appendChild(table);
}

function renderStageFlow(tasks) {
    const el = document.getElementById("stageFlow");
    el.innerHTML = "<div class='panel-title'>Stage Flow</div>";

    const stages = ["DISCOVERY", "HARVESTER", "REDESIGN", "OUTREACH", "DELIVERY"];
    const stageCounts = {};
    stages.forEach(s => { stageCounts[s] = 0; });

    tasks.forEach(task => {
        if (stageCounts.hasOwnProperty(task.stage)) {
            stageCounts[task.stage]++;
        }
    });

    const pipeline = document.createElement("div");
    pipeline.style.display = "flex";
    pipeline.style.gap = "4px";

    stages.forEach(stage => {
        const count = stageCounts[stage];
        const box = document.createElement("div");
        box.style.flex = "1";
        box.style.background = "#050608";
        box.style.border = "1px solid #1f2933";
        box.style.borderRadius = "4px";
        box.style.padding = "8px";
        box.style.textAlign = "center";
        box.innerHTML = `<div style='font-size: 10px; color: #9a9088;'>${stage}</div><div style='font-size: 14px; color: #D85A24; font-weight: bold;'>${count}</div>`;

        pipeline.appendChild(box);
    });

    el.appendChild(pipeline);
}

function renderActiveTasks(tasks) {
    const el = document.getElementById("activeTasks");
    el.innerHTML = "<div class='panel-title'>Active Tasks</div>";

    const active = tasks.filter(t => t.status === "running").slice(0, 10);

    if (active.length === 0) {
        el.innerHTML += "<p style='color: #9a9088;'>No running tasks.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "task-table";
    table.innerHTML = "<thead><tr><th>Task</th><th>Owner</th><th>Stage</th></tr></thead>";
    const tbody = document.createElement("tbody");

    active.forEach(t => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = (t.title || "Unknown").substring(0, 25);
        row.insertCell(1).textContent = t.owner || "Unknown";
        row.insertCell(2).textContent = t.stage || "N/A";
    });

    table.appendChild(tbody);
    el.appendChild(table);
}

function renderEventLog(tasks) {
    const el = document.getElementById("eventLog");
    el.innerHTML = "<div class='panel-title'>Event Log</div>";

    const allLogs = [];
    tasks.forEach(task => {
        if (task.logs && Array.isArray(task.logs)) {
            task.logs.forEach(log => {
                allLogs.push({
                    ...log,
                    taskId: task.id
                });
            });
        }
    });

    allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const recent = allLogs.slice(0, 20);

    if (recent.length === 0) {
        el.innerHTML += "<p style='color: #9a9088;'>No events.</p>";
        return;
    }

    const table = document.createElement("table");
    table.className = "task-table";
    table.innerHTML = "<thead><tr><th>Time</th><th>Task</th><th>Message</th></tr></thead>";
    const tbody = document.createElement("tbody");

    recent.forEach(log => {
        const row = tbody.insertRow();
        const d = new Date(log.timestamp);
        row.insertCell(0).textContent = d.toLocaleTimeString();
        row.insertCell(1).textContent = (log.taskId || "Unknown").substring(0, 12);
        row.insertCell(2).textContent = (log.message || "").substring(0, 30);
    });

    table.appendChild(tbody);
    el.appendChild(table);
}

window.refreshNow = fetchTasks;

setInterval(fetchTasks, POLL_INTERVAL_MS);
fetchTasks();
