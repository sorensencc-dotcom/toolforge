import * as fs from 'node:fs';
import * as path from 'node:path';
import { triageCard } from '../../../modules/triage/card-triage-engine.mjs';

export async function runTrmTriage(options = {}) {
  const rootDir = options.rootDir || path.resolve('.');
  const pendingDir = path.join(rootDir, '.harness', 'tasks', 'pending');
  const archiveDir = path.join(rootDir, '.harness', 'tasks', 'archive');

  const files = [];
  if (fs.existsSync(pendingDir)) {
    for (const f of fs.readdirSync(pendingDir)) {
      if (f.endsWith('.md') || f.endsWith('.gdoc')) {
        files.push({ file: f, dir: pendingDir, status: 'STAGED' });
      }
    }
  }

  if (fs.existsSync(archiveDir)) {
    for (const f of fs.readdirSync(archiveDir)) {
      if (f.endsWith('.md') || f.endsWith('.gdoc')) {
        files.push({ file: f, dir: archiveDir, status: 'ARCHIVED' });
      }
    }
  }

  const triagedCards = [];
  for (const item of files) {
    try {
      const fullPath = path.join(item.dir, item.file);
      const content = fs.readFileSync(fullPath, 'utf8');

      let parsedJson = null;
      try {
        parsedJson = JSON.parse(content);
      } catch {}

      const cardObj = {
        id: item.file.replace(/\.(md|gdoc)$/, ''),
        file: item.file,
        status: item.status,
        content,
        ...(parsedJson || {})
      };
      const triaged = await triageCard(cardObj, { ollamaUrl: options.ollamaUrl });
      triagedCards.push(triaged);
    } catch (e) {
      triagedCards.push({
        id: item.file,
        error: e.message,
        status: 'ERROR'
      });
    }
  }

  return {
    totalCards: files.length,
    triagedCards
  };
}

if (process.argv[1] && process.argv[1].endsWith('index.mjs')) {
  runTrmTriage({ dryRun: true })
    .then(res => {
      console.log(JSON.stringify(res, null, 2));
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
