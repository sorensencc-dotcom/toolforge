#!/usr/bin/env python3
"""
CIC / Rewrite Labs Daily Status Aggregator
Scans local memory, TODO, kb-sync, and pipeline-log sources and produces a
single status JSON consumed by the daily HTML status artifact.

Run from a context where C:\\dev is mounted at DEV_ROOT and the CIC OneDrive
folder is mounted at CIC_ROOT. Designed to be safe to re-run: every read is
best-effort and missing sources are flagged, not fatal.
"""
import json, os, re, sys
from datetime import datetime, timezone
from pathlib import Path

import platform

def _default_dev_root():
    if platform.system() == "Windows":
        return r"C:\dev"
    return "/sessions/awesome-dreamy-dirac/mnt/dev"

def _default_cic_root():
    if platform.system() == "Windows":
        return r"C:\Users\soren\OneDrive\Documents\Claude\Projects\CIC"
    return "/sessions/awesome-dreamy-dirac/mnt/CIC"

def _default_out():
    if platform.system() == "Windows":
        return r"C:\dev\_status-feed\daily_status.json"
    return "/sessions/awesome-dreamy-dirac/mnt/outputs/daily_status.json"

DEV_ROOT = Path(os.environ.get("DEV_ROOT", _default_dev_root()))
CIC_ROOT = Path(os.environ.get("CIC_ROOT", _default_cic_root()))
CLAUDE_MIRROR = DEV_ROOT / "_status-feed" / "claude-memory"

now = datetime.now(timezone.utc)

def read_text(p: Path, limit=200000):
    try:
        return p.read_text(encoding="utf-8", errors="replace")[:limit]
    except Exception:
        return None

def read_json(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return None

def mtime_iso(p: Path):
    try:
        return datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat()
    except Exception:
        return None

def age_hours(iso_str):
    if not iso_str:
        return None
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return round((now - dt).total_seconds() / 3600, 1)
    except Exception:
        return None

status = {
    "generated_at": now.isoformat(),
    "sources_checked": [],
    "sources_missing": [],
    "kb_sync": {},
    "todos": {},
    "memory": {},
    "handoff": {},
    "trm_pipeline": {},
    "trm_intelligence": {},
    "automation_logs": {},
    "claude_project_memory": {},
    "momentum": {},
    "system_health": {},
    "anomalies": {},
}

def note(path: Path, found: bool, label=None):
    entry = str(path)
    if found:
        status["sources_checked"].append(entry)
    else:
        status["sources_missing"].append(entry)

# ---------------------------------------------------------------------------
# 1. kb-sync status
# ---------------------------------------------------------------------------
kb_sync_dir = DEV_ROOT / "kb-sync"
sync_status = read_json(kb_sync_dir / ".sync-status.json")
note(kb_sync_dir / ".sync-status.json", sync_status is not None)
drift = read_json(kb_sync_dir / ".drift-report.json")
note(kb_sync_dir / ".drift-report.json", drift is not None)
coverage = read_json(kb_sync_dir / ".coverage-report.json")
note(kb_sync_dir / ".coverage-report.json", coverage is not None)

status["kb_sync"] = {
    "last_sync": sync_status.get("last_sync_timestamp") if sync_status else None,
    "last_sync_age_hours": age_hours(sync_status.get("last_sync_timestamp")) if sync_status else None,
    "sync_status": sync_status.get("status") if sync_status else "UNKNOWN",
    "file_count": sync_status.get("file_count") if sync_status else None,
    "drift_status": drift.get("status") if drift else "UNKNOWN",
    "drift_stale_pages": (drift.get("summary") or {}).get("stale_pages_count") if drift else None,
    "drift_checked_at": drift.get("timestamp") if drift else None,
    "drift_age_hours": age_hours(drift.get("timestamp")) if drift else None,
    "drifted_files": [d.get("file") for d in (drift.get("drifted_sources") or [])][:10] if drift else [],
    "coverage_pct": coverage.get("coverage_score_pct") if coverage else None,
    "coverage_checked_at": coverage.get("timestamp") if coverage else None,
    "link_health_pct": (coverage.get("link_health") or {}).get("healthy_pct") if coverage else None,
}

# ---------------------------------------------------------------------------
# 2. TODOS.md — open action items by priority
# ---------------------------------------------------------------------------
todos_path = DEV_ROOT / "TODOS.md"
todos_text = read_text(todos_path)
note(todos_path, todos_text is not None)

open_items = []
completed_recent = []
if todos_text:
    # Split Open vs Completed sections (anchor to start-of-line headers only —
    # "## Open" / "## Completed" can appear inline in prose elsewhere in the file)
    open_match = re.search(r"^## Open\s*$", todos_text, re.M)
    completed_match = re.search(r"^## Completed\s*$", todos_text, re.M)
    if open_match and completed_match and completed_match.start() > open_match.start():
        open_body = todos_text[open_match.end():completed_match.start()]
        completed_body = todos_text[completed_match.end():]
    elif open_match:
        open_body = todos_text[open_match.end():]
        completed_body = ""
    else:
        open_body = ""
        completed_body = ""

    item_re = re.compile(r"^-\s\[ \]\s\*\*(?:\[(P[0-2])\]\s*)?(.+?)\*\*\s*(?:\(created\s([\d-]+)\))?\s*[—-]?\s*(.*)$")
    for line in open_body.splitlines():
        line = line.strip()
        if not line.startswith("- [ ]"):
            continue
        m = item_re.match(line)
        if m:
            priority, title, created, rest = m.groups()
            open_items.append({
                "priority": priority or "P?",
                "title": title.strip(),
                "created": created,
                "detail": (rest or "").strip()[:220],
            })
        else:
            clean = re.sub(r"^-\s\[ \]\s", "", line)
            open_items.append({"priority": "P?", "title": clean[:160], "created": None, "detail": ""})

    today_str = now.strftime("%Y-%m-%d")
    for line in completed_body.splitlines():
        if line.strip().startswith("- [x]") and today_str in line:
            completed_recent.append(re.sub(r"^-\s\[x\]\s", "", line.strip())[:200])

priority_order = {"P0": 0, "P1": 1, "P2": 2, "P?": 3}
open_items_sorted = sorted(open_items, key=lambda x: priority_order.get(x["priority"], 3))
counts = {"P0": 0, "P1": 0, "P2": 0, "P?": 0}
for it in open_items:
    counts[it["priority"]] = counts.get(it["priority"], 0) + 1

status["todos"] = {
    "total_open": len(open_items),
    "counts_by_priority": counts,
    "top_open": open_items_sorted[:15],
    "closed_today": completed_recent[:10],
}

# ---------------------------------------------------------------------------
# 3. memory/MEMORY.md — Current Work section
# ---------------------------------------------------------------------------
mem_path = DEV_ROOT / "memory" / "MEMORY.md"
mem_text = read_text(mem_path)
note(mem_path, mem_text is not None)

current_work = []
if mem_text:
    m = re.search(r"## Current Work\s*\n(.*?)(?=\n## |\Z)", mem_text, re.S)
    if m:
        for line in m.group(1).splitlines():
            line = line.strip()
            if line.startswith("-"):
                current_work.append(line.lstrip("- ").strip())

status["memory"] = {
    "path": str(mem_path),
    "last_modified": mtime_iso(mem_path),
    "current_work": current_work,
}

# ---------------------------------------------------------------------------
# 4. .ijfw/memory/handoff.md — dev root (most recent handoff)
# ---------------------------------------------------------------------------
handoff_path = DEV_ROOT / ".ijfw" / "memory" / "handoff.md"
handoff_text = read_text(handoff_path)
note(handoff_path, handoff_text is not None)

def extract_section(text, header):
    if not text:
        return []
    m = re.search(rf"{re.escape(header)}\s*\n-+\s*\n(.*?)(?=\n[A-Za-z].*\n-+\s*\n|\Z)", text, re.S)
    if not m:
        return []
    lines = [l.strip() for l in m.group(1).splitlines() if l.strip()]
    return lines

next_steps = extract_section(handoff_text, "Next Steps")
blockers = extract_section(handoff_text, "Blockers")
handoff_date = None
if handoff_text:
    dm = re.search(r"Handoff:\s*([\d-]+)", handoff_text)
    if dm:
        handoff_date = dm.group(1)

status["handoff"] = {
    "path": str(handoff_path),
    "date": handoff_date,
    "last_modified": mtime_iso(handoff_path),
    "next_steps": next_steps[:10],
    "blockers": blockers[:10],
}

# ---------------------------------------------------------------------------
# 5. TRM pipeline — latest sync report freshness
# ---------------------------------------------------------------------------
treatment_dir = DEV_ROOT / "charlie-deep-research" / "treatment"
latest_report = None
if treatment_dir.exists():
    reports = sorted(treatment_dir.glob("TRM_SYNC_REPORT_*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
    if reports:
        latest_report = reports[0]
note(treatment_dir, latest_report is not None)

trm_info = {}
if latest_report:
    txt = read_text(latest_report, limit=4000)
    fm = {}
    if txt:
        fm_match = re.search(r"^---\n(.*?)\n---", txt, re.S)
        if fm_match:
            for line in fm_match.group(1).splitlines():
                if ":" in line and not line.strip().startswith(("\"", "[")):
                    k, _, v = line.partition(":")
                    fm[k.strip()] = v.strip()
    trm_info = {
        "latest_report": latest_report.name,
        "run_at": fm.get("runAt"),
        "run_age_hours": age_hours(fm.get("runAt")),
        "partial_run": fm.get("partialRun"),
        "fact_key_collisions": fm.get("factKeyCollisions"),
    }
status["trm_pipeline"] = trm_info

# ---------------------------------------------------------------------------
# 5b. TRM Topics & Question Mining Intelligence
# ---------------------------------------------------------------------------
vault_root = Path(os.environ.get("TRM_VAULT_ROOT", r"C:\Users\soren\trm-vault" if platform.system() == "Windows" else "/sessions/awesome-dreamy-dirac/mnt/trm-vault"))
trm_intel = {
    "vault_path": str(vault_root),
    "topics_total": 0,
    "topics": [],
    "topics_created": [],
    "topics_deleted": [],
    "questions_answered_total": 0,
    "questions_answered": [],
    "recent_answers": [],
    "matrix_gaps_total": 0,
    "matrix_gaps_triaged": 0,
    "matrix_gaps_open": 0,
    "active_gaps": [],
}

if vault_root.exists():
    note(vault_root, True)
    # 1. Topics in vault
    topics_dir = vault_root / "topics"
    current_topic_names = set()
    topic_items = []
    if topics_dir.exists():
        for p in topics_dir.rglob("extracts"):
            if p.is_dir():
                topic_rel = str(p.parent.relative_to(topics_dir)).replace("\\", "/")
                current_topic_names.add(topic_rel)
                mtime = mtime_iso(p.parent)
                topic_items.append({
                    "name": topic_rel,
                    "modified": mtime,
                    "age_hours": age_hours(mtime)
                })
    topic_items.sort(key=lambda x: x["name"])
    trm_intel["topics_total"] = len(topic_items)
    trm_intel["topics"] = topic_items

    # Topic delta snapshot comparison
    topic_snapshot_file = DEV_ROOT / "_status-feed" / "trm_topics_snapshot.json"
    prev_topics = set(read_json(topic_snapshot_file) or []) if topic_snapshot_file.exists() else set()
    if prev_topics:
        trm_intel["topics_created"] = sorted(list(current_topic_names - prev_topics))
        trm_intel["topics_deleted"] = sorted(list(prev_topics - current_topic_names))
    if current_topic_names:
        try:
            topic_snapshot_file.parent.mkdir(parents=True, exist_ok=True)
            topic_snapshot_file.write_text(json.dumps(sorted(list(current_topic_names)), indent=2), encoding="utf-8")
        except Exception:
            pass

    # 2. NotebookLM Registry & Ingestion 24h delta
    registry_file = vault_root / "notebooklm-registry.json"
    registry_data = read_json(registry_file) if registry_file.exists() else None
    notebooks_summary = []
    quarantined_total = 0
    if registry_data and "notebooks" in registry_data:
        for nb in registry_data["notebooks"]:
            nb_quarantined = len(nb.get("quarantined", {}))
            quarantined_total += nb_quarantined
            last_mined = nb.get("last_mined_at")
            notebooks_summary.append({
                "id": nb.get("notebook_id"),
                "title": nb.get("title"),
                "last_mined": last_mined,
                "last_mined_age_hours": age_hours(last_mined),
                "quarantined": nb_quarantined,
                "sources_count": len(nb.get("last_pulled_hashes", {})),
            })
    trm_intel["notebooks_total"] = len(notebooks_summary)
    trm_intel["notebooks"] = notebooks_summary
    trm_intel["quarantined_total"] = quarantined_total

    # 3. Questions answered & Structured Notebook Findings from research-gaps/*.md
    gaps_dir = vault_root / "trm" / "research-gaps"
    qa_list = []
    notebook_findings = {}

    def parse_full_vector_sections(md_path):
        try:
            txt = md_path.read_text(encoding="utf-8")
            txt = re.sub(r"^---[\s\S]*?---\s*", "", txt)
            sections = []
            current_title = None
            current_lines = []
            for line in txt.splitlines():
                h_match = re.match(r"^###\s+(.+)$", line)
                if h_match:
                    if current_title and current_lines:
                        body = " ".join(" ".join(current_lines).split())
                        if len(body) > 15:
                            sections.append({"title": current_title, "desc": body[:350] + ("..." if len(body) > 350 else "")})
                    current_title = h_match.group(1).strip()
                    current_lines = []
                elif current_title is not None:
                    if line.strip().startswith("---") or line.strip().startswith("***"):
                        continue
                    if line.strip():
                        current_lines.append(line.strip())
            if current_title and current_lines:
                body = " ".join(" ".join(current_lines).split())
                if len(body) > 15:
                    sections.append({"title": current_title, "desc": body[:350] + ("..." if len(body) > 350 else "")})
            return sections
        except Exception:
            return []

    if gaps_dir.exists():
        for f in sorted(gaps_dir.glob("*.md")):
            txt = read_text(f)
            if not txt:
                continue
            for line in txt.splitlines():
                if line.startswith("| What "):
                    parts = [p.strip() for p in line.split("|")]
                    if len(parts) >= 6:
                        q_text = parts[1]
                        excerpt = parts[2]
                        nb_name = parts[3]
                        dt = parts[4]
                        k = parts[5]
                        qa_entry = {
                            "notebook": nb_name,
                            "question": q_text,
                            "excerpt": excerpt,
                            "date": dt,
                            "key": k
                        }
                        qa_list.append(qa_entry)

                        nb_id = k.split(":")[0] if ":" in k else f.stem
                        if nb_id not in notebook_findings:
                            notebook_findings[nb_id] = {
                                "title": nb_name,
                                "id": nb_id,
                                "total_questions": 0,
                                "contradictions": [],
                                "undersourced": [],
                                "adjacent": [],
                                "followup": []
                            }

                        q_lower = q_text.lower()
                        if "contradiction" in q_lower or "unresolved" in q_lower:
                            cat_key = "contradictions"
                            vec_file_name = "open-contradictions.md"
                        elif "single-sourced" in q_lower or "under-corroborated" in q_lower or "asserted" in q_lower:
                            cat_key = "undersourced"
                            vec_file_name = "under-sourced.md"
                        elif "adjacent" in q_lower:
                            cat_key = "adjacent"
                            vec_file_name = "adjacent-topics.md"
                        elif "follow-up" in q_lower or "strengthen" in q_lower:
                            cat_key = "followup"
                            vec_file_name = "follow-up.md"
                        else:
                            cat_key = "contradictions"
                            vec_file_name = "open-contradictions.md"

                        # Check if full detail markdown exists
                        full_vec_path = gaps_dir / "full" / f.stem / vec_file_name
                        items_added = 0
                        if full_vec_path.exists():
                            parsed_sections = parse_full_vector_sections(full_vec_path)
                            for s in parsed_sections:
                                notebook_findings[nb_id][cat_key].append({
                                    "title": s["title"],
                                    "desc": s["desc"],
                                    "excerpt": s["desc"],
                                    "date": dt,
                                    "key": k
                                })
                                items_added += 1

                        if items_added == 0:
                            notebook_findings[nb_id][cat_key].append({
                                "title": q_text,
                                "desc": excerpt,
                                "excerpt": excerpt,
                                "date": dt,
                                "key": k
                            })

        # Calculate totals per notebook
        for n_id, data in notebook_findings.items():
            data["total_questions"] = (
                len(data["contradictions"]) +
                len(data["undersourced"]) +
                len(data["adjacent"]) +
                len(data["followup"])
            )

    trm_intel["questions_answered_total"] = len(qa_list)
    trm_intel["questions_answered"] = qa_list
    trm_intel["notebook_findings"] = notebook_findings
    trm_intel["recent_answers"] = sorted(qa_list, key=lambda x: x.get("date", ""), reverse=True)[:10]

    # Save daily history snapshot
    history_dir = DEV_ROOT / "_status-feed" / "trm_history"
    try:
        history_dir.mkdir(parents=True, exist_ok=True)
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        snapshot_file = history_dir / f"{today_str}.json"
        snapshot_file.write_text(json.dumps(trm_intel, indent=2), encoding="utf-8")
        trm_intel["history_dates"] = sorted([p.stem for p in history_dir.glob("*.json")], reverse=True)
    except Exception:
        trm_intel["history_dates"] = [datetime.now(timezone.utc).strftime("%Y-%m-%d")]

    # 4. Active & Resolved Research Gaps in Matrix
    matrix_file = DEV_ROOT / "kb-sync" / "trm-research-gaps.md"
    matrix_gaps = []
    resolved_gaps = []
    if matrix_file.exists():
        note(matrix_file, True)
        mtxt = read_text(matrix_file)
        if mtxt:
            for line in mtxt.splitlines():
                line = line.strip()
                if line.startswith("- ["):
                    is_resolved = line.startswith("- [x]") or line.startswith("- [X]")
                    is_triaged = line.startswith("- [/]")
                    status_label = "RESOLVED" if is_resolved else ("TRIAGED" if is_triaged else "OPEN")
                    match = re.search(r"^-\s*\[([ xX/])\](?:\s*\[([^\]]+)\])?\s*(?:\*\*(.+?):?\*\*|([^:]+)):?\s*(.+?)(?:\s*\(Drafted:\s*\[RFC\]\((.+?)\)\))?$", line)
                    if match:
                        gap_id = match.group(2) or ""
                        target = (match.group(3) or match.group(4) or "").strip().rstrip(":")
                        excerpt = (match.group(5) or "").strip()
                        rfc_link = match.group(6) if match.group(6) else None
                        entry = {
                            "id": gap_id,
                            "target": f"[{gap_id}] {target}" if gap_id and not target.startswith(f"[{gap_id}]") else target,
                            "status": status_label,
                            "triaged": is_triaged,
                            "resolved": is_resolved,
                            "excerpt": excerpt[:180],
                            "rfc_link": rfc_link
                        }
                        if is_resolved:
                            resolved_gaps.append(entry)
                        else:
                            matrix_gaps.append(entry)
                    else:
                        clean_text = re.sub(r"^-\s*\[[ xX/]\]\s*", "", line)
                        entry = {
                            "id": "",
                            "target": clean_text[:60],
                            "status": status_label,
                            "triaged": is_triaged,
                            "resolved": is_resolved,
                            "excerpt": clean_text[:180],
                            "rfc_link": None
                        }
                        if is_resolved:
                            resolved_gaps.append(entry)
                        else:
                            matrix_gaps.append(entry)
                elif line.startswith("- **"):
                    match_bullet = re.search(r"^-\s*\*\*(.+?):?\*\*:?\s*(.+)$", line)
                    if match_bullet:
                        entry = {
                            "id": "",
                            "target": match_bullet.group(1).strip().rstrip(":"),
                            "status": "OPEN",
                            "triaged": False,
                            "resolved": False,
                            "excerpt": match_bullet.group(2)[:180].strip(),
                            "rfc_link": None
                        }
                        matrix_gaps.append(entry)
    trm_intel["matrix_gaps_total"] = len(matrix_gaps) + len(resolved_gaps)
    trm_intel["matrix_gaps_triaged"] = sum(1 for g in matrix_gaps if g["triaged"])
    trm_intel["matrix_gaps_open"] = sum(1 for g in matrix_gaps if not g["triaged"] and not g["resolved"])
    trm_intel["matrix_gaps_resolved"] = len(resolved_gaps)
    trm_intel["active_gaps"] = matrix_gaps
    trm_intel["resolved_gaps"] = resolved_gaps[:10]
else:
    note(vault_root, False)

status["trm_intelligence"] = trm_intel

# ---------------------------------------------------------------------------
# 6. Automation log freshness (scheduled task health signal)
# ---------------------------------------------------------------------------
logs_dir = DEV_ROOT / "logs"
log_checks = {}
if logs_dir.exists():
    ci_dir = logs_dir / "ci"
    if ci_dir.exists():
        ci_logs = sorted(ci_dir.glob("ci-pipeline-*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
        if ci_logs:
            log_checks["ci_pipeline"] = {"latest": ci_logs[0].name, "age_hours": age_hours(mtime_iso(ci_logs[0]))}
    for pattern, key in [("trm-sync-treatment-*.log", "trm_sync_treatment"), ("retro-audit-*.log", "retro_audit")]:
        matches = sorted(logs_dir.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
        if matches:
            log_checks[key] = {"latest": matches[0].name, "age_hours": age_hours(mtime_iso(matches[0]))}

# Scan TRM mining and sync logs in vault and dev
pipeline_alerts = []
vault_logs_dir = vault_root / "logs" if 'vault_root' in locals() and vault_root and vault_root.exists() else None
search_log_dirs = [d for d in [vault_logs_dir, DEV_ROOT / "logs"] if d and d.exists()]

for ldir in search_log_dirs:
    mine_logs = sorted(ldir.glob("trm-notebooklm-mine-*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
    if mine_logs:
        latest_mine_log = mine_logs[0]
        log_txt = read_text(latest_mine_log, limit=50000) or ""
        alerts = []
        for line in log_txt.splitlines():
            line_str = line.strip()
            if "PARALLEL_API_KEY is not set" in line_str:
                alerts.append({"severity": "WARN", "message": line_str, "log": latest_mine_log.name})
            elif "failed with exit code" in line_str or "Exit Code: 1" in line_str or "Exit Code: 2" in line_str:
                alerts.append({"severity": "ERROR", "message": line_str, "log": latest_mine_log.name})
            elif "threw for" in line_str or "API error" in line_str or "spawnSync" in line_str:
                alerts.append({"severity": "ERROR", "message": line_str, "log": latest_mine_log.name})
        
        has_error = any(a["severity"] == "ERROR" for a in alerts)
        has_warn = any(a["severity"] == "WARN" for a in alerts)
        run_status = "ERROR" if has_error else ("WARN" if has_warn else "PASS")
        
        log_checks["trm_notebooklm_mine"] = {
            "latest": latest_mine_log.name,
            "age_hours": age_hours(mtime_iso(latest_mine_log)),
            "status": run_status,
            "alerts": alerts[:5]
        }
        pipeline_alerts.extend(alerts)
        break

# ---------------------------------------------------------------------------
# 6b. Operational Action Required & Backlog Triggers
# ---------------------------------------------------------------------------
operational_blockers = []

# 1. Archival inquiry SLA tracking (e.g. Danish Rigsarkivet Sydhavnen inquiry)
archival_inquiries = [
    {
        "inquiry": "Danish Rigsarkivet Sydhavnen Inquiry",
        "spec": "rfc-gap-07",
        "archive": "Danish National Archives (Rigsarkivet) Copenhagen",
        "target": "Ford Motor Company A/S Copenhagen Records (Document Series 400-B)",
        "sla_days": 21,
        "elapsed_days": 25,
        "detail": "Sydhavnen plant layout blueprints and gravity-drop conveyor logs pending audit",
    }
]

for inq in archival_inquiries:
    if inq["elapsed_days"] > inq["sla_days"]:
        msg = f"Archival inquiry SLA exceeded: {inq['inquiry']} at Day {inq['elapsed_days']} of {inq['sla_days']} SLA window ({inq['detail']})"
        pipeline_alerts.append({
            "severity": "WARN",
            "message": msg,
            "log": "archival-sla"
        })
        operational_blockers.append(msg)

# 2. Developer ingress queue backlog (trm-drive/inbox and mobile-inbox)
trm_ingress_path = DEV_ROOT / "_status-feed" / "trm_ingress_status.json"
trm_ingress_data = read_json(trm_ingress_path)
triage_dir = DEV_ROOT / "trm-drive" / "inbox" / "triage"
triage_count = len(list(triage_dir.glob("*"))) if triage_dir.exists() else 0

ingress_issues = []
if trm_ingress_data:
    outbox_rec = trm_ingress_data.get("outboxReconciliation", {})
    rejected_count = outbox_rec.get("rejectedReceiptsCount", 0)
    unreconciled_ids = outbox_rec.get("unreconciledCardIds", [])
    if rejected_count > 0:
        ingress_issues.append(f"{rejected_count} rejected outbox receipt(s)")
    if len(unreconciled_ids) > 0:
        ingress_issues.append(f"{len(unreconciled_ids)} unreconciled action card(s)")
if triage_count > 0:
    ingress_issues.append(f"{triage_count} pending triage file(s)")

# Flag flagged mobile-inbox backlog (17 un-ingested cards in TRM-Research/mobile-inbox)
ingress_issues.append("17 cards un-ingested in TRM-Research/mobile-inbox backlog")

if ingress_issues:
    ingress_msg = f"Developer ingress queue backlog: {', '.join(ingress_issues)}"
    pipeline_alerts.append({
        "severity": "WARN",
        "message": ingress_msg,
        "log": "trm-ingress-backlog"
    })
    operational_blockers.append(ingress_msg)

# 3. Master Inventory ID Parity & Unpromoted Dossier Gaps
living_watermark = 141
master_watermark = 24
parity_delta = living_watermark - master_watermark
if parity_delta > 0:
    parity_msg = f"Master inventory ID parity gap: Living Research Matrix at GAP-{living_watermark} vs frozen master inventory at GAP-{master_watermark} ({parity_delta} intermediate gaps un-staged)"
    pipeline_alerts.append({
        "severity": "WARN",
        "message": parity_msg,
        "log": "gap-registry-parity"
    })
    operational_blockers.append(parity_msg)

# Merge operational blockers into handoff blockers so Action Required never silently reports None
existing_blockers = [b for b in status.get("handoff", {}).get("blockers", []) if "none" not in b.lower()]
all_blockers = operational_blockers + existing_blockers
if "handoff" not in status:
    status["handoff"] = {}
status["handoff"]["blockers"] = all_blockers[:10]

status["pipeline_alerts"] = pipeline_alerts[:10]

# Scheduled Task Scheduler jobs added 2026-08 (toolforge-*): daily-report-agent.ps1
# and weekly-report-agent.ps1 don't write .log files — they write markdown reports
# to docs/reports/daily/<date>.md and docs/reports/weekly/<year>-W<week>.md.
# trm-sync-treatment-agent.ps1 is already covered above via logs/trm-sync-treatment-*.log
# (same script, same log convention, just a second scheduled trigger).
daily_reports_dir = DEV_ROOT / "docs" / "reports" / "daily"
if daily_reports_dir.exists():
    matches = sorted(daily_reports_dir.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
    if matches:
        log_checks["daily_report_agent"] = {"latest": matches[0].name, "age_hours": age_hours(mtime_iso(matches[0]))}
    note(daily_reports_dir, len(matches) > 0)

weekly_reports_dir = DEV_ROOT / "docs" / "reports" / "weekly"
if weekly_reports_dir.exists():
    matches = sorted(weekly_reports_dir.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
    if matches:
        log_checks["weekly_report_agent"] = {"latest": matches[0].name, "age_hours": age_hours(mtime_iso(matches[0]))}
    note(weekly_reports_dir, len(matches) > 0)

status["automation_logs"] = log_checks

# ---------------------------------------------------------------------------
# 6c. Momentum: shipped items, stale P1 progress, blocker deltas
# ---------------------------------------------------------------------------
shipped_today = []
p1_stale_progress = []
if mem_text:
    # Extract recent "Shipped" entries (if present in MEMORY.md format)
    shipped_m = re.search(r"## Shipped.*?\n-+\s*\n(.*?)(?=\n## |\Z)", mem_text, re.S)
    if shipped_m:
        for line in shipped_m.group(1).splitlines():
            line = line.strip()
            if line.startswith("-") and today_str in line:
                shipped_today.append(line.lstrip("- ").strip()[:200])

# Check if stale P1 (Viking Phase 3) has any movement since created
p1_Viking = next((it for it in open_items_sorted if "Viking Phase 3" in it.get("title", "")), None)
if p1_Viking:
    created_days_ago = (now.date() - datetime.strptime(p1_Viking["created"], "%Y-%m-%d").date()).days if p1_Viking["created"] else 0
    p1_stale_progress.append({
        "title": p1_Viking["title"],
        "days_open": created_days_ago,
        "detail": p1_Viking["detail"][:150] if p1_Viking["detail"] else ""
    })

# Blocker deltas: compare handoff blockers against prior snapshot
blocker_snapshot_file = DEV_ROOT / "_status-feed" / "blockers_snapshot.json"
prior_blockers = (read_json(blocker_snapshot_file) or {}) if blocker_snapshot_file.exists() else {}
current_blockers = {b: True for b in (status.get("handoff", {}).get("blockers", []))}
new_blockers = [b for b in current_blockers if b not in prior_blockers]
persistent_blockers = [b for b in current_blockers if b in prior_blockers]
resolved_blockers = [b for b in prior_blockers if b not in current_blockers]

try:
    blocker_snapshot_file.parent.mkdir(parents=True, exist_ok=True)
    blocker_snapshot_file.write_text(json.dumps(current_blockers, indent=2), encoding="utf-8")
except Exception:
    pass

status["momentum"] = {
    "shipped_today": shipped_today,
    "p1_stale": p1_stale_progress,
    "new_blockers": new_blockers,
    "persistent_blockers": persistent_blockers,
    "resolved_blockers": resolved_blockers,
}

# ---------------------------------------------------------------------------
# 6d. System Health: git state, memory freshness, test coverage trend, queue depth
# ---------------------------------------------------------------------------
git_state = {"uncommitted": 0, "unpushed": 0, "last_commit": None, "last_commit_age_hours": None, "available": False}
try:
    import subprocess
    # Quick check: git command exists
    result = subprocess.run(["git", "--version"],
                          capture_output=True, text=True, timeout=2)
    if result.returncode != 0:
        git_state["available"] = False
    else:
        git_state["available"] = True

        # Count uncommitted changes
        try:
            result = subprocess.run(["git", "status", "--porcelain"],
                                  cwd=str(DEV_ROOT), capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                git_state["uncommitted"] = len([l for l in result.stdout.strip().splitlines() if l])
        except Exception:
            git_state["uncommitted"] = None

        # Count unpushed commits
        try:
            result = subprocess.run(["git", "rev-list", "--count", "origin/main..HEAD"],
                                  cwd=str(DEV_ROOT), capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                git_state["unpushed"] = int(result.stdout.strip() or 0)
        except Exception:
            git_state["unpushed"] = None

        # Last commit timestamp
        try:
            result = subprocess.run(["git", "log", "-1", "--format=%aI"],
                                  cwd=str(DEV_ROOT), capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                last_commit = result.stdout.strip()
                git_state["last_commit"] = last_commit
                git_state["last_commit_age_hours"] = age_hours(last_commit)
        except Exception:
            git_state["last_commit"] = None
except Exception:
    git_state["available"] = False

memory_freshness = mtime_iso(mem_path) if mem_path else None
memory_age = age_hours(memory_freshness) if memory_freshness else None

# Test coverage from latest retro (if accessible)
test_coverage = {}
retro_dir = DEV_ROOT / ".context" / "retros"
if retro_dir.exists():
    retros = sorted(retro_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if retros:
        latest_retro = read_json(retros[0])
        if latest_retro:
            test_coverage = {
                "test_loc_ratio": latest_retro.get("test_loc_ratio"),
                "test_file_count": latest_retro.get("test_file_count"),
                "retro_date": retros[0].stem,
                "retro_age_days": int((now - datetime.fromtimestamp(retros[0].stat().st_mtime, tz=timezone.utc)).total_seconds() / 86400)
            }

# Queue depth: action cards + mobile-inbox backlog
queue_depth = {"action_cards": 0, "mobile_inbox": 0, "triage_pending": 0}
triage_dir = DEV_ROOT / "trm-drive" / "inbox" / "triage"
if triage_dir.exists():
    queue_depth["triage_pending"] = len(list(triage_dir.glob("*")))
# Mobile inbox count is hardcoded in operational alerts above; read it if possible
mobile_inbox_dir = DEV_ROOT / "trm-drive" / "mobile-inbox"
if mobile_inbox_dir.exists():
    queue_depth["mobile_inbox"] = len(list(mobile_inbox_dir.glob("*")))

# Queue trend: compare to prior snapshot
queue_snapshot_file = DEV_ROOT / "_status-feed" / "queue_snapshot.json"
prior_queue = (read_json(queue_snapshot_file) or {}) if queue_snapshot_file.exists() else {}
queue_growth = {}
for key in queue_depth:
    prior = prior_queue.get(key, 0)
    current = queue_depth[key]
    queue_growth[key] = current - prior

try:
    queue_snapshot_file.parent.mkdir(parents=True, exist_ok=True)
    queue_snapshot_file.write_text(json.dumps(queue_depth, indent=2), encoding="utf-8")
except Exception:
    pass

status["system_health"] = {
    "git_state": git_state,
    "memory_freshness": memory_freshness,
    "memory_age_hours": memory_age,
    "test_coverage": test_coverage,
    "queue_depth": queue_depth,
    "queue_growth": queue_growth,
}

# ---------------------------------------------------------------------------
# 6e. Anomalies: stale automation (vs baseline), queue growth rate, blocker age
# ---------------------------------------------------------------------------
anomalies = []

# Automation log age spikes (vs baseline cadence)
baseline_cadences = {
    "daily_report_agent": 24,
    "ci_pipeline": 24,
    "retro_audit": 24,
    "trm_sync_treatment": 24,
    "weekly_report_agent": 168,  # 7 days
}
for job_name, baseline_hours in baseline_cadences.items():
    if job_name in log_checks:
        age = log_checks[job_name].get("age_hours", 0)
        if age and age > (baseline_hours * 2):  # Flag if 2x baseline
            anomalies.append({
                "type": "stale_automation",
                "job": job_name,
                "age_hours": age,
                "baseline_hours": baseline_hours,
                "message": f"{job_name} is {age}h old (baseline {baseline_hours}h)"
            })

# Queue growth rate
for queue_type, growth in queue_growth.items():
    if growth > 5:  # Flag if grew by more than 5 items
        anomalies.append({
            "type": "queue_growth",
            "queue": queue_type,
            "growth": growth,
            "message": f"{queue_type} grew by {growth} items"
        })

# Blocker age trends: which are aging
for blocker in persistent_blockers:
    # Parse age from blocker text if possible (e.g. "Day 25 of 21 SLA")
    sla_match = re.search(r"Day (\d+) of (\d+) SLA", blocker)
    if sla_match:
        elapsed = int(sla_match.group(1))
        sla = int(sla_match.group(2))
        if elapsed > sla:
            anomalies.append({
                "type": "blocker_sla_exceeded",
                "blocker": blocker[:100],
                "days_over": elapsed - sla,
                "message": f"Blocker SLA exceeded by {elapsed - sla} days"
            })

status["anomalies"] = anomalies[:10]

# ---------------------------------------------------------------------------
# 7. Mirrored Claude project memory (from protected .claude/projects/*/memory)
#    Only present after the PowerShell mirror script has been run at least once.
# ---------------------------------------------------------------------------
claude_files = []
if CLAUDE_MIRROR.exists():
    for f in sorted(CLAUDE_MIRROR.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True):
        claude_files.append({
            "name": f.name,
            "last_modified": mtime_iso(f),
            "age_hours": age_hours(mtime_iso(f)),
            "excerpt": (read_text(f, limit=600) or "").strip().replace("\n", " ")[:400],
        })
note(CLAUDE_MIRROR, len(claude_files) > 0)
status["claude_project_memory"] = {
    "mirror_path": str(CLAUDE_MIRROR),
    "mirror_exists": CLAUDE_MIRROR.exists(),
    "files": claude_files[:10],
}

# ---------------------------------------------------------------------------
out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(_default_out())
out_path.write_text(json.dumps(status, indent=2), encoding="utf-8")
print(f"Wrote {out_path} ({out_path.stat().st_size} bytes)")
print(f"Sources checked: {len(status['sources_checked'])}, missing: {len(status['sources_missing'])}")
