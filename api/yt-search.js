'use strict';
// Vercel function: YouTube search for Jam (GET /api/yt-search?q=...).
// The hosted lab calls it same-origin; the portable Open-Lab.html (origin "null")
// and the GitHub Pages copy call it cross-origin, so only those origins get CORS.
const { search } = require('../ytsearch.cjs');

const ORIGINS = new Set(['https://corpdesk-it-support-lab.vercel.app', 'https://pitchiluxe.github.io', 'null', 'http://127.0.0.1:8765', 'http://localhost:8765']);

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ORIGINS.has(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS'); res.end(); return; }
  if (req.method !== 'GET') { send(405, { error: 'Use GET.' }); return; }
  let q = '';
  try { q = new URL(req.url, 'http://localhost').searchParams.get('q') || ''; } catch { /* empty query */ }
  try {
    const results = await search(q);
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    send(200, { results });
  } catch (e) {
    send(e.status === 400 ? 400 : 502, { error: e.status === 400 ? e.message : 'YouTube search is unavailable right now. Try again in a moment.' });
  }
};
