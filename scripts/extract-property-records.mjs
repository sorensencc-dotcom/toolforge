#!/usr/bin/env node
// ==============================================================================
// Multi-Modal Property & Deed Extractor
// Ingests historical dossiers, deeds, and claims manifests to compile standardized
// property profiles in wiki/research/properties/<slug>.md with full provenance.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENTITIES_PATH = path.join(__dirname, '..', 'kb-sync', 'core', 'property_entities.json');
const MODALITIES_PATH = path.join(__dirname, '..', 'kb-sync', 'core', 'property_input_modalities.json');
const PROPERTIES_DIR = path.join(__dirname, '..', 'wiki', 'research', 'properties');
const ERRORS_FILE = path.join(PROPERTIES_DIR, '_errors.md');

const COLOR = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };
const logInfo = (msg) => console.log(`${COLOR.green}[PROPERTY-EXTRACT] [INFO]${COLOR.reset} ${msg}`);
const logWarn = (msg) => console.log(`${COLOR.yellow}[PROPERTY-EXTRACT] [WARN]${COLOR.reset} ${msg}`);
const logError = (msg) => console.error(`${COLOR.red}[PROPERTY-EXTRACT] [ERROR]${COLOR.reset} ${msg}`);

export function loadNormalizationTables() {
  let entities = { owners: {}, decrees: {} };
  let modalities = { supported_modalities: [], unsupported_modalities: [] };

  if (fs.existsSync(ENTITIES_PATH)) {
    try { entities = JSON.parse(fs.readFileSync(ENTITIES_PATH, 'utf8')); } catch (_) {}
  }
  if (fs.existsSync(MODALITIES_PATH)) {
    try { modalities = JSON.parse(fs.readFileSync(MODALITIES_PATH, 'utf8')); } catch (_) {}
  }

  return { entities, modalities };
}

export function normalizeOwner(rawOwnerText, entityTable) {
  if (!rawOwnerText) return null;
  const lower = rawOwnerText.toLowerCase();
  for (const [canonicalOwner, def] of Object.entries(entityTable.owners || {})) {
    if (lower.includes(canonicalOwner.toLowerCase())) return canonicalOwner;
    for (const alias of def.aliases || []) {
      if (lower.includes(alias.toLowerCase())) return canonicalOwner;
    }
  }
  return rawOwnerText.trim();
}

export function normalizeDecree(rawDecreeText, entityTable) {
  if (!rawDecreeText) return null;
  const lower = rawDecreeText.toLowerCase();
  for (const [canonicalDecree, def] of Object.entries(entityTable.decrees || {})) {
    if (lower.includes(canonicalDecree.toLowerCase())) return canonicalDecree;
    for (const alias of def.aliases || []) {
      if (lower.includes(alias.toLowerCase())) return canonicalDecree;
    }
  }
  return rawDecreeText.trim();
}

export function extractPropertyProfile(filePath, content, normTables) {
  const { entities } = normTables;
  const text = content;
  const lower = text.toLowerCase();

  // Heuristic regex matchers
  const claimMatch = text.match(/(?:claim\s*no\.?|claim\s*#?|decision\s*no\.?)\s*:?\s*([A-Z0-9\-\/]+)/i);
  const claimNumber = claimMatch ? claimMatch[1].trim() : 'N/A';

  const valueMatch = text.match(/\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/);
  const valuation = valueMatch ? `$${valueMatch[1]}` : 'N/A';

  // Province detection
  const provinces = ['Oriente', 'Camagüey', 'Las Villas', 'Matanzas', 'Havana', 'Pinar del Río', 'Isle of Pines'];
  let detectedProvince = 'N/A';
  for (const prov of provinces) {
    if (new RegExp(`\\b${prov}\\b`, 'i').test(text)) {
      detectedProvince = prov;
      break;
    }
  }

  // Area detection
  const areaMatch = text.match(/([0-9,]+(?:\.[0-9]+)?)\s*(caballer[ií]as?|acres?|hectares?|sq\.?\s*ft\.?)/i);
  const area = areaMatch ? `${areaMatch[1]} ${areaMatch[2]}` : 'N/A';

  // Owner normalization
  const owner = normalizeOwner(text, entities) || 'Unknown Corporate Entity';

  // Decree normalization
  const decree = normalizeDecree(text, entities) || (lower.includes('law 851') ? 'Law 851' : (lower.includes('agrarian') ? 'Agrarian Reform Law' : 'N/A'));

  // Asset Name extraction
  let assetName = 'Cuban Commercial Asset';
  const nameMatch = text.match(/(?:property|concession|central|sugar\s*mill|estate|refinery)\s*:\s*([^\r\n,]+)/i);
  if (nameMatch) {
    assetName = nameMatch[1].trim();
  } else if (lower.includes('moa bay')) {
    assetName = 'Moa Bay Mining Concession';
  } else if (lower.includes('nicaro')) {
    assetName = 'Nicaro Nickel Processing Facility';
  } else if (lower.includes('telephone')) {
    assetName = 'Cuban Telephone Infrastructure Concession';
  }

  // Compute Extraction Confidence
  let score = 0.2;
  if (owner !== 'Unknown Corporate Entity') score += 0.3;
  if (claimNumber !== 'N/A') score += 0.2;
  if (valuation !== 'N/A') score += 0.15;
  if (decree !== 'N/A') score += 0.15;

  const confidenceScore = Math.min(1.0, parseFloat(score.toFixed(2)));

  const missingFields = [];
  if (claimNumber === 'N/A') missingFields.push('FCSC Claim Number');
  if (valuation === 'N/A') missingFields.push('Principal Valuation');
  if (detectedProvince === 'N/A') missingFields.push('Province / Location');
  if (area === 'N/A') missingFields.push('Area (Acreage/Caballerías)');

  return {
    assetName,
    owner,
    province: detectedProvince,
    area,
    decree,
    claimNumber,
    valuation,
    confidenceScore,
    missingFields
  };
}

export function runPropertyExtraction(options = {}) {
  const normTables = loadNormalizationTables();
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const vaultRoot = options.vaultRoot || process.env.TRM_VAULT || 'C:\\Users\\soren\\trm-vault';
  const minConfidence = options.minConfidence || 0.35;

  if (!fs.existsSync(PROPERTIES_DIR)) {
    fs.mkdirSync(PROPERTIES_DIR, { recursive: true });
  }

  logInfo(`Scanning archives for property and deed records...`);
  const candidateDirs = [
    path.join(vaultRoot, 'intake', 'notebooklm', 'cic-daily-research'),
    path.join(vaultRoot, 'intake', 'notebooklm', 'cast-iron-charlie-research-logs'),
    path.join(rootDir, 'wiki', 'research')
  ];

  const profilesGenerated = [];
  const errorsLogged = [];

  for (const cDir of candidateDirs) {
    if (!fs.existsSync(cDir)) continue;
    for (const entry of fs.readdirSync(cDir)) {
      if (!entry.endsWith('.md') && !entry.endsWith('.txt')) continue;
      const fullPath = path.join(cDir, entry);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (/cuba|claim|seizure|expropriat|sugar|nickel/i.test(content)) {
          const profile = extractPropertyProfile(fullPath, content, normTables);

          if (profile.confidenceScore >= minConfidence) {
            const slug = profile.assetName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const outFile = path.join(PROPERTIES_DIR, `${slug}.md`);
            const sha256 = crypto.createHash('sha256').update(content.trim()).digest('hex');

            let md = `# Property Profile: ${profile.assetName}\n\n`;
            md += `## Core Metadata\n`;
            md += `- **Parcel/Asset Name:** ${profile.assetName}\n`;
            md += `- **Corporate Parent:** ${profile.owner}\n`;
            md += `- **Location / Province:** ${profile.province}\n`;
            md += `- **Area:** ${profile.area}\n`;
            md += `- **Seizure Decree:** ${profile.decree}\n`;
            md += `- **FCSC Claim Number:** ${profile.claimNumber}\n`;
            md += `- **Principal Valuation:** ${profile.valuation}\n\n`;
            md += `## Extraction Quality & Confidence\n`;
            md += `- **Confidence Score:** ${profile.confidenceScore}\n`;
            if (profile.missingFields.length > 0) {
              md += `- **Missing Fields:** ${profile.missingFields.join(', ')}\n`;
            } else {
              md += `- **Status:** Fully extracted with high confidence\n`;
            }
            md += `\n## Cross-References\n`;
            md += `- **Thematic Target:** CIC - Cuban Seizures & Retired Assets\n`;
            md += `- **Decree Basis:** ${profile.decree}\n\n`;
            md += `=== PROVENANCE ===\n`;
            md += `source_path: ${fullPath.replace(/\\/g, '/')}\n`;
            md += `source_type: ${path.extname(entry).slice(1)}\n`;
            md += `hash_sha256: ${sha256}\n`;
            md += `extracted_at: ${new Date().toISOString()}\n`;
            md += `extractor_version: 2026-08-29-1\n`;
            md += `===================\n`;

            fs.writeFileSync(outFile, md, 'utf8');
            profilesGenerated.push({ slug, outFile, profile });
          } else {
            errorsLogged.push({ file: entry, reason: `Low confidence (${profile.confidenceScore})` });
          }
        }
      } catch (err) {
        errorsLogged.push({ file: entry, reason: err.message });
      }
    }
  }

  // Write error report
  let errMd = `# Property Extraction Errors & Warnings\n\nGenerated at: ${new Date().toISOString()}\n\n`;
  errMd += `| File | Issue / Reason |\n|---|---|\n`;
  for (const e of errorsLogged) {
    errMd += `| \`${e.file}\` | ${e.reason} |\n`;
  }
  fs.writeFileSync(ERRORS_FILE, errMd, 'utf8');

  logInfo(`✓ Emitted ${profilesGenerated.length} standardized property profiles in wiki/research/properties/`);
  logInfo(`✓ Error report logged to: ${ERRORS_FILE}`);
  return profilesGenerated;
}

const mainFile = process.argv[1] ? fs.realpathSync(process.argv[1]) : '';
const thisFile = fs.realpathSync(__filename);
if (mainFile === thisFile) {
  runPropertyExtraction();
}
