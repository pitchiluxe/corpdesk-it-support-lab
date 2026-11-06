'use strict';
/**
 * YouTube search without an API key, for Jam (the DJ app).
 *
 * Ported from AIHub DJ (src/main/youtubeSearch.ts). YouTube's own search page
 * embeds its result set as JSON in a `ytInitialData` assignment, so results are
 * read from the page a browser would load anyway. This is scraping and scraping
 * breaks, so everything fails soft: an unrecognised page yields fewer results
 * or none, never an exception and never an entry without a valid video id.
 *
 * Used by server.cjs (local) and api/yt-search.js (Vercel). The Windows app has
 * the same parser in C# (windows-app/LocalServices.cs).
 */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const isVideoId = (id) => typeof id === 'string' && VIDEO_ID.test(id);

function extractInitialData(html) {
  for (const marker of ['var ytInitialData = ', 'window["ytInitialData"] = ', 'ytInitialData = ']) {
    const at = html.indexOf(marker);
    if (at === -1) continue;
    const start = html.indexOf('{', at);
    if (start === -1) continue;
    let depth = 0, inString = false, escaped = false;
    for (let i = start; i < html.length; i++) {
      const ch = html[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) { try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; } }
    }
  }
  return null;
}
function readText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node.simpleText === 'string') return node.simpleText;
  if (Array.isArray(node.runs)) return node.runs.map((r) => (r && r.text) || '').join('');
  return '';
}
function collectVideoRenderers(node, out = [], depth = 0) {
  if (!node || typeof node !== 'object' || depth > 30) return out;
  if (Array.isArray(node)) { for (const item of node) collectVideoRenderers(item, out, depth + 1); return out; }
  if (node.videoRenderer && isVideoId(node.videoRenderer.videoId)) out.push(node.videoRenderer);
  for (const key of Object.keys(node)) if (key !== 'videoRenderer') collectVideoRenderers(node[key], out, depth + 1);
  return out;
}
/** Search page HTML to a list of playable videos (live streams and premieres dropped: no length). */
function parseSearchResults(html, limit = 30) {
  const data = extractInitialData(html);
  if (!data) return [];
  const seen = new Set();
  const out = [];
  for (const r of collectVideoRenderers(data)) {
    const id = r.videoId;
    if (!isVideoId(id) || seen.has(id)) continue;
    const duration = readText(r.lengthText);
    const title = readText(r.title).trim();
    if (!duration || !title) continue;
    seen.add(id);
    out.push({ id, title, channel: readText(r.ownerText) || readText(r.longBylineText) || '', duration, views: readText(r.shortViewCountText), thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, url: `https://www.youtube.com/watch?v=${id}` });
    if (out.length >= limit) break;
  }
  return out;
}
const searchUrl = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D`;

/** A query is 1-120 characters of text; anything else is refused before reaching YouTube. */
function cleanQuery(q) {
  const s = String(q ?? '').replace(/\s+/g, ' ').trim();
  return s && s.length <= 120 ? s : null;
}
const cache = new Map();
async function search(query, fetchImpl = fetch) {
  const q = cleanQuery(query);
  if (!q) throw Object.assign(new Error('Type what to search for (up to 120 characters).'), { status: 400 });
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.results;
  const res = await fetchImpl(searchUrl(q), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      // Skip the EU cookie-consent interstitial, which has no results in it.
      Cookie: 'CONSENT=YES+cb; SOCS=CAI',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw Object.assign(new Error('YouTube did not answer the search.'), { status: 502 });
  const results = parseSearchResults(await res.text());
  cache.set(key, { at: Date.now(), results });
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return results;
}
module.exports = { search, parseSearchResults, extractInitialData, cleanQuery, isVideoId };
