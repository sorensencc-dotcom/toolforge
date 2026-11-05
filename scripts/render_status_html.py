#!/usr/bin/env python3
"""
Renders daily_status.json into a self-contained CIC-styled HTML status page.
No external JS dependencies; light/dark theme via prefers-color-scheme +
data-theme override toggle. Cast Iron Charlie design system per
Global Operating Rules Sec. 10.1.
"""
import html, json, os, platform, sys
from pathlib import Path
from datetime import datetime, timezone

def _default_json():
    return r"C:\dev\_status-feed\daily_status.json" if platform.system() == "Windows" \
        else "/sessions/awesome-dreamy-dirac/mnt/outputs/daily_status.json"

def _default_out():
    if platform.system() == "Windows":
        return r"C:\Users\soren\OneDrive\Documents\Claude\Projects\CIC\CIC_Daily_Status.html"
    return "/sessions/awesome-dreamy-dirac/mnt/outputs/CIC_Daily_Status.html"

in_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(_default_json())
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(_default_out())

data = json.loads(in_path.read_text(encoding="utf-8"))
def esc(val):
    if val is None:
        return ""
    return html.escape(str(val))

def fmt_age(hours):
    if hours is None:
        return "unknown"
    if hours < 1:
        return f"{int(hours*60)}m ago"
    if hours < 48:
        return f"{hours:.1f}h ago"
    return f"{hours/24:.1f}d ago"

def status_badge(label, tone):
    return f'<span class="badge badge--{tone}">{esc(label)}</span>'

def health_tone_for_age(hours, warn_at, bad_at):
    if hours is None:
        return "unknown"
    if hours <= warn_at:
        return "good"
    if hours <= bad_at:
        return "warn"
    return "bad"

kb = data.get("kb_sync", {})
todos = data.get("todos", {})
mem = data.get("memory", {})
handoff = data.get("handoff", {})
trm = data.get("trm_pipeline", {})
trm_intel = data.get("trm_intelligence", {})
autolog = data.get("automation_logs", {})
claude_mem = data.get("claude_project_memory", {})

generated_at = data.get("generated_at", "")
try:
    gen_dt = datetime.fromisoformat(generated_at)
    generated_display = gen_dt.strftime("%A, %B %d %Y — %H:%M UTC")
except Exception:
    generated_display = generated_at

# --- KB sync tone -----------------------------------------------------
kb_sync_tone = "good" if kb.get("sync_status") == "SUCCESS" else ("bad" if kb.get("sync_status") else "unknown")
kb_sync_age_tone = health_tone_for_age(kb.get("last_sync_age_hours"), 24, 72)
drift_tone = "good" if kb.get("drift_status") == "NO_DRIFT" else ("warn" if kb.get("drift_status") == "DRIFT_DETECTED" else "unknown")

# --- Priority counts ----------------------------------------------------
counts = todos.get("counts_by_priority", {})
p0 = counts.get("P0", 0)
p1 = counts.get("P1", 0)
p2 = counts.get("P2", 0)
punk = counts.get("P?", 0)

def priority_badge(p):
    tone = {"P0": "bad", "P1": "warn", "P2": "neutral", "P?": "neutral"}.get(p, "neutral")
    return status_badge(p, tone)

top_open_rows = ""
for item in todos.get("top_open", []):
    created = f' <span class="meta">(created {esc(item["created"])})</span>' if item.get("created") else ""
    detail = f'<div class="item-detail">{esc(item.get("detail",""))}</div>' if item.get("detail") else ""
    top_open_rows += f"""
      <li class="item item--{item.get('priority','P?').lower().replace('?','unk')}">
        <div class="item-head">{priority_badge(item.get('priority','P?'))} <span class="item-title">{esc(item.get('title',''))}</span>{created}</div>
        {detail}
      </li>"""

if not top_open_rows:
    top_open_rows = '<li class="item item--empty">No open action items found in TODOS.md.</li>'

closed_today_rows = "".join(f'<li>{esc(x)}</li>' for x in todos.get("closed_today", [])) or '<li class="meta">Nothing closed yet today.</li>'

current_work_rows = "".join(f'<li>{esc(x)}</li>' for x in mem.get("current_work", [])) or '<li class="meta">No "Current Work" section found.</li>'

next_steps_rows = "".join(f'<li>{esc(x)}</li>' for x in handoff.get("next_steps", [])) or '<li class="meta">No next steps recorded.</li>'
blockers_list = handoff.get("blockers", [])
has_real_blocker = any("none" not in b.lower() for b in blockers_list) if blockers_list else False
blockers_rows = "".join(f'<li>{esc(x)}</li>' for x in blockers_list) or '<li class="meta">None recorded.</li>'
blockers_tone = "bad" if has_real_blocker else "good"

drifted_files_rows = "".join(f'<li><code>{esc(x)}</code></li>' for x in kb.get("drifted_files", [])) or '<li class="meta">None.</li>'

claude_mem_rows = ""
if claude_mem.get("mirror_exists"):
    for f in claude_mem.get("files", []):
        claude_mem_rows += f"""
          <li class="item">
            <div class="item-head"><span class="item-title">{esc(f['name'])}</span> <span class="meta">{fmt_age(f.get('age_hours'))}</span></div>
            <div class="item-detail">{esc(f.get('excerpt',''))}</div>
          </li>"""
    if not claude_mem_rows:
        claude_mem_rows = '<li class="item item--empty">Mirror folder exists but has no .md files yet.</li>'
else:
    claude_mem_rows = f'''<li class="item item--empty">Mirror not found at <code>{esc(claude_mem.get("mirror_path",""))}</code>.
      Run <code>Mirror-ClaudeMemory.ps1</code> once to pull memory files from the protected
      <code>.claude\\projects\\c--dev\\memory</code> folder.</li>'''

def autolog_row(key, label, warn_at=30, bad_at=200):
    entry = autolog.get(key)
    if not entry:
        return f'<tr><td>{esc(label)}</td><td colspan="2" class="meta">No log found</td></tr>'
    tone = health_tone_for_age(entry.get("age_hours"), warn_at, bad_at)
    return f'<tr><td>{esc(label)}</td><td><code>{esc(entry.get("latest",""))}</code></td><td>{status_badge(fmt_age(entry.get("age_hours")), tone)}</td></tr>'

sources_checked = data.get("sources_checked", [])
sources_missing = data.get("sources_missing", [])
sources_footer = "".join(f'<li><code>{esc(Path(s).name or s)}</code></li>' for s in sources_checked)
missing_footer = "".join(f'<li><code>{esc(s)}</code></li>' for s in sources_missing) or '<li class="meta">None — all sources found.</li>'

# --- TRM Intelligence Section -----------------------------------------
trm_topics_total = trm_intel.get("topics_total", 0)
trm_qa_total = trm_intel.get("questions_answered_total", 0)
trm_gaps_total = trm_intel.get("matrix_gaps_total", 0)
trm_gaps_triaged = trm_intel.get("matrix_gaps_triaged", 0)
trm_topics_created = trm_intel.get("topics_created", [])
trm_topics_deleted = trm_intel.get("topics_deleted", [])

topics_delta_badge = ""
if trm_topics_created:
    topics_delta_badge += f' <span class="badge badge--good">+{len(trm_topics_created)} new</span>'
if trm_topics_deleted:
    topics_delta_badge += f' <span class="badge badge--bad">-{len(trm_topics_deleted)} deleted</span>'

topics_chips = " ".join(f'<code>{esc(t["name"])}</code>' for t in trm_intel.get("topics", [])) or '<span class="meta">No topics registered.</span>'

notebook_rows = ""
for nb in trm_intel.get("notebooks", []):
    age_tone = health_tone_for_age(nb.get("last_mined_age_hours"), 24, 72)
    q_badge = f' <span class="badge badge--bad">{nb["quarantined"]} quarantined</span>' if nb.get("quarantined", 0) > 0 else ""
    notebook_rows += f"""
      <tr>
        <td><strong>{esc(nb.get('title',''))}</strong>{q_badge}</td>
        <td><code>{esc(nb.get('id',''))}</code></td>
        <td>{esc(str(nb.get('sources_count',0)))} tracked</td>
        <td>{status_badge(fmt_age(nb.get('last_mined_age_hours')), age_tone)}</td>
      </tr>"""
if not notebook_rows:
    notebook_rows = '<tr><td colspan="4" class="meta">No notebooks registered in notebooklm-registry.json.</td></tr>'

qa_rows = ""
for qa in trm_intel.get("recent_answers", []):
    qa_rows += f"""
      <tr>
        <td><strong>{esc(qa.get('notebook',''))}</strong></td>
        <td>{esc(qa.get('question',''))}</td>
        <td>{esc(qa.get('excerpt',''))}</td>
        <td><span class="meta">{esc(qa.get('date',''))}</span></td>
      </tr>"""
if not qa_rows:
    qa_rows = '<tr><td colspan="4" class="meta">No answered questions found in research gaps.</td></tr>'

gaps_rows = ""
for gap in trm_intel.get("active_gaps", []):
    triaged_badge = '<span class="badge badge--good">TRIAGED</span>' if gap.get("triaged") else '<span class="badge badge--warn">OPEN</span>'
    rfc_note = f' · <a href="{esc(gap["rfc_link"])}" target="_blank" rel="noopener">RFC Note</a>' if gap.get("rfc_link") else ""
    gaps_rows += f"""
      <li class="item item--{'good' if gap.get('triaged') else 'p1'}">
        <div class="item-head">{triaged_badge} <span class="item-title">{esc(gap.get('target',''))}</span>{rfc_note}</div>
        <div class="item-detail">{esc(gap.get('excerpt',''))}</div>
      </li>"""
if not gaps_rows:
    gaps_rows = '<li class="item item--empty">No active research gaps found.</li>'

resolved_gaps_rows = ""
for rgap in trm_intel.get("resolved_gaps", []):
    resolved_gaps_rows += f"""
      <li class="item item--good">
        <div class="item-head"><span class="badge badge--good">RESOLVED</span> <span class="item-title">{esc(rgap.get('target',''))}</span></div>
        <div class="item-detail">{esc(rgap.get('excerpt',''))}</div>
      </li>"""
if not resolved_gaps_rows:
    resolved_gaps_rows = '<li class="meta">No resolved gaps recorded yet today.</li>'

# --- Pipeline Alerts --------------------------------------------------
pipeline_alerts = data.get("pipeline_alerts", [])
pipeline_alerts_rows = ""
for alert in pipeline_alerts:
    sev = alert.get("severity", "WARN")
    tone = "bad" if sev == "ERROR" else "warn"
    pipeline_alerts_rows += f"""
      <li class="item item--{tone}">
        <div class="item-head">{status_badge(sev, tone)} <span class="item-title">{esc(alert.get('message',''))}</span></div>
        <div class="item-detail meta">Source log: <code>{esc(alert.get('log',''))}</code></div>
      </li>"""
if not pipeline_alerts_rows:
    pipeline_alerts_rows = '<li class="meta">No active pipeline alerts or degraded execution errors recorded.</li>'

html_out = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CIC + Rewrite Labs — Daily Project Status</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Baskerville&family=Barlow:wght@400;500;600&display=swap');

  :root {{
    --ember: #8B4513;
    --rust: #A0522D;
    --brass: #D4AF37;
    --charcoal: #2C2C2C;
    --offwhite: #F5F3EF;
    --sage: #9B9B8F;

    --bg: var(--offwhite);
    --surface: #FFFFFF;
    --text: var(--charcoal);
    --text-muted: #5A5850;
    --border: #DDD9CE;
    --accent: var(--ember);
    --accent-2: var(--rust);
    --good: #3F6E4A;
    --good-bg: #E7F0E4;
    --warn: #8A6414;
    --warn-bg: #FBF0D9;
    --bad: #9C3B2E;
    --bad-bg: #F7E3DF;
    --neutral: #5A5850;
    --neutral-bg: #EDEBE3;
    --focus-ring: #1D6FA5;
  }}

  [data-theme="dark"] {{
    --bg: #1B1917;
    --surface: #252220;
    --text: #EEEAE1;
    --text-muted: #B8B2A4;
    --border: #3A362F;
    --accent: var(--brass);
    --accent-2: #C98A4B;
    --good: #7FBB8B;
    --good-bg: #23301F;
    --warn: #E0BB5C;
    --warn-bg: #332C15;
    --bad: #E48070;
    --bad-bg: #3A2320;
    --neutral: #B8B2A4;
    --neutral-bg: #2C2A26;
    --focus-ring: #6CB6E8;
  }}

  @media (prefers-color-scheme: dark) {{
    :root:not([data-theme="light"]) {{
      --bg: #1B1917;
      --surface: #252220;
      --text: #EEEAE1;
      --text-muted: #B8B2A4;
      --border: #3A362F;
      --accent: var(--brass);
      --accent-2: #C98A4B;
      --good: #7FBB8B;
      --good-bg: #23301F;
      --warn: #E0BB5C;
      --warn-bg: #332C15;
      --bad: #E48070;
      --bad-bg: #3A2320;
      --neutral: #B8B2A4;
      --neutral-bg: #2C2A26;
      --focus-ring: #6CB6E8;
    }}
  }}

  * {{ box-sizing: border-box; }}

  @media (prefers-reduced-motion: reduce) {{
    * {{ animation: none !important; transition: none !important; }}
  }}

  body {{
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: 'Baskerville', Georgia, 'Times New Roman', serif;
    line-height: 1.55;
  }}

  .wrap {{
    max-width: 920px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
  }}

  header.page-head {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    border-bottom: 2px solid var(--accent);
    padding-bottom: 1.25rem;
    margin-bottom: 2rem;
  }}

  h1 {{
    font-family: 'Playfair Display', Georgia, serif;
    font-weight: 700;
    font-size: 1.9rem;
    margin: 0 0 0.25rem;
    text-wrap: balance;
    letter-spacing: 0.01em;
  }}

  .subtitle {{
    font-family: 'Barlow', sans-serif;
    color: var(--text-muted);
    font-size: 0.95rem;
    margin: 0;
  }}

  button#theme-toggle {{
    font-family: 'Barlow', sans-serif;
    font-size: 0.85rem;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 0.5rem 0.9rem;
    border-radius: 4px;
    cursor: pointer;
  }}
  button#theme-toggle:hover {{ border-color: var(--accent); }}
  button#theme-toggle:focus-visible, a:focus-visible {{
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }}

  section {{
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1.5rem 1.75rem;
    margin-bottom: 1.5rem;
  }}

  h2 {{
    font-family: 'Playfair Display', Georgia, serif;
    font-weight: 600;
    font-size: 1.25rem;
    margin: 0 0 1rem;
    color: var(--accent);
  }}

  h3 {{
    font-family: 'Barlow', sans-serif;
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 1.25rem 0 0.5rem;
  }}

  .kpi-row {{
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }}
  .kpi {{
    font-family: 'Barlow', sans-serif;
    background: var(--neutral-bg);
    border-radius: 5px;
    padding: 0.6rem 1rem;
    flex: 1 1 140px;
    min-width: 130px;
  }}
  .kpi .kpi-label {{ font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }}
  .kpi .kpi-value {{ font-size: 1.35rem; font-weight: 600; color: var(--text); }}

  .badge {{
    font-family: 'Barlow', sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    display: inline-block;
  }}
  .badge--good {{ background: var(--good-bg); color: var(--good); }}
  .badge--warn {{ background: var(--warn-bg); color: var(--warn); }}
  .badge--bad {{ background: var(--bad-bg); color: var(--bad); }}
  .badge--neutral, .badge--unknown {{ background: var(--neutral-bg); color: var(--neutral); }}

  ul.itemlist {{ list-style: none; margin: 0; padding: 0; }}
  li.item {{
    border-left: 3px solid var(--border);
    padding: 0.5rem 0 0.5rem 0.9rem;
    margin-bottom: 0.6rem;
  }}
  li.item--p0 {{ border-left-color: var(--bad); }}
  li.item--p1 {{ border-left-color: var(--warn); }}
  li.item--p2, li.item--unk {{ border-left-color: var(--sage); }}
  li.item--empty {{ border-left-color: var(--border); color: var(--text-muted); font-style: italic; }}

  .item-head {{ display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }}
  .item-title {{ font-weight: 600; }}
  .item-detail {{ font-family: 'Barlow', sans-serif; font-size: 0.88rem; color: var(--text-muted); margin-top: 0.15rem; }}
  .meta {{ font-family: 'Barlow', sans-serif; font-size: 0.78rem; color: var(--text-muted); }}

  ul.plain {{ margin: 0; padding-left: 1.2rem; }}
  ul.plain li {{ margin-bottom: 0.35rem; font-family: 'Barlow', sans-serif; font-size: 0.92rem; }}

  table.autolog {{
    width: 100%;
    border-collapse: collapse;
    font-family: 'Barlow', sans-serif;
    font-size: 0.88rem;
  }}
  table.autolog th, table.autolog td {{
    text-align: left;
    padding: 0.45rem 0.6rem;
    border-bottom: 1px solid var(--border);
  }}
  table.autolog th {{ color: var(--text-muted); font-weight: 600; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.04em; }}

  code {{
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.85em;
    background: var(--neutral-bg);
    padding: 0.05em 0.35em;
    border-radius: 3px;
    word-break: break-word;
  }}

  footer {{
    font-family: 'Barlow', sans-serif;
    font-size: 0.78rem;
    color: var(--text-muted);
    border-top: 1px solid var(--border);
    padding-top: 1rem;
    margin-top: 2rem;
  }}
  footer details summary {{ cursor: pointer; color: var(--accent); }}
  footer ul.plain {{ columns: 2; margin-top: 0.5rem; }}

  @media (max-width: 600px) {{
    footer ul.plain {{ columns: 1; }}
    header.page-head {{ flex-direction: column; }}
  }}
</style>
</head>
<body>
<div class="wrap">

  <header class="page-head">
    <div>
      <h1>CIC + Rewrite Labs — Daily Project Status</h1>
      <p class="subtitle">Generated {esc(generated_display)}</p>
    </div>
    <button id="theme-toggle" type="button" aria-label="Toggle color theme">Toggle theme</button>
  </header>

  <section aria-labelledby="kb-sync-h">
    <h2 id="kb-sync-h">KB Sync Status</h2>
    <div class="kpi-row">
      <div class="kpi">
        <div class="kpi-label">Last Sync</div>
        <div class="kpi-value">{status_badge(kb.get('sync_status','UNKNOWN'), kb_sync_tone)}</div>
        <div class="meta">{fmt_age(kb.get('last_sync_age_hours'))}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Files Synced</div>
        <div class="kpi-value">{esc(str(kb.get('file_count','—')))}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Drift Status</div>
        <div class="kpi-value">{status_badge(kb.get('drift_status','UNKNOWN'), drift_tone)}</div>
        <div class="meta">{esc(str(kb.get('drift_stale_pages',0)))} stale page(s) · checked {fmt_age(kb.get('drift_age_hours'))}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Coverage</div>
        <div class="kpi-value">{esc(str(kb.get('coverage_pct','—')))}%</div>
        <div class="meta">Link health: {esc(str(kb.get('link_health_pct','—')))}%</div>
      </div>
    </div>
    <h3>Drifted Files</h3>
    <ul class="plain">{drifted_files_rows}</ul>
  </section>

  <section aria-labelledby="todos-h">
    <h2 id="todos-h">Open Action Items — TODOS.md</h2>
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">Total Open</div><div class="kpi-value">{esc(str(todos.get('total_open',0)))}</div></div>
      <div class="kpi"><div class="kpi-label">P0</div><div class="kpi-value">{esc(str(p0))}</div></div>
      <div class="kpi"><div class="kpi-label">P1</div><div class="kpi-value">{esc(str(p1))}</div></div>
      <div class="kpi"><div class="kpi-label">P2 / Untagged</div><div class="kpi-value">{esc(str(p2+punk))}</div></div>
    </div>
    <h3>Top Open Items (by priority)</h3>
    <ul class="itemlist">{top_open_rows}</ul>
    <h3>Closed Today</h3>
    <ul class="plain">{closed_today_rows}</ul>
  </section>

  <section aria-labelledby="handoff-h">
    <h2 id="handoff-h">Latest Handoff — {esc(handoff.get('date') or 'undated')}</h2>
    <div class="kpi-row">
      <div class="kpi">
        <div class="kpi-label">Blockers</div>
        <div class="kpi-value">{status_badge('None' if not has_real_blocker else 'Open', blockers_tone)}</div>
      </div>
    </div>
    <h3>Blockers</h3>
    <ul class="plain">{blockers_rows}</ul>
    <h3>Next Steps</h3>
    <ul class="plain">{next_steps_rows}</ul>
  </section>

  <section aria-labelledby="memory-h">
    <h2 id="memory-h">Current Work — memory/MEMORY.md</h2>
    <ul class="plain">{current_work_rows}</ul>
  </section>

  <section aria-labelledby="trm-h">
    <h2 id="trm-h">TRM Pipeline Freshness</h2>
    <div class="kpi-row">
      <div class="kpi">
        <div class="kpi-label">Latest Sync Report</div>
        <div class="kpi-value">{status_badge(fmt_age(trm.get('run_age_hours')), health_tone_for_age(trm.get('run_age_hours'), 30, 168))}</div>
        <div class="meta"><code>{esc(trm.get('latest_report','—'))}</code></div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Fact Key Collisions</div>
        <div class="kpi-value">{esc(str(trm.get('fact_key_collisions','—')))}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Partial Run</div>
        <div class="kpi-value">{esc(str(trm.get('partial_run','—')))}</div>
      </div>
    </div>
  </section>

  <section aria-labelledby="trm-intel-h">
    <h2 id="trm-intel-h">TRM Research Gaps & Topic Intelligence</h2>
    <div class="kpi-row">
      <div class="kpi">
        <div class="kpi-label">Vault Topics</div>
        <div class="kpi-value">{esc(str(trm_topics_total))}{topics_delta_badge}</div>
        <div class="meta">Active topic models in vault</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Questions Answered</div>
        <div class="kpi-value">{esc(str(trm_qa_total))}</div>
        <div class="meta">Across {esc(str(trm_intel.get('notebooks_total', 11)))} NotebookLM notebooks</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Active Gaps</div>
        <div class="kpi-value">{esc(str(trm_intel.get('matrix_gaps_total', 0)))}</div>
        <div class="meta">{esc(str(trm_intel.get('matrix_gaps_triaged', 0)))} triaged · {esc(str(trm_intel.get('matrix_gaps_resolved', 0)))} resolved</div>
      </div>
    </div>

    <h3>Monitored NotebookLM Notebooks</h3>
    <table class="autolog" style="margin-bottom: 1.25rem;">
      <thead><tr><th>Notebook</th><th>Identifier</th><th>Tracked Sources</th><th>Last Mined</th></tr></thead>
      <tbody>{notebook_rows}</tbody>
    </table>

    <h3>Active Vault Topics</h3>
    <div style="margin-bottom: 1rem; line-height: 1.8;">{topics_chips}</div>

    <h3>Recently Answered Research Questions (NotebookLM)</h3>
    <table class="autolog" style="margin-bottom: 1.25rem;">
      <thead><tr><th>Notebook</th><th>Question</th><th>Answer Excerpt</th><th>Date</th></tr></thead>
      <tbody>{qa_rows}</tbody>
    </table>

    <h3>Active & Triaged Research Gaps</h3>
    <ul class="itemlist">{gaps_rows}</ul>

    <h3>Resolved Gaps (Corroborated by Vault Facts)</h3>
    <ul class="itemlist">{resolved_gaps_rows}</ul>
  </section>

  <section aria-labelledby="automation-h">
    <h2 id="automation-h">Scheduled Automation Health</h2>
    <table class="autolog">
      <thead><tr><th>Job</th><th>Latest Log</th><th>Freshness</th></tr></thead>
      <tbody>
        {autolog_row('ci_pipeline', 'CI Pipeline')}
        {autolog_row('daily_report_agent', 'Daily Report Agent', warn_at=30, bad_at=48)}
        {autolog_row('weekly_report_agent', 'Weekly Report Agent', warn_at=192, bad_at=216)}
        {autolog_row('trm_notebooklm_mine', 'TRM NotebookLM Mine', warn_at=192, bad_at=216)}
        {autolog_row('trm_sync_treatment', 'TRM Sync Treatment')}
        {autolog_row('retro_audit', 'Retro Audit')}
      </tbody>
    </table>

    <h3>Pipeline Alerts & Diagnostic Warnings</h3>
    <ul class="itemlist">{pipeline_alerts_rows}</ul>
  </section>

  <section aria-labelledby="claude-mem-h">
    <h2 id="claude-mem-h">Claude Project Memory (mirrored)</h2>
    <ul class="itemlist">{claude_mem_rows}</ul>
  </section>

  <footer>
    <details>
      <summary>Sources checked ({len(sources_checked)}) / missing ({len(sources_missing)})</summary>
      <ul class="plain">{sources_footer}</ul>
      <strong>Missing:</strong>
      <ul class="plain">{missing_footer}</ul>
    </details>
  </footer>

</div>

<script>
  (function() {{
    var btn = document.getElementById('theme-toggle');
    var root = document.documentElement;
    var stored = null;
    try {{ stored = window.localStorage.getItem('cic-status-theme'); }} catch (e) {{}}
    if (stored) root.setAttribute('data-theme', stored);
    btn.addEventListener('click', function() {{
      var current = root.getAttribute('data-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var next;
      if (!current) {{ next = prefersDark ? 'light' : 'dark'; }}
      else {{ next = current === 'dark' ? 'light' : 'dark'; }}
      root.setAttribute('data-theme', next);
      try {{ window.localStorage.setItem('cic-status-theme', next); }} catch (e) {{}}
    }});
  }})();
</script>
</body>
</html>
"""

out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(html_out, encoding="utf-8")
print(f"Wrote {out_path} ({out_path.stat().st_size} bytes)")
