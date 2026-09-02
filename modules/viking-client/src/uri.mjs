const LAYERS = new Set(['sources', 'wiki', 'schema']);

function decodeSegment(value) {
  try { return decodeURIComponent(value); }
  catch { throw new TypeError('Viking URI contains invalid percent encoding'); }
}

export function parseVikingUri(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('viking://')) throw new TypeError('Viking URI must use viking://');
  const parts = uri.slice('viking://'.length).split('/');
  const vault = parts.shift();
  const layer = parts.shift();
  if (!vault) throw new TypeError('Viking URI must include a vault name');
  if (!LAYERS.has(layer)) throw new TypeError('Viking URI layer must be sources, wiki, or schema');
  const decoded = parts.map(decodeSegment);
  if (decoded.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\\') || segment.includes('\0'))) throw new TypeError('Viking URI contains an unsafe path segment');
  const relativePath = decoded.join('/');
  const canonicalPath = decoded.map(encodeURIComponent).join('/');
  return Object.freeze({ vault, layer, relativePath, uri: `viking://${vault}/${layer}${canonicalPath ? `/${canonicalPath}` : ''}` });
}

export function formatVikingUri({ vault, layer, relativePath = '' }) {
  const encodedPath = String(relativePath).split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return parseVikingUri(`viking://${vault}/${layer}${encodedPath ? `/${encodedPath}` : ''}`).uri;
}

