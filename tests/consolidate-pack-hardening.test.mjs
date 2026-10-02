import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  consolidatePacks,
  extractFrontmatter,
  serializePackItem,
  formatProvenanceHeader,
  partitionPackItems,
  getCanonicalPacks,
  MAX_PACK_BYTES
} from '../scripts/consolidate-pack.mjs';

describe('Knowledge Pack Compaction & Ingestion Hardening Suite', () => {

  test('1. extractFrontmatter and serializePackItem preserve YAML frontmatter intact', () => {
    const rawContent = [
      '---',
      'title: "Willow Run B-24 Production Log"',
      'category: willow-run',
      'source_title: "Ford Willow Run Records"',
      'repository: cic-historical',
      'document_date: 1943-05-12',
      'verification_status: verified',
      'author: "Charles E. Sorensen"',
      '---',
      '',
      '# Willow Run Assembly Summary',
      '',
      'Production metrics for May 1943 at the Willow Run bomber facility.',
      'One B-24 Liberator rolled off the line every 63 minutes.'
    ].join('\n');

    const fm = extractFrontmatter(rawContent);
    assert.equal(fm.title, 'Willow Run B-24 Production Log');
    assert.equal(fm.category, 'willow-run');
    assert.equal(fm.source_title, 'Ford Willow Run Records');
    assert.equal(fm.repository, 'cic-historical');
    assert.equal(fm.document_date, '1943-05-12');
    assert.equal(fm.verification_status, 'verified');
    assert.equal(fm.author, 'Charles E. Sorensen');

    const item = {
      relPath: 'wiki/willow-run/production-log.md',
      filePath: '/tmp/wiki/willow-run/production-log.md',
      content: rawContent,
      frontmatter: fm,
      sha256: crypto.createHash('sha256').update(rawContent.trim()).digest('hex'),
      sourceType: 'markdown'
    };

    const serialized = serializePackItem(item);

    // Verify provenance header is present
    assert.ok(serialized.includes('=== PROVENANCE ==='));
    assert.ok(serialized.includes('source_path: wiki/willow-run/production-log.md'));
    assert.ok(serialized.includes('source_title: Ford Willow Run Records'));
    assert.ok(serialized.includes('document_date: 1943-05-12'));
    assert.ok(serialized.includes('verification_status: verified'));

    // Verify frontmatter delimiters and content are intact
    assert.ok(serialized.includes('---\ntitle: "Willow Run B-24 Production Log"'));
    assert.ok(serialized.includes('category: willow-run'));
    assert.ok(serialized.includes('--- END OF FILE: wiki/willow-run/production-log.md ---'));
  });

  test('2. Indented code blocks, nested Markdown lists, blockquotes, and pipe tables retain exact whitespace', () => {
    const complexFormatting = [
      '---',
      'category: willow-run',
      'source_title: "Technical Spec"',
      '---',
      '# Engineering Specifications',
      '',
      '## Indented Code Block',
      '    function calculateAirframeWeight(span, chord) {',
      '      // 4-space indented code block',
      '      const wingArea = span * chord;',
      '      return wingArea * 12.5;',
      '    }',
      '',
      '## Nested Markdown Lists',
      '- Level 1 Component A',
      '  - Level 2 Sub-assembly A1',
      '    - Level 3 Fastener A1-a',
      '  - Level 2 Sub-assembly A2',
      '- Level 1 Component B',
      '  1. Step 1 Precision Jig Alignment',
      '     a. Substep 1.1 Micro-calibration',
      '  2. Step 2 Riveting',
      '',
      '## Blockquotes',
      '> Historical Log quote: Sorensen oversaw the line.',
      '> > Nested quotation from production superintendent.',
      '> Final line of blockquote.',
      '',
      '## Pipe Tables',
      '| Station | Component      | Cycle Time (min) | Status |',
      '|:--------|:---------------|----------------:|:------:|',
      '| 01      | Center Wing    |              55 | Active |',
      '| 02      | Nose Turret    |              32 | Active |',
      '| 03      | Empennage      |              45 | Ready  |'
    ].join('\n');

    const item = {
      relPath: 'wiki/willow-run/specs.md',
      content: complexFormatting,
      frontmatter: extractFrontmatter(complexFormatting),
      sha256: crypto.createHash('sha256').update(complexFormatting).digest('hex'),
      sourceType: 'markdown'
    };

    const serialized = serializePackItem(item);

    // Exact whitespace assertions
    assert.ok(
      serialized.includes('    function calculateAirframeWeight(span, chord) {\n      // 4-space indented code block\n      const wingArea = span * chord;\n      return wingArea * 12.5;\n    }'),
      'Indented code block whitespace must be strictly preserved'
    );

    assert.ok(
      serialized.includes('- Level 1 Component A\n  - Level 2 Sub-assembly A1\n    - Level 3 Fastener A1-a\n  - Level 2 Sub-assembly A2\n- Level 1 Component B'),
      'Nested Markdown list indentation must be strictly preserved'
    );

    assert.ok(
      serialized.includes('> Historical Log quote: Sorensen oversaw the line.\n> > Nested quotation from production superintendent.\n> Final line of blockquote.'),
      'Blockquote structure and indentation must be preserved'
    );

    assert.ok(
      serialized.includes('| Station | Component      | Cycle Time (min) | Status |\n|:--------|:---------------|----------------:|:------:|\n| 01      | Center Wing    |              55 | Active |'),
      'Pipe table alignment and column spacing must be preserved'
    );
  });

  test('3. An individual file with 450 KiB of text gets split across paragraph boundaries into <= 380 KiB (389,120 bytes) chunks', () => {
    // Generate 450 KiB of paragraph-structured text (e.g. 100 paragraphs of 4.6 KB each)
    const paragraphs = [];
    const paragraphText = 'Charles E. Sorensen organized the production layout at Willow Run based on the moving assembly line principles developed at Highland Park and the Rouge plant. '.repeat(32); // ~5.1 KB

    for (let i = 0; i < 100; i++) {
      paragraphs.push(`[Paragraph ${i + 1}] ${paragraphText}`);
    }

    const largeContent = [
      '---',
      'category: willow-run',
      'source_title: "Massive Willow Run Production Ledger"',
      '---',
      '',
      paragraphs.join('\n\n')
    ].join('\n');

    const totalBytes = Buffer.byteLength(largeContent, 'utf8');
    assert.ok(totalBytes > 450 * 1024, `Test document must exceed 450 KiB (actual: ${(totalBytes / 1024).toFixed(2)} KiB)`);

    const item = {
      relPath: 'wiki/willow-run/massive-ledger.md',
      filePath: '/tmp/wiki/willow-run/massive-ledger.md',
      content: largeContent,
      frontmatter: extractFrontmatter(largeContent),
      sha256: crypto.createHash('sha256').update(largeContent).digest('hex'),
      sourceType: 'markdown'
    };

    // partitionPackItems should handle oversized items without throwing ITEM_EXCEEDS_BUDGET
    // and each chunk payload must satisfy <= MAX_PACK_BYTES (389,120 bytes)
    const chunks = partitionPackItems([item], MAX_PACK_BYTES);

    assert.ok(chunks.length >= 2, `450 KiB file should be partitioned into at least 2 chunks (got ${chunks.length})`);

    for (let i = 0; i < chunks.length; i++) {
      const chunkItems = chunks[i];
      const serializedChunk = chunkItems.map(serializePackItem).join('');
      const chunkBytes = Buffer.byteLength(serializedChunk, 'utf8');
      assert.ok(
        chunkBytes <= MAX_PACK_BYTES,
        `Chunk ${i + 1} size (${chunkBytes} bytes) exceeds MAX_PACK_BYTES (${MAX_PACK_BYTES} bytes)`
      );
    }
  });

  test('4. _kb-sync-staging, .txt files, and ignored files are excluded from candidate discovery', () => {
    const tmpDir = path.join(process.cwd(), '.tmp', 'test-pack-exclusions');
    const wikiDir = path.join(tmpDir, 'wiki');
    const stagingDir = path.join(wikiDir, '_kb-sync-staging');
    const subDir = path.join(wikiDir, 'nested');
    const outDir = path.join(tmpDir, 'out');

    fs.mkdirSync(wikiDir, { recursive: true });
    fs.mkdirSync(stagingDir, { recursive: true });
    fs.mkdirSync(subDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    // 1. Valid markdown file in root wiki
    fs.writeFileSync(
      path.join(wikiDir, 'valid-root.md'),
      '---\ncategory: willow-run\nsource_title: "Valid Root"\n---\nValid root content\n'
    );

    // 2. Valid markdown file in nested subfolder
    fs.writeFileSync(
      path.join(subDir, 'valid-nested.md'),
      '---\ncategory: willow-run\nsource_title: "Valid Nested"\n---\nValid nested content\n'
    );

    // 3. Staging file in _kb-sync-staging (MUST BE EXCLUDED)
    fs.writeFileSync(
      path.join(stagingDir, 'staging-note.md'),
      '---\ncategory: willow-run\nsource_title: "Staging Note"\n---\nUNWANTED_STAGING_CONTENT\n'
    );

    // 4. Plain .txt file (MUST BE EXCLUDED)
    fs.writeFileSync(
      path.join(wikiDir, 'notes.txt'),
      '---\ncategory: willow-run\n---\nUNWANTED_TXT_FILE_CONTENT\n'
    );

    // 5. Plain .txt file in staging (MUST BE EXCLUDED)
    fs.writeFileSync(
      path.join(stagingDir, 'staging-raw.txt'),
      'UNWANTED_STAGING_TXT_CONTENT\n'
    );

    // 6. log.md file (MUST BE EXCLUDED per IGNORED_FILES)
    fs.writeFileSync(
      path.join(wikiDir, 'log.md'),
      '---\ncategory: willow-run\n---\nUNWANTED_LOG_MD_CONTENT\n'
    );

    const generatedPacks = consolidatePacks({
      rootDir: tmpDir,
      scanDirs: [wikiDir],
      outDir
    });

    const willowPack = generatedPacks.find(p => p.packDef.category === 'willow-run');
    assert.ok(willowPack, 'willow-run pack must be generated');

    const packContent = fs.readFileSync(willowPack.packFile, 'utf8');

    // Valid files must be present
    assert.ok(packContent.includes('Valid root content'), 'valid-root.md must be included');
    assert.ok(packContent.includes('Valid nested content'), 'valid-nested.md must be included');

    // Excluded files must NEVER be present
    assert.equal(packContent.includes('UNWANTED_STAGING_CONTENT'), false, '_kb-sync-staging files must be excluded');
    assert.equal(packContent.includes('UNWANTED_TXT_FILE_CONTENT'), false, '.txt files must be excluded');
    assert.equal(packContent.includes('UNWANTED_STAGING_TXT_CONTENT'), false, 'staging .txt files must be excluded');
    assert.equal(packContent.includes('UNWANTED_LOG_MD_CONTENT'), false, 'log.md must be excluded');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('5. All thematic categories (willow-run, ford-politics, post-war, cuban-seizures, master-kb) are mapped and tested', () => {
    const canonicalPacks = getCanonicalPacks();
    const categories = canonicalPacks.map(p => p.category);

    // Required canonical thematic categories
    assert.ok(categories.includes('willow-run'), 'willow-run category must exist');
    assert.ok(categories.includes('ford-politics'), 'ford-politics category must exist');
    assert.ok(categories.includes('post-war'), 'post-war category must exist');
    assert.ok(categories.includes('cuba-claims'), 'cuba-claims category must exist (for cuban-seizures)');
    assert.ok(categories.includes('master-kb'), 'master-kb category must exist');

    // Test alias mapping and generation in consolidatePacks
    const tmpDir = path.join(process.cwd(), '.tmp', 'test-thematic-categories');
    const wikiDir = path.join(tmpDir, 'wiki');
    const outDir = path.join(tmpDir, 'out');

    fs.mkdirSync(wikiDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    // File 1: willow-run via canonical name
    fs.writeFileSync(
      path.join(wikiDir, 'note-willow.md'),
      '---\ncategory: willow-run\nsource_title: "Willow Run Overview"\n---\nWillow Run content\n'
    );

    // File 2: ford-politics via alias 'ford_labor'
    fs.writeFileSync(
      path.join(wikiDir, 'note-politics.md'),
      '---\ncategory: ford_labor\nsource_title: "Ford Labor Relations"\n---\nFord labor relations content\n'
    );

    // File 3: post-war via alias 'willys-overland'
    fs.writeFileSync(
      path.join(wikiDir, 'note-postwar.md'),
      '---\ncategory: willys-overland\nsource_title: "Willys Overland Post-War"\n---\nPost-war Willys content\n'
    );

    // File 4: cuban-seizures via alias 'cuban-seizures'
    fs.writeFileSync(
      path.join(wikiDir, 'note-cuba.md'),
      '---\ncategory: cuban-seizures\nsource_title: "Cuban Assets Seizure"\n---\nCuban assets seizure content\n'
    );

    const generatedPacks = consolidatePacks({
      rootDir: tmpDir,
      scanDirs: [wikiDir],
      outDir
    });

    // Check willow-run pack
    const willowPack = generatedPacks.find(p => p.packDef.category === 'willow-run');
    assert.ok(willowPack, 'willow-run pack generated');
    const willowContent = fs.readFileSync(willowPack.packFile, 'utf8');
    assert.ok(willowContent.includes('Willow Run content'));

    // Check ford-politics pack
    const fordPack = generatedPacks.find(p => p.packDef.category === 'ford-politics');
    assert.ok(fordPack, 'ford-politics pack generated');
    const fordContent = fs.readFileSync(fordPack.packFile, 'utf8');
    assert.ok(fordContent.includes('Ford labor relations content'));

    // Check post-war pack
    const postWarPack = generatedPacks.find(p => p.packDef.category === 'post-war');
    assert.ok(postWarPack, 'post-war pack generated');
    const postWarContent = fs.readFileSync(postWarPack.packFile, 'utf8');
    assert.ok(postWarContent.includes('Post-war Willys content'));

    // Check cuba-claims pack
    const cubaPack = generatedPacks.find(p => p.packDef.category === 'cuba-claims');
    assert.ok(cubaPack, 'cuba-claims pack generated');
    const cubaContent = fs.readFileSync(cubaPack.packFile, 'utf8');
    assert.ok(cubaContent.includes('Cuban assets seizure content'));

    // Check master-kb pack (aggregates all historical categories)
    const masterPack = generatedPacks.find(p => p.packDef.category === 'master-kb');
    assert.ok(masterPack, 'master-kb pack generated');
    const masterContent = fs.readFileSync(masterPack.packFile, 'utf8');
    assert.ok(masterContent.includes('Willow Run content'));
    assert.ok(masterContent.includes('Ford labor relations content'));
    assert.ok(masterContent.includes('Post-war Willys content'));
    assert.ok(masterContent.includes('Cuban assets seizure content'));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

});
