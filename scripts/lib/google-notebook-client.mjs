/**
 * scripts/lib/google-notebook-client.mjs
 *
 * Official Google Gemini Notebook API (notebook.googleapis.com) client.
 * Native Node.js ESM client with zero external dependencies.
 * Uses Application Default Credentials (ADC) and standard fetch.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BASE_URL = 'https://notebook.googleapis.com/v1';

let cachedToken = null;
let tokenExpiresAt = 0;
let cachedProjectId = null;

/**
 * Retrieves the Google Cloud project ID from environment, ADC, or gcloud config.
 * @returns {string}
 */
export function getProjectId() {
  if (cachedProjectId) return cachedProjectId;

  if (process.env.GOOGLE_CLOUD_PROJECT) {
    cachedProjectId = process.env.GOOGLE_CLOUD_PROJECT;
    return cachedProjectId;
  }

  // Check ADC quota_project_id
  try {
    const adcPath = path.join(process.env.APPDATA || '', 'gcloud', 'application_default_credentials.json');
    if (fs.existsSync(adcPath)) {
      const adc = JSON.parse(fs.readFileSync(adcPath, 'utf8'));
      if (adc.quota_project_id) {
        cachedProjectId = adc.quota_project_id;
        return cachedProjectId;
      }
    }
  } catch (_) {}

  // Fallback to gcloud CLI
  try {
    const out = execSync('gcloud config get-value project', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    if (out && !out.includes('(unset)')) {
      cachedProjectId = out;
      return cachedProjectId;
    }
  } catch (_) {}

  return null;
}

/**
 * Retrieves a valid OAuth2 access token for notebook.googleapis.com.
 * Refreshes automatically via ADC refresh_token or falls back to gcloud CLI.
 * @returns {Promise<string>}
 */
export async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 300000) {
    return cachedToken;
  }

  // 1. Try refreshing via ADC credentials file
  try {
    const adcPath = path.join(process.env.APPDATA || '', 'gcloud', 'application_default_credentials.json');
    if (fs.existsSync(adcPath)) {
      const adc = JSON.parse(fs.readFileSync(adcPath, 'utf8'));
      if (adc.client_id && adc.client_secret && adc.refresh_token) {
        const resp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: adc.client_id,
            client_secret: adc.client_secret,
            refresh_token: adc.refresh_token,
            grant_type: 'refresh_token'
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data.access_token) {
            cachedToken = data.access_token;
            tokenExpiresAt = now + ((data.expires_in || 3600) * 1000);
            return cachedToken;
          }
        }
      }
    }
  } catch (_) {}

  // 2. Fallback to gcloud application-default print-access-token
  try {
    const token = execSync('gcloud auth application-default print-access-token', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    if (token && !token.startsWith('ERROR')) {
      cachedToken = token;
      tokenExpiresAt = now + (3600 * 1000); // Assume 1 hour
      return cachedToken;
    }
  } catch (err) {
    throw new Error(`AUTHENTICATION_FAILED: Could not obtain Google OAuth access token: ${err.message}`);
  }

  throw new Error('AUTHENTICATION_FAILED: Failed to obtain access token from ADC or gcloud CLI.');
}

/**
 * Builds standard headers for notebook.googleapis.com API calls.
 * @param {string} token
 * @returns {Record<string, string>}
 */
function buildHeaders(token) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  const projectId = getProjectId();
  if (projectId) {
    headers['x-goog-user-project'] = projectId;
  }
  return headers;
}

/**
 * Normalizes notebook identifier into standard format "notebooks/{id}".
 * @param {string} idOrName
 * @returns {string}
 */
function normalizeNotebookName(idOrName) {
  const trimmed = (idOrName || '').trim();
  return trimmed.startsWith('notebooks/') ? trimmed : `notebooks/${trimmed}`;
}

/**
 * Lists all notebooks accessible to the authenticated user.
 * @param {object} [options]
 * @param {string} [options.pageToken]
 * @param {number} [options.pageSize]
 * @returns {Promise<{ notebooks: Array<object>, nextPageToken?: string }>}
 */
export async function listNotebooks(options = {}) {
  const token = await getAccessToken();
  const url = new URL(`${BASE_URL}/notebooks`);
  if (options.pageToken) url.searchParams.set('pageToken', options.pageToken);
  if (options.pageSize) url.searchParams.set('pageSize', String(options.pageSize));

  const resp = await fetch(url.toString(), {
    method: 'GET',
    headers: buildHeaders(token)
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API_ERROR: listNotebooks failed with HTTP ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  return {
    notebooks: data.notebooks || [],
    nextPageToken: data.nextPageToken
  };
}

/**
 * Retrieves metadata for a specific notebook.
 * @param {string} notebookId
 * @returns {Promise<object>}
 */
export async function getNotebook(notebookId) {
  const token = await getAccessToken();
  const name = normalizeNotebookName(notebookId);
  const resp = await fetch(`${BASE_URL}/${name}`, {
    method: 'GET',
    headers: buildHeaders(token)
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API_ERROR: getNotebook(${notebookId}) failed with HTTP ${resp.status}: ${text}`);
  }

  return await resp.json();
}

/**
 * Lists all sources inside a notebook.
 * @param {string} notebookId
 * @param {object} [options]
 * @param {string} [options.pageToken]
 * @returns {Promise<{ sources: Array<object>, nextPageToken?: string }>}
 */
export async function listSources(notebookId, options = {}) {
  const token = await getAccessToken();
  const name = normalizeNotebookName(notebookId);
  const url = new URL(`${BASE_URL}/${name}/sources`);
  if (options.pageToken) url.searchParams.set('pageToken', options.pageToken);

  const resp = await fetch(url.toString(), {
    method: 'GET',
    headers: buildHeaders(token)
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API_ERROR: listSources(${notebookId}) failed with HTTP ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  return {
    sources: data.sources || [],
    nextPageToken: data.nextPageToken
  };
}

/**
 * Ingests a text or markdown source into a notebook.
 * @param {string} notebookId
 * @param {object} sourceData
 * @param {string} sourceData.displayName
 * @param {string} sourceData.content
 * @param {string} [sourceData.mimeType='text/plain']
 * @returns {Promise<object>}
 */
export async function addTextSource(notebookId, { displayName, content, mimeType = 'text/plain' }) {
  if (!displayName || !content) {
    throw new Error('INVALID_ARGUMENT: displayName and content are required to add a text source.');
  }

  const token = await getAccessToken();
  const name = normalizeNotebookName(notebookId);
  const body = {
    displayName,
    mimeType,
    textContent: { content }
  };

  const resp = await fetch(`${BASE_URL}/${name}/sources`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API_ERROR: addTextSource(${notebookId}) failed with HTTP ${resp.status}: ${text}`);
  }

  return await resp.json();
}

/**
 * Ingests a web URL or YouTube source into a notebook.
 * @param {string} notebookId
 * @param {object} sourceData
 * @param {string} sourceData.url
 * @param {string} [sourceData.displayName]
 * @returns {Promise<object>}
 */
export async function addWebSource(notebookId, { url, displayName }) {
  if (!url) {
    throw new Error('INVALID_ARGUMENT: url is required to add a web source.');
  }

  const token = await getAccessToken();
  const name = normalizeNotebookName(notebookId);
  const body = {
    webContent: { url }
  };
  if (displayName) {
    body.displayName = displayName;
  }

  const resp = await fetch(`${BASE_URL}/${name}/sources`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API_ERROR: addWebSource(${notebookId}) failed with HTTP ${resp.status}: ${text}`);
  }

  return await resp.json();
}

/**
 * Attempts to delete a source from a notebook.
 * Note: As of public preview, DELETE returns 501 UNIMPLEMENTED on Google's backend.
 * @param {string} notebookId
 * @param {string} sourceId
 * @returns {Promise<{ supported: boolean, status: number, body?: object }>}
 */
export async function deleteSource(notebookId, sourceId) {
  const token = await getAccessToken();
  const name = normalizeNotebookName(notebookId);
  const cleanSourceId = (sourceId || '').replace(/^.*\//, '');

  const resp = await fetch(`${BASE_URL}/${name}/sources/${cleanSourceId}`, {
    method: 'DELETE',
    headers: buildHeaders(token)
  });

  if (resp.status === 501) {
    return { supported: false, status: 501, message: 'Source deletion is not yet supported by Google Notebook API preview.' };
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API_ERROR: deleteSource failed with HTTP ${resp.status}: ${text}`);
  }

  return { supported: true, status: resp.status };
}
