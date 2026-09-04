import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export function renderDiagram(htmlPath, pngPath, width = 1150, height = 500) {
  const fileUrl = 'file:///' + path.resolve(htmlPath).replace(/\\/g, '/');
  execFileSync(chromePath, [
    '--headless',
    '--disable-gpu',
    --window-size=,,
    '--hide-scrollbars',
    --screenshot=,
    fileUrl
  ], { stdio: 'inherit' });
}

export function wrapHtml({ title, subtitle, badge, width = 1100, height = 480, svgContent }) {
  return <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>\</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Geist+Mono:wght@400;600&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --color-paper:   #f2ece2;
      --color-ink:     #2c2420;
      --color-muted:   #5c5349;
      --color-accent:  #c4501a;
      --font-sans:     'Barlow Condensed', system-ui, sans-serif;
      --font-serif:    'Playfair Display', serif;
      --font-mono:     'Geist Mono', ui-monospace, monospace;
    }
    body {
      font-family: var(--font-sans);
      background: var(--color-paper);
      color: var(--color-ink);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2.5rem 2rem;
    }
    .frame {
      max-width: \px;
      width: 100%;
      background: #f2ece2;
      border: 2px solid #5c5349;
      padding: 32px;
      box-shadow: 6px 6px 0px #5c5349;
    }
    .header {
      border-bottom: 2px solid #c4501a;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .title-group h1 {
      font-family: var(--font-serif);
      font-size: 28px;
      font-weight: 700;
      color: var(--color-ink);
      letter-spacing: -0.5px;
    }
    .title-group p {
      font-family: var(--font-sans);
      font-size: 14px;
      color: var(--color-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 4px;
    }
    .badge {
      background-color: var(--color-ink);
      color: var(--color-paper);
      font-family: var(--font-mono);
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 2px;
      letter-spacing: 0.5px;
    }
    svg { width: 100%; display: block; height: auto; }
    .footer-note {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px dashed var(--color-muted);
      display: flex;
      justify-content: space-between;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-muted);
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="header">
      <div class="title-group">
        <h1>\</h1>
        <p>\</p>
      </div>
      <div class="badge">\</div>
    </div>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \ \">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#2c2420"/>
        </marker>
        <marker id="arrow-accent" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#c4501a"/>
        </marker>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#2c2420" flood-opacity="0.08"/>
        </filter>
      </defs>
      \
    </svg>
    <div class="footer-note">
      <span>SYSTEM: ARCHITECTURE SPECIFICATION</span>
      <span>PALETTE: CATHRYN LAVERY WARM PAPER (#F2ECE2 / #C4501A)</span>
    </div>
  </div>
</body>
</html>;
}
