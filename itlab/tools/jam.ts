/**
 * Jam: the two-deck DJ console of AIHub DJ (Erick Omari's DJ app), rebuilt for
 * CORP Desk. The markup mirrors AIHub's components class for class (DeckUI,
 * Platter, Mixer, TopWidgets, Library), and the look is AIHub's own stylesheet
 * generated into jam-console.css (Classic look, Original theme), so the two
 * consoles look the same.
 *
 * Two kinds of song:
 *  - YouTube: found with the search box (any words: /api/yt-search reads
 *    YouTube's results page, see ytsearch.cjs) or sent from the lab's Chrome,
 *    and played through YouTube's embedded player, sandboxed without pop-ups so
 *    nothing opens outside the app. YouTube keeps its audio inside its player,
 *    so volume, crossfader, pitch, loops, hot cues and Automix reach it; EQ,
 *    stems and effects do not (AIHub calls this "direct playback").
 *  - Songs from the computer play through Web Audio: everything works, with
 *    waveform and BPM detection. They last for the session (a page cannot
 *    reopen local files later).
 */
import { G, S, openApp, save, toast } from '../corp.ts';
import { h } from '../dom.ts';
import { registerTool } from '../host.ts';

type D = 'A' | 'B';
const DECKS: D[] = ['A', 'B'];
const other = (d: D): D => (d === 'A' ? 'B' : 'A');
type Stem = 'vocal' | 'instru' | 'bass' | 'kick' | 'hihat';
type Band = 'high' | 'mid' | 'low';
type Fx = 'flanger' | 'echo' | 'filter';
const FX_LABELS: Record<Fx, string> = { flanger: 'Flanger', echo: 'Echo', filter: 'Filter sweep' };

interface Track { id: string; kind: 'yt' | 'file'; title: string; artist: string; duration: number; bpm: number; album?: string }
interface DeckState { trackId: string | null; vol: number; pitch: number; keylock: boolean; cues: (number | null)[]; loopBeats: number; stems: Record<Stem, boolean>; filter: number; fxType: Fx; fx: { on: boolean; str: number; spd: number }; eq: Record<Band, number>; gain: number }
interface JamState { library: Track[]; queue: string[]; decks: Record<D, DeckState>; xfade: number; master: number; automix: boolean; remain: Record<D, boolean>; view: 'video' | 'mixer'; source: 'music' | 'youtube' | 'saved'; sandbox: boolean; samplerLevel: number; samplerPitch: number; covers: boolean }

const YT_ID = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})|^([\w-]{11})$/;
export const youtubeId = (text: string): string | null => { const m = YT_ID.exec(String(text).trim()); return m ? (m[1] ?? m[2] ?? null) : null; };
const thumb = (id: string): string => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const embedUrl = (id: string): string => `https://www.youtube.com/embed/${id}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(location.origin)}`;
/** No allow-popups: YouTube's "Watch on YouTube", logo and title links cannot open a window outside the app. */
const SANDBOX = 'allow-scripts allow-same-origin allow-presentation';
const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const clamp01 = (v: number): number => clamp(v, 0, 1);
/** AIHub's fmtTime: 0:00.0 (tenths) or 0:00. */
function fmtTime(sec: number, tenths = true): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60), t = Math.floor((sec * 10) % 10);
  return tenths ? `${m}:${String(s).padStart(2, '0')}.${t}` : `${m}:${String(s).padStart(2, '0')}`;
}
const parseLength = (s: string): number => String(s).split(':').reduce((a, p) => a * 60 + (Number(p) || 0), 0);

const newDeck = (): DeckState => ({ trackId: null, vol: 0.8, pitch: 0, keylock: true, cues: [null, null, null], loopBeats: 4, stems: { vocal: true, instru: true, bass: true, kick: true, hihat: true }, filter: 0.5, fxType: 'flanger', fx: { on: false, str: 0.6, spd: 0.4 }, eq: { high: 0.5, mid: 0.5, low: 0.5 }, gain: 0.5 });
function jam(): JamState {
  const s = S();
  const j = (s.jam ||= {}) as Partial<JamState> & Record<string, any>;
  j.library ||= []; j.queue ||= [];
  for (const t of j.library as any[]) { t.kind ||= 'yt'; t.artist ??= t.channel ?? ''; t.duration ||= 0; t.bpm ||= 0; }
  j.decks ||= { A: newDeck(), B: newDeck() };
  for (const d of DECKS) {
    // Fill in missing fields in place: callers keep references to the deck objects.
    const deck = ((j.decks as any)[d] ||= {}) as any;
    for (const [k, v] of Object.entries(newDeck())) if (deck[k] === undefined) deck[k] = v;
    // Earlier Jam builds kept volume 0-100 and the filter -1..1.
    if (deck.vol > 1) deck.vol /= 100;
    if (deck.filter < 0) deck.filter = (deck.filter + 1) / 2;
  }
  if (typeof j.xfade !== 'number' || j.xfade > 1) j.xfade = typeof j.xfade === 'number' ? j.xfade / 100 : 0.5;
  if (typeof j.master !== 'number' || j.master > 1) j.master = typeof j.master === 'number' ? j.master / 100 : 0.85;
  j.automix ??= false; j.sandbox ??= false; j.samplerLevel ??= 0.8; j.samplerPitch ??= 0.5; j.covers ??= true;
  if (!j.remain || typeof j.remain !== 'object') j.remain = { A: false, B: false };
  j.view ||= 'video'; j.source ||= 'youtube';
  return j as JamState;
}

// Songs from the computer: kept in memory for this session.
const files = new Map<string, { track: Track; url: string; peaks?: Float32Array }>();
/**
 * Waveform envelopes at ENV_RATE frames a second, as AIHub draws them: overall
 * level (amp) and how much of it is bass (low). Songs from the computer are
 * measured from their audio. YouTube keeps its audio inside its player, so a
 * YouTube deck gets an envelope generated from its tempo: beats, bars and
 * sections that scroll past the needle, not a measurement of the sound.
 */
const ENV_RATE = 100;
interface Env { amp: Float32Array; low: Float32Array; real: boolean; key: string }
const envs = new Map<string, Env>();
function seeded(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function synthEnv(id: string, seconds: number, bpm: number): Env {
  let h = 2166136261; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rnd = seeded(h), n = Math.max(1, Math.ceil(seconds * ENV_RATE)), amp = new Float32Array(n), low = new Float32Array(n);
  const beat = 60 / bpm, sections = Array.from({ length: 64 }, () => 0.45 + rnd() * 0.55), grain = Array.from({ length: 997 }, () => rnd());
  for (let f = 0; f < n; f++) {
    const t = f / ENV_RATE, b = t / beat, ph = b - Math.floor(b), bar = Math.floor(b / 4);
    const level = sections[Math.floor(bar / 8) % sections.length]!;
    const kick = Math.exp(-ph * 9), off = Math.exp(-Math.abs(ph - 0.5) * 18) * 0.45, hat = grain[f % grain.length]! * 0.22;
    const edge = Math.min(1, t / 6, Math.max(0, seconds - t) / 6);
    amp[f] = Math.min(1, edge * level * (0.28 + 0.6 * kick + off * 0.5 + hat));
    low[f] = Math.min(1, (kick * 0.95 + 0.12) * (level > 0.62 ? 1 : 0.7));
  }
  return { amp, low, real: false, key: `${id}:${Math.round(seconds)}:${bpm}` };
}
function envFor(t: Track, duration: number): Env | null {
  const e = envs.get(t.id);
  if (t.kind === 'file') return e ?? null;
  const seconds = duration || t.duration || 420, bpm = t.bpm || 120, key = `${t.id}:${Math.round(seconds)}:${bpm}`;
  if (e?.key === key) return e;
  const made = synthEnv(t.id, seconds, bpm);
  envs.set(t.id, made);
  return made;
}
let searchResults: Track[] | null = null;
let searchQuery = '';
let searching = false;
let searchError = '';
let filterText = '';
let selected: string | null = null;
const trackOf = (id: string | null): Track | null => (id ? jam().library.find((t) => t.id === id) ?? files.get(id)?.track ?? searchResults?.find((t) => t.id === id) ?? null : null);
const deckTrack = (d: D): Track | null => trackOf(jam().decks[d].trackId);

// ---------------------------------------------------------------- icons (lucide shapes, as AIHub uses)
const ICONS: Record<string, string> = {
  play: '<path d="M6 3.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 6 3.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="5" y="3" width="5" height="18" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="3" width="5" height="18" rx="1" fill="currentColor" stroke="none"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" stroke="none"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  eject: '<path d="m18 9-6-6-6 6"/><path d="M12 3v14"/><path d="M5 21h14"/>',
  headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  swap: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  youtube: '<path d="M2.5 17a24.1 24.1 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.1 24.1 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  folderPlus: '<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  video: '<path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  drive: '<path d="M22 12H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><path d="M6 16h.01"/><path d="M10 16h.01"/>',
  list: '<path d="M21 15V6"/><path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/>',
  shuffle: '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.97a4 4 0 0 0 3.3-1.7l5.46-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.97a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.04a4 4 0 0 1-3.3-1.8l-.36-.45"/>',
  maximize: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  wave: '<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>',
  circle: '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  images: '<path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.3-1.3a2.4 2.4 0 0 0-3.4 0L12 17"/><circle cx="12" cy="8" r="2"/><rect width="16" height="16" x="6" y="2" rx="2"/>',
  listPlus: '<path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="M18 9v6"/><path d="M21 12h-6"/>',
  loader: '<path d="M21 12a9 9 0 1 1-6.22-8.56"/>',
};
function ic(name: string, size = 12, cls = ''): SVGSVGElement {
  const t = document.createElement('template');
  // Constant markup from ICONS only.
  t.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${ICONS[name] ?? ''}</svg>`;
  return t.content.firstChild as SVGSVGElement;
}
function svgEl(markup: string): Element {
  const t = document.createElement('template');
  t.innerHTML = markup;
  return t.content.firstElementChild!;
}

// ---------------------------------------------------------------- Web Audio
let actx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterAnalyser: AnalyserNode[] = [];
let recDest: MediaStreamAudioDestinationNode | null = null;
function ctx(): AudioContext {
  if (!actx) {
    actx = new AudioContext();
    masterGain = actx.createGain();
    const split = actx.createChannelSplitter(2);
    masterAnalyser = [actx.createAnalyser(), actx.createAnalyser()];
    for (const a of masterAnalyser) a.fftSize = 1024;
    masterGain.connect(split); split.connect(masterAnalyser[0], 0); split.connect(masterAnalyser[1], 1);
    masterGain.connect(actx.destination);
    recDest = actx.createMediaStreamDestination();
    masterGain.connect(recDest);
    applyMasterOut();
  }
  if (actx.state === 'suspended') void actx.resume();
  return actx;
}
function applyMasterOut(): void { if (masterGain) masterGain.gain.value = jam().sandbox ? 0 : 1; }
interface Graph { audio: HTMLAudioElement; trim: GainNode; eq: Record<Band, BiquadFilterNode>; bands: Record<Stem, GainNode>; filter: BiquadFilterNode; delay: DelayNode; wet: GainNode; feedback: GainNode; lfo: OscillatorNode; depth: GainNode; channel: GainNode; meter: AnalyserNode }
const graphs: Partial<Record<D, Graph>> = {};
function graph(d: D): Graph {
  if (graphs[d]) return graphs[d]!;
  const c = ctx();
  const audio = new Audio();
  audio.preload = 'auto';
  const src = c.createMediaElementSource(audio);
  const trim = c.createGain();
  const eq = { low: c.createBiquadFilter(), mid: c.createBiquadFilter(), high: c.createBiquadFilter() };
  eq.low.type = 'lowshelf'; eq.low.frequency.value = 250;
  eq.mid.type = 'peaking'; eq.mid.frequency.value = 1000; eq.mid.Q.value = 0.8;
  eq.high.type = 'highshelf'; eq.high.frequency.value = 4000;
  src.connect(trim); trim.connect(eq.low); eq.low.connect(eq.mid); eq.mid.connect(eq.high);
  const sum = c.createGain();
  const band = (lo: number | null, hi: number | null): GainNode => {
    let node: AudioNode = eq.high;
    if (lo) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = lo; node.connect(f); node = f; }
    if (hi) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = hi; node.connect(f); node = f; }
    const g = c.createGain(); node.connect(g); g.connect(sum); return g;
  };
  // Band isolation standing in for stems: kick, bass, vocal range, instruments, hi-hats.
  const bands: Record<Stem, GainNode> = { kick: band(null, 110), bass: band(110, 280), vocal: band(280, 3500), instru: band(3500, 7000), hihat: band(7000, null) };
  const filter = c.createBiquadFilter(); filter.type = 'allpass';
  sum.connect(filter);
  const delay = c.createDelay(4); delay.delayTime.value = 0.004;
  const feedback = c.createGain(); feedback.gain.value = 0;
  const wet = c.createGain(); wet.gain.value = 0;
  const lfo = c.createOscillator(); lfo.frequency.value = 0.3;
  const depth = c.createGain(); depth.gain.value = 0;
  lfo.connect(depth); depth.connect(delay.delayTime); lfo.start();
  const channel = c.createGain();
  filter.connect(channel); filter.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(wet); wet.connect(channel);
  const meter = c.createAnalyser(); meter.fftSize = 1024;
  channel.connect(meter); channel.connect(masterGain!);
  audio.addEventListener('ended', () => { live[d].playing = false; G.save(); });
  graphs[d] = { audio, trim, eq, bands, filter, delay, wet, feedback, lfo, depth, channel, meter };
  return graphs[d]!;
}
const eqDb = (v: number): number => (v < 0.5 ? -40 * (1 - v * 2) : (v - 0.5) * 2 * 6);
function applyFx(d: D): void {
  const g = graphs[d]; if (!g) return;
  const ds = jam().decks[d];
  g.trim.gain.value = Math.pow(10, ((ds.gain - 0.5) * 24) / 20);
  for (const b of ['low', 'mid', 'high'] as Band[]) g.eq[b].gain.value = eqDb(ds.eq[b]);
  for (const s of Object.keys(g.bands) as Stem[]) g.bands[s].gain.value = ds.stems[s] ? 1 : 0;
  const v = ds.filter * 2 - 1;
  if (Math.abs(v) < 0.04) g.filter.type = 'allpass';
  else if (v < 0) { g.filter.type = 'lowpass'; g.filter.frequency.value = 20000 * Math.pow(2, v * 10); g.filter.Q.value = 4; }
  else { g.filter.type = 'highpass'; g.filter.frequency.value = 20 * Math.pow(2, v * 10); g.filter.Q.value = 4; }
  const on = ds.fx.on, str = ds.fx.str, spd = ds.fx.spd;
  if (ds.fxType === 'echo') {
    g.depth.gain.value = 0;
    g.delay.delayTime.value = beatLen(d) * (spd < 0.33 ? 0.5 : spd < 0.66 ? 0.75 : 1);
    g.feedback.gain.value = on ? str * 0.6 : 0; g.wet.gain.value = on ? str * 0.8 : 0;
  } else if (ds.fxType === 'filter') {
    // A slow automatic sweep of the deck filter, speed from SPD.
    g.wet.gain.value = 0; g.feedback.gain.value = 0; g.depth.gain.value = 0;
  } else {
    g.delay.delayTime.value = 0.004;
    g.depth.gain.value = on ? 0.001 + str * 0.003 : 0; g.lfo.frequency.value = 0.05 + spd * 4;
    g.wet.gain.value = on ? 0.4 + str * 0.6 : 0; g.feedback.gain.value = on ? str * 0.7 : 0;
  }
}

function noise(c: AudioContext, secs: number): AudioBufferSourceNode {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * secs), c.sampleRate), data = b.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const n = c.createBufferSource(); n.buffer = b; return n;
}
/** AIHub's eight hits, synthesised. k = sampler pitch multiplier. */
const HITS: { id: string; label: string; title: string; play: (c: AudioContext, out: AudioNode, t: number, k: number) => void }[] = [
  { id: 'horn', label: 'HORN', title: 'Air horn (Z)', play: (c, out, t, k) => { for (const [i, f] of [[0, 466], [0.18, 466], [0.36, 554]] as const) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f * k; g.gain.setValueAtTime(0.25, t + i); g.gain.exponentialRampToValueAtTime(0.001, t + i + 0.16); o.connect(g).connect(out); o.start(t + i); o.stop(t + i + 0.17); } } },
  { id: 'siren', label: 'SIREN', title: 'Siren (X)', play: (c, out, t, k) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; for (let n = 0; n < 6; n++) { o.frequency.setValueAtTime(600 * k, t + n * 0.3); o.frequency.linearRampToValueAtTime(1200 * k, t + n * 0.3 + 0.15); o.frequency.linearRampToValueAtTime(600 * k, t + n * 0.3 + 0.3); } g.gain.setValueAtTime(0.25, t); g.gain.setValueAtTime(0.25, t + 1.6); g.gain.linearRampToValueAtTime(0, t + 1.8); o.connect(g).connect(out); o.start(t); o.stop(t + 1.8); } },
  { id: 'laser', label: 'LASER', title: 'Laser (C)', play: (c, out, t, k) => { for (let n = 0; n < 3; n++) { const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.setValueAtTime(2400 * k, t + n * 0.12); o.frequency.exponentialRampToValueAtTime(120 * k, t + n * 0.12 + 0.11); g.gain.setValueAtTime(0.15, t + n * 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + n * 0.12 + 0.11); o.connect(g).connect(out); o.start(t + n * 0.12); o.stop(t + n * 0.12 + 0.12); } } },
  { id: 'riser', label: 'RISE', title: 'Riser (V)', play: (c, out, t, k) => { const n = noise(c, 2), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.Q.value = 6; f.frequency.setValueAtTime(200 * k, t); f.frequency.exponentialRampToValueAtTime(9000 * k, t + 2); g.gain.setValueAtTime(0.05, t); g.gain.linearRampToValueAtTime(0.5, t + 1.9); g.gain.linearRampToValueAtTime(0, t + 2); n.connect(f).connect(g).connect(out); n.start(t); } },
  { id: 'impact', label: 'HIT', title: 'Impact (B)', play: (c, out, t, k) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(160 * k, t); o.frequency.exponentialRampToValueAtTime(40 * k, t + 0.5); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6); o.connect(g).connect(out); o.start(t); o.stop(t + 0.6); const n = noise(c, 0.3), ng = c.createGain(); ng.gain.setValueAtTime(0.4, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3); n.connect(ng).connect(out); n.start(t); } },
  { id: 'clap', label: 'CLAP', title: 'Clap (N)', play: (c, out, t, k) => { for (const n0 of [0, 0.012, 0.025]) { const n = noise(c, 0.2), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.frequency.value = 1500 * k; g.gain.setValueAtTime(0.6, t + n0); g.gain.exponentialRampToValueAtTime(0.001, t + n0 + 0.18); n.connect(f).connect(g).connect(out); n.start(t + n0); } } },
  { id: 'rewind', label: 'REW', title: 'Rewind (G)', play: (c, out, t, k) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(900 * k, t); o.frequency.exponentialRampToValueAtTime(60 * k, t + 0.9); g.gain.setValueAtTime(0.2, t); g.gain.linearRampToValueAtTime(0, t + 0.9); o.connect(g).connect(out); o.start(t); o.stop(t + 0.9); } },
  { id: 'tom', label: 'TOM', title: 'Tom fill (H)', play: (c, out, t, k) => { for (const [n0, f] of [[0, 220], [0.15, 170], [0.3, 120]] as const) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(f * k, t + n0); o.frequency.exponentialRampToValueAtTime((f * k) / 2.2, t + n0 + 0.3); g.gain.setValueAtTime(0.7, t + n0); g.gain.exponentialRampToValueAtTime(0.001, t + n0 + 0.35); o.connect(g).connect(out); o.start(t + n0); o.stop(t + n0 + 0.36); } } },
];
let samplerOut: GainNode | null = null;
let hitLit: { id: string; at: number } | null = null;
function fire(id: string): void {
  const c = ctx();
  if (!samplerOut) { samplerOut = c.createGain(); samplerOut.connect(masterGain!); }
  const j = jam();
  samplerOut.gain.value = j.samplerLevel;
  HITS.find((x) => x.id === id)?.play(c, samplerOut, c.currentTime + 0.01, Math.pow(2, (j.samplerPitch - 0.5) * 2));
  hitLit = { id, at: performance.now() };
}

/** Waveform peaks and a tempo estimate from the decoded song. */
async function analyse(id: string, blob: Blob): Promise<void> {
  try {
    const buf = await ctx().decodeAudioData(await blob.arrayBuffer());
    const ch = buf.getChannelData(0), N = 2000, step = Math.max(1, Math.floor(ch.length / N)), peaks = new Float32Array(N);
    for (let i = 0; i < N; i++) { let m = 0; for (let k = i * step, e = Math.min(ch.length, k + step); k < e; k += 8) m = Math.max(m, Math.abs(ch[k])); peaks[i] = m; }
    // Tempo: onset energy (~86 frames/s) autocorrelated over 70-180 BPM on up to 90 s.
    const hop = 512, frames = Math.min(Math.floor(ch.length / hop), Math.floor((buf.sampleRate * 90) / hop)), env = new Float32Array(frames);
    let prev = 0;
    for (let f = 0; f < frames; f++) { let e = 0; for (let k = f * hop; k < f * hop + hop; k += 2) e += ch[k] * ch[k]; env[f] = Math.max(0, e - prev); prev = e; }
    const fps = buf.sampleRate / hop;
    let best = 0, bestLag = 0;
    for (let lag = Math.floor((fps * 60) / 180); lag <= Math.ceil((fps * 60) / 70); lag++) { let s = 0; for (let f = lag; f < frames; f++) s += env[f] * env[f - lag]; if (s > best) { best = s; bestLag = lag; } }
    // Level and bass envelopes for the scrolling waveforms (bass: a one-pole low-pass at ~150 Hz).
    const hopE = Math.max(1, Math.floor(buf.sampleRate / ENV_RATE)), nE = Math.floor(ch.length / hopE), amp = new Float32Array(nE), low = new Float32Array(nE);
    const kLp = 1 - Math.exp((-2 * Math.PI * 150) / buf.sampleRate);
    let lp = 0, maxA = 0;
    for (let f = 0; f < nE; f++) {
      let a = 0, l = 0;
      for (let i = f * hopE, e = i + hopE; i < e; i++) { const s = ch[i]; lp += kLp * (s - lp); const as = s < 0 ? -s : s, al = lp < 0 ? -lp : lp; if (as > a) a = as; if (al > l) l = al; }
      amp[f] = a; low[f] = a ? Math.min(1, (l / a) * 1.6) : 0; if (a > maxA) maxA = a;
    }
    if (maxA) for (let f = 0; f < nE; f++) amp[f] /= maxA;
    envs.set(id, { amp, low, real: true, key: id });
    const entry = files.get(id);
    if (!entry) return;
    entry.peaks = peaks;
    entry.track.duration = buf.duration;
    if (bestLag) entry.track.bpm = Math.round(((fps * 60) / bestLag) * 100) / 100;
    G.save();
  } catch { /* not decodable: plays without waveform */ }
}
function addFiles(list: FileList | File[]): Track[] {
  const out: Track[] = [];
  for (const f of [...list].filter((x) => x.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)$/i.test(x.name))) {
    const id = `file:${f.name}:${f.size}`;
    if (!files.has(id)) {
      const base = f.name.replace(/\.[^.]+$/, ''), parts = base.split(' - ');
      const track: Track = { id, kind: 'file', title: parts.length > 1 ? parts.slice(1).join(' - ') : base, artist: parts.length > 1 ? parts[0] : '', duration: 0, bpm: 0 };
      files.set(id, { track, url: URL.createObjectURL(f) });
      void analyse(id, f);
    }
    out.push(files.get(id)!.track);
  }
  if (!out.length) toast('No audio files found there.');
  else { jam().source = 'music'; save(); }
  return out;
}
function pickFiles(folder: boolean): void {
  const i = h('input', { type: 'file', accept: 'audio/*', multiple: true }) as HTMLInputElement;
  if (folder) i.setAttribute('webkitdirectory', '');
  i.addEventListener('change', () => { if (i.files) addFiles(i.files); });
  i.click();
}

// ---------------------------------------------------------------- YouTube search (any words)
const SEARCH_HOSTED = 'https://corpdesk-it-support-lab.vercel.app/api/yt-search';
async function searchYouTube(query: string): Promise<void> {
  const q = query.replace(/\s+/g, ' ').trim();
  if (!q) return;
  const direct = youtubeId(q);
  if (direct) { const t = addToLibrary(direct); selected = t.id; jam().source = 'saved'; save(); toast('Added to My YouTube songs.'); return; }
  searchQuery = q; searching = true; searchError = ''; jam().source = 'youtube'; G.save();
  // Same origin first (Vercel, the local server, the Windows app); the portable
  // page and the GitHub Pages copy have no server, so they use the hosted one.
  const urls = location.protocol.startsWith('http') ? [`/api/yt-search`, SEARCH_HOSTED] : [SEARCH_HOSTED];
  let lastError = 'YouTube search is unavailable right now.';
  for (const base of urls) {
    try {
      const res = await fetch(`${base}?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(15000) });
      const body = await res.json().catch(() => null) as { results?: any[]; error?: string } | null;
      if (res.ok && Array.isArray(body?.results)) {
        searchResults = body!.results.filter((r) => youtubeId(r.id)).map((r) => ({ id: r.id, kind: 'yt' as const, title: String(r.title), artist: String(r.channel ?? ''), duration: parseLength(r.duration), bpm: 0, album: r.views ? `${r.views} views` : '' }));
        selected = searchResults[0]?.id ?? null;
        searching = false; G.save();
        if (!searchResults.length) toast('No playable videos found. Try other words.');
        return;
      }
      if (res.status === 400 && body?.error) { lastError = body.error; break; }
      if (body?.error) lastError = body.error;
    } catch { /* try the next server */ }
  }
  searching = false; searchError = lastError; searchResults = []; G.save();
}

// ---------------------------------------------------------------- YouTube players
declare const YT: any;
let apiReady: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (apiReady) return apiReady;
  apiReady = new Promise((resolve) => {
    if ((globalThis as any).YT?.Player) { resolve(); return; }
    const prev = (globalThis as any).onYouTubeIframeAPIReady;
    (globalThis as any).onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => toast('Jam could not reach YouTube. Check the internet connection.');
    document.head.appendChild(s);
  });
  return apiReady;
}
const players: Partial<Record<D, any>> = {};
const live: Record<D, { playing: boolean; time: number; duration: number; error: string; loopIn: number | null; loopOut: number | null; loop: boolean }> = {
  A: { playing: false, time: 0, duration: 0, error: '', loopIn: null, loopOut: null, loop: false },
  B: { playing: false, time: 0, duration: 0, error: '', loopIn: null, loopOut: null, loop: false },
};
/*
 * The YouTube iframes live in a dock on <body>, never inside the Jam window:
 * CORP redraws a tool on every save and shows windows one over another, and
 * moving or removing an iframe reloads it. While Jam's video monitor is in
 * view the players are laid over it; otherwise they wait off screen, still
 * playing, so the music goes on while the learner works in other windows.
 */
const dock = h('div', { class: 'jam-dock', 'aria-label': 'Jam video players' });
const slots: Record<D, HTMLElement> = { A: h('div', { class: 'jam-video-slot', 'data-deck': 'A' }), B: h('div', { class: 'jam-video-slot', 'data-deck': 'B' }) };
/** Covers YouTube's own error screen (and its "Watch on YouTube" link) with Jam's. */
const covers: Record<D, HTMLElement> = { A: h('div', { class: 'jam-cover' }), B: h('div', { class: 'jam-cover' }) };
dock.append(slots.A, slots.B);
const attachDock = (): void => { if (!dock.isConnected) document.body.appendChild(dock); };
if (document.body) attachDock(); else addEventListener('DOMContentLoaded', attachDock);

const ytOn = (d: D): boolean => !!players[d] && deckTrack(d)?.kind === 'yt';
function placeDock(): void {
  const locked = [...document.querySelectorAll<HTMLElement>('.lk')].some((e) => e.getClientRects().length > 0);
  dock.style.visibility = locked ? 'hidden' : '';
  const monitor = document.querySelector<HTMLElement>('[data-jam-video="main"]');
  let r = monitor?.isConnected ? monitor.getBoundingClientRect() : null;
  // Another window (or the Start menu) in front of the monitor: move the players off screen instead of covering it.
  if (r && r.width > 40) {
    const pts: [number, number][] = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4]];
    const covered = pts.some(([x, y]) => { const top = document.elementsFromPoint(x, y).find((e) => !dock.contains(e)); return !!top && !monitor!.contains(top); });
    if (covered) r = null;
  }
  const shown = DECKS.filter(ytOn);
  const front = shown.length === 2 ? (outputVolume('A') >= outputVolume('B') ? 'A' : 'B') : shown[0];
  let mini = 0;
  for (const d of DECKS) {
    const slot = slots[d];
    if (!ytOn(d)) { slot.style.display = 'none'; continue; }
    slot.style.display = '';
    if (r && r.width > 40 && r.height > 30) {
      slot.classList.remove('mini');
      const pip = d !== front;
      const w = pip ? r.width * 0.34 : r.width, hgt = pip ? r.height * 0.34 : r.height;
      const left = pip ? r.right - w - 5 : r.left, top = pip ? r.top + 5 : r.top;
      const c = monitor!.closest('.ia')?.getBoundingClientRect() ?? r;
      const t = Math.max(0, c.top - top), b = Math.max(0, top + hgt - c.bottom), l = Math.max(0, c.left - left), rt = Math.max(0, left + w - c.right);
      Object.assign(slot.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${hgt}px`, right: '', bottom: '', zIndex: pip ? '2' : '1', clipPath: `inset(${t}px ${rt}px ${b}px ${l}px round 3px)`, visibility: t + b >= hgt || l + rt >= w ? 'hidden' : '' });
    } else {
      // Jam not on screen: the players wait off screen, still playing, instead of floating over the desktop.
      slot.classList.add('mini');
      Object.assign(slot.style, { left: '-10000px', top: '0px', right: '', bottom: '', width: '320px', height: '180px', zIndex: '', clipPath: '', visibility: '' });
      mini++;
    }
  }
}
// Smooth while the page is painting; the interval keeps it right when frames are paused.
const frameLoop = (): void => { placeDock(); requestAnimationFrame(frameLoop); };
requestAnimationFrame(frameLoop);
setInterval(placeDock, 200);

function showError(d: D, code: number): void {
  const t = deckTrack(d);
  const blocked = [101, 150, 100, 152].includes(code);
  // The Windows app's lab Chrome shows real youtube.com inside the app, where label-restricted videos still play.
  const desktopApp = !!(globalThis as any).chrome?.webview;
  live[d].error = blocked ? 'The song\'s owner limits which sites may play it. Pick another upload (lyric or audio versions usually play).' : 'YouTube could not play this video here.';
  live[d].playing = false;
  covers[d].replaceChildren(
    h('b', null, blocked ? 'This upload is limited by its owner' : 'Video unavailable'),
    h('p', null, blocked ? 'Record labels often block their videos on other sites. Load another upload of the same song.' : 'YouTube refused this video. Try another upload.'),
    h('div', null,
      desktopApp && t ? h('button', { type: 'button', onClick: () => G.CorpDesk?.newBrowserTab?.(`https://www.youtube.com/watch?v=${t.id}`) }, 'Play in the lab browser') : null,
      h('button', { type: 'button', onClick: () => { openApp('jam'); void searchYouTube(t && !t.title.startsWith('YouTube video') ? `${t.title} audio` : 'official audio'); } }, 'Find another upload'),
      h('button', { type: 'button', onClick: () => { covers[d].classList.remove('on'); jam().decks[d].trackId = null; players[d]?.stopVideo?.(); save(); } }, 'Eject')));
  covers[d].classList.add('on');
  G.save();
}
async function ensurePlayer(d: D, id: string): Promise<any> {
  await loadApi();
  if (players[d]) return players[d];
  attachDock();
  // Jam builds the iframe itself so it can be sandboxed (no pop-ups) before YouTube loads in it.
  const frame = h('iframe', { src: embedUrl(id), title: `Jam deck ${d} video`, allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture', allowfullscreen: true, sandbox: SANDBOX, referrerpolicy: 'strict-origin-when-cross-origin' });
  slots[d].replaceChildren(frame, covers[d], h('span', { class: 'jam-slot-label', title: 'Open Jam', onClick: () => openApp('jam') }, `JAM · DECK ${d}`));
  await new Promise<void>((resolve) => {
    players[d] = new YT.Player(frame, {
      events: {
        onReady: () => resolve(),
        onStateChange: (e: any) => { if (deckTrack(d)?.kind !== 'yt') return; live[d].playing = e.data === 1; if (e.data === 1) covers[d].classList.remove('on'); fillTitle(d); G.save(); },
        onError: (e: any) => showError(d, Number(e.data)),
      },
    });
  });
  return players[d];
}
function fillTitle(d: D): void {
  const t = deckTrack(d), info = players[d]?.getVideoData?.();
  if (!t || t.kind !== 'yt' || !info?.title || info.video_id !== t.id) return;
  const dur = players[d]?.getDuration?.() ?? 0;
  if (!t.title.startsWith('YouTube video') && t.duration) return;
  if (t.title.startsWith('YouTube video')) { t.title = String(info.title); t.artist = String(info.author ?? ''); }
  if (dur) t.duration = dur;
  save();
}

// ---------------------------------------------------------------- deck engine
/** Constant-power crossfader x channel fader x master, as AIHub's mixer. 0-100 for YouTube. */
function outputVolume(d: D): number {
  const j = jam();
  const curve = d === 'A' ? Math.cos((j.xfade * Math.PI) / 2) : Math.sin((j.xfade * Math.PI) / 2);
  return j.sandbox ? 0 : Math.round(100 * j.decks[d].vol * Math.min(1, curve * Math.SQRT2) * j.master);
}
function applyMix(): void {
  for (const d of DECKS) {
    players[d]?.setVolume?.(outputVolume(d));
    if (graphs[d]) { const j = jam(); const curve = d === 'A' ? Math.cos((j.xfade * Math.PI) / 2) : Math.sin((j.xfade * Math.PI) / 2); graphs[d]!.channel.gain.value = j.decks[d].vol * Math.min(1, curve * Math.SQRT2) * j.master; }
  }
  applyMasterOut();
}
function applyRate(d: D): void {
  const ds = jam().decks[d], rate = 1 + ds.pitch;
  if (deckTrack(d)?.kind === 'yt') players[d]?.setPlaybackRate?.(rate);
  const g = graphs[d];
  if (g) { g.audio.playbackRate = rate; (g.audio as any).preservesPitch = ds.keylock; }
}
const now = (d: D): number => (deckTrack(d)?.kind === 'file' ? graphs[d]?.audio.currentTime ?? 0 : players[d]?.getCurrentTime?.() ?? 0);
const length = (d: D): number => { const t = deckTrack(d); if (t?.kind === 'file') return graphs[d]?.audio.duration || t.duration || 0; return players[d]?.getDuration?.() || t?.duration || 0; };
function seek(d: D, t: number): void {
  t = Math.max(0, t);
  if (deckTrack(d)?.kind === 'file') { if (graphs[d]) graphs[d]!.audio.currentTime = t; }
  else players[d]?.seekTo?.(t, true);
  live[d].time = t;
}
const PITCH_RANGE = 0.08;

async function loadTrack(d: D, t: Track, autoplay = false): Promise<void> {
  const j = jam(), ds = j.decks[d];
  if (t.kind === 'yt' && !j.library.some((x) => x.id === t.id)) addToLibrary(t.id, t.title, t.artist, t.duration);
  players[d]?.pauseVideo?.(); graphs[d]?.audio.pause();
  covers[d].classList.remove('on');
  ds.trackId = t.id; ds.cues = [null, null, null];
  Object.assign(live[d], { playing: false, time: 0, duration: t.duration, error: '', loopIn: null, loopOut: null, loop: false });
  save();
  if (t.kind === 'file') {
    const g = graph(d), f = files.get(t.id);
    if (!f) { live[d].error = 'This song was added in an earlier session. Add it again from your computer.'; G.save(); return; }
    g.audio.src = f.url;
    applyFx(d); applyRate(d); applyMix();
    if (autoplay) await play(d);
  } else {
    const p = await ensurePlayer(d, t.id);
    if (autoplay) p.loadVideoById(t.id); else p.cueVideoById(t.id);
    applyRate(d); applyMix();
    setTimeout(() => fillTitle(d), 1500);
  }
}
async function play(d: D): Promise<void> {
  const t = deckTrack(d);
  if (!t) { toast(`Load a song on deck ${d} first.`); return; }
  applyMix();
  if (t.kind === 'file') {
    const g = graph(d);
    try { await g.audio.play(); live[d].playing = true; } catch { toast('The browser blocked playback. Press play again.'); }
    G.save();
  } else {
    const p = await ensurePlayer(d, t.id);
    if (p.getVideoData?.()?.video_id !== t.id) p.cueVideoById(t.id);
    p.playVideo();
  }
}
function pause(d: D): void {
  if (deckTrack(d)?.kind === 'file') { graphs[d]?.audio.pause(); live[d].playing = false; G.save(); }
  else players[d]?.pauseVideo?.();
}
const toggle = (d: D): void => { if (live[d].playing) pause(d); else void play(d); };
function stop(d: D): void { pause(d); seek(d, 0); }
function eject(d: D): void { if (live[d].playing) return; players[d]?.stopVideo?.(); graphs[d]?.audio.removeAttribute('src'); covers[d].classList.remove('on'); jam().decks[d].trackId = null; live[d] = { ...live[d], time: 0, duration: 0, error: '' }; save(); }
function cue(d: D): void {
  const ds = jam().decks[d];
  if (!deckTrack(d)) return;
  if (live[d].playing) { pause(d); seek(d, ds.cues[0] ?? 0); return; }
  ds.cues[0] = now(d); save();
}
function hotCue(d: D, i: number): void {
  const ds = jam().decks[d];
  if (!deckTrack(d)) { toast(`Load a song on deck ${d} first.`); return; }
  if (ds.cues[i] == null) ds.cues[i] = now(d);
  else { seek(d, ds.cues[i]!); if (!live[d].playing) void play(d); }
  save();
}
const beatLen = (d: D): number => 60 / ((deckTrack(d)?.bpm || 120) * (1 + jam().decks[d].pitch));
function sync(d: D): boolean {
  const a = deckTrack(d), b = deckTrack(other(d)), j = jam();
  if (!a?.bpm || !b?.bpm) { toast('SYNC needs the BPM of both songs. Jam measures BPM for songs from your computer; match YouTube songs by ear with the pitch fader.'); return false; }
  const target = b.bpm * (1 + j.decks[other(d)].pitch);
  j.decks[d].pitch = clamp(target / a.bpm - 1, -PITCH_RANGE, PITCH_RANGE);
  applyRate(d); save(); return true;
}
let fading = false;
/** Fade to the other side over 8 seconds, starting that deck first. */
function fadeTo(to: D): void {
  const j = jam();
  if (!deckTrack(to)) { toast(`Load a song on deck ${to} to mix into.`); return; }
  if (fading) { fading = false; return; }
  fading = true;
  void play(to);
  const start = j.xfade, end = to === 'B' ? 1 : 0, t0 = performance.now();
  const timer = setInterval(() => {
    if (!fading) { clearInterval(timer); save(); return; }
    const k = Math.min(1, (performance.now() - t0) / 8000);
    j.xfade = start + (end - start) * k; applyMix();
    document.querySelectorAll<HTMLElement>('.jam-dj .dj-xfader .dj-hfader-cap').forEach((c) => { c.style.left = `calc(${j.xfade} * (100% - 18px))`; });
    if (k >= 1) { clearInterval(timer); fading = false; pause(other(to)); save(); }
  }, 50);
}

// ---------------------------------------------------------------- recording (Web Audio master)
let recorder: MediaRecorder | null = null;
let recChunks: Blob[] = [];
let recStarted = 0;
let recBytes = 0;
function toggleRec(): void {
  if (recorder) { recorder.stop(); return; }
  ctx();
  if (DECKS.some((d) => deckTrack(d)?.kind === 'yt')) toast('Recording the mix. YouTube decks play inside YouTube\'s player, so only songs from your computer and the sampler are captured.');
  const mime = ['audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  recorder = new MediaRecorder(recDest!.stream, mime ? { mimeType: mime } : undefined);
  recChunks = []; recBytes = 0; recStarted = performance.now();
  recorder.ondataavailable = (e) => { if (e.data.size) { recChunks.push(e.data); recBytes += e.data.size; } };
  recorder.onstop = () => {
    const blob = new Blob(recChunks, { type: 'audio/webm' });
    recorder = null; G.save();
    if (!blob.size) { toast('Nothing was recorded.'); return; }
    const a = h('a', { href: URL.createObjectURL(blob), download: `jam-mix-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm` });
    document.body.append(a); a.click(); a.remove();
    toast('Mix saved to your Downloads.');
  };
  recorder.start(1000);
  G.save();
}

// ---------------------------------------------------------------- public: add from YouTube
export function addToLibrary(id: string, title?: string, artist = '', duration = 0): Track {
  const j = jam();
  let t = j.library.find((x) => x.id === id);
  if (!t) { t = { id, kind: 'yt', title: title || `YouTube video ${id}`, artist, duration, bpm: 0 }; j.library.unshift(t); j.library = j.library.slice(0, 300); save(); }
  return t;
}
/** Send a YouTube link to a deck (or the first free one). */
export function sendToJam(url: string, title?: string, deck?: D): void {
  const id = youtubeId(url);
  if (!id) { toast('That is not a YouTube video link.'); return; }
  const t = addToLibrary(id, title), j = jam();
  const d = deck ?? (!j.decks.A.trackId ? 'A' : !j.decks.B.trackId ? 'B' : live.A.playing ? 'B' : 'A');
  openApp('jam');
  void loadTrack(d, t);
  toast(`Loaded on deck ${d}.`);
}

// ---------------------------------------------------------------- controls (AIHub's Knob, VFader, HFader, VuMeter, LedButton)
let knobSeq = 0;
function knob(o: { value: number; onChange: (v: number) => void; label?: string; size?: number; center?: number; def?: number; color?: string; title?: string; disabled?: boolean }): HTMLElement {
  const size = o.size ?? 34, center = o.center ?? 0.5, color = o.color ?? '#3b82f6', def = o.def ?? 0.5;
  let value = o.value;
  const c = size / 2, r = size / 2 - 3, ridges = Math.max(18, Math.round(size * 0.75));
  const arc = (from: number, to: number): string => {
    const a0 = ((-135 + from * 270) - 90) * Math.PI / 180, a1 = ((-135 + to * 270) - 90) * Math.PI / 180;
    const R = r + 1.5, x0 = c + R * Math.cos(a0), y0 = c + R * Math.sin(a0), x1 = c + R * Math.cos(a1), y1 = c + R * Math.sin(a1);
    return `M${x0} ${y0} A${R} ${R} 0 ${Math.abs(to - from) * 270 > 180 ? 1 : 0} ${to > from ? 1 : 0} ${x1} ${y1}`;
  };
  const id = `jk${++knobSeq}`;
  const lines = Array.from({ length: ridges }, (_, i) => { const a = (i / ridges) * Math.PI * 2; return `<line x1="${c + Math.cos(a) * (r - 1.2)}" y1="${c + Math.sin(a) * (r - 1.2)}" x2="${c + Math.cos(a) * (r - 2.6)}" y2="${c + Math.sin(a) * (r - 2.6)}" stroke="rgba(0,0,0,0.4)" stroke-width="0.7"/>`; }).join('');
  const svg = svgEl(`<svg width="${size}" height="${size}" role="slider" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="${id}g" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#ffffff"/><stop offset="55%" stop-color="#c9ccd1"/><stop offset="100%" stop-color="#7d828a"/></radialGradient><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#eceef0"/><stop offset="100%" stop-color="#80858c"/></linearGradient><radialGradient id="${id}p" cx="35%" cy="28%" r="45%"><stop offset="0%" stop-color="#fff" stop-opacity="0.9"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle class="dj-knob-base" cx="${c}" cy="${c}" r="${r + 2.5}" fill="#1d1f23"/><path class="jam-knob-arc" d="" stroke="${color}" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="${c + 0.6}" cy="${c + 1.2}" r="${r - 0.6}" fill="rgba(0,0,0,0.45)"/><g class="jam-knob-turn"><circle class="dj-knob-skirt" cx="${c}" cy="${c}" r="${r - 1}" fill="url(#${id}s)" stroke="#0e0f11" stroke-width="0.8"/>${lines}</g><circle class="dj-knob-cap" cx="${c}" cy="${c}" r="${r - 2.6}" fill="url(#${id}g)" stroke="#6b7078" stroke-width="0.6"/><ellipse cx="${c - r * 0.18}" cy="${c - r * 0.3}" rx="${r * 0.5}" ry="${r * 0.32}" fill="url(#${id}p)"/><g class="jam-knob-turn"><rect class="dj-knob-lip" x="${c - 1.1 + 0.5}" y="4.6" width="2.2" height="${r * 0.55}" rx="1" fill="rgba(255,255,255,0.7)"/><rect class="dj-knob-ptr" x="${c - 1.1}" y="4" width="2.2" height="${r * 0.55}" rx="1" fill="#16181b"/></g></svg>`) as SVGSVGElement;
  const paint = (): void => {
    const angle = -135 + value * 270;
    svg.querySelectorAll('.jam-knob-turn').forEach((g) => g.setAttribute('transform', `rotate(${angle} ${c} ${c})`));
    const p = svg.querySelector('.jam-knob-arc')!;
    p.setAttribute('d', Math.abs(value - center) > 0.004 ? arc(Math.min(center, value), Math.max(center, value)) : '');
    svg.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  };
  paint();
  svg.setAttribute('aria-label', o.title ?? o.label ?? '');
  const set = (v: number): void => { value = clamp01(v); paint(); o.onChange(value); };
  let start: { y: number; v: number } | null = null;
  svg.addEventListener('pointerdown', (e) => { if (e.button !== 0 || o.disabled) return; svg.setPointerCapture(e.pointerId); start = { y: e.clientY, v: value }; e.preventDefault(); });
  svg.addEventListener('pointermove', (e) => { if (!start) return; let dv = (start.y - e.clientY) / 160; if (e.shiftKey) dv *= 0.2; set(start.v + dv); });
  const end = (): void => { if (start) { start = null; save(); } };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', (e) => { if (o.disabled) return; e.preventDefault(); set(value + (e.shiftKey ? 0.005 : 0.025) * (e.deltaY < 0 ? 1 : -1)); save(); }, { passive: false });
  svg.addEventListener('dblclick', () => { if (!o.disabled) { set(def); save(); } });
  return h('div', { class: 'dj-knob', title: o.title ?? o.label }, svg, o.label ? h('span', { class: 'dj-knob-label' }, o.label) : null);
}
function vfader(o: { value: number; onChange: (v: number) => void; height?: number; def?: number; invert?: boolean; cls?: string; title?: string; ticks?: number }): HTMLElement {
  const height = o.height ?? 120;
  let value = o.value;
  const cap = h('div', { class: 'dj-vfader-cap' });
  const paint = (): void => { cap.style.top = `calc(${o.invert ? value : 1 - value} * (100% - 22px))`; };
  paint();
  const el = h('div', { class: `dj-vfader ${o.cls ?? ''}`, style: `height:${height}px`, title: o.title, role: 'slider', 'aria-label': o.title },
    h('div', { class: 'dj-vfader-ticks' }, Array.from({ length: o.ticks ?? 11 }, () => h('i'))),
    h('div', { class: 'dj-vfader-slot' }), cap);
  const set = (v: number): void => { value = clamp01(v); paint(); o.onChange(value); };
  let start: { y: number; v: number } | null = null;
  el.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; el.setPointerCapture(e.pointerId); start = { y: e.clientY, v: value }; e.preventDefault(); });
  el.addEventListener('pointermove', (e) => { if (!start) return; let dv = (start.y - e.clientY) / (height - 22); if (o.invert) dv = -dv; if (e.shiftKey) dv *= 0.2; set(start.v + dv); });
  const end = (): void => { if (start) { start = null; save(); } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', (e) => { e.preventDefault(); set(value + (e.shiftKey ? 0.005 : 0.025) * (e.deltaY < 0 ? 1 : -1) * (o.invert ? -1 : 1)); save(); }, { passive: false });
  el.addEventListener('dblclick', () => { set(o.def ?? 0.75); save(); });
  return el;
}
function hfader(o: { value: number; onChange: (v: number) => void; width?: number; def?: number; title?: string }): HTMLElement {
  const width = o.width ?? 150;
  let value = o.value;
  const cap = h('div', { class: 'dj-hfader-cap' });
  const paint = (): void => { cap.style.left = `calc(${value} * (100% - 18px))`; };
  paint();
  const el = h('div', { class: 'dj-hfader', style: `width:${width}px`, title: o.title, role: 'slider', 'aria-label': o.title }, h('div', { class: 'dj-hfader-slot' }), cap);
  const set = (v: number): void => { value = clamp01(v); paint(); o.onChange(value); };
  let start: { x: number; v: number } | null = null;
  el.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; el.setPointerCapture(e.pointerId); start = { x: e.clientX, v: value }; fading = false; e.preventDefault(); });
  el.addEventListener('pointermove', (e) => { if (!start) return; let dv = (e.clientX - start.x) / (width - 18); if (e.shiftKey) dv *= 0.2; set(start.v + dv); });
  const end = (): void => { if (start) { start = null; save(); } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('dblclick', () => { set(o.def ?? 0.5); save(); });
  return el;
}
/** AIHub's segmented meter: a lit strip with a dark cover and a peak marker moved by transforms. */
function vu(key: string, segments = 16, horizontal = false, height = 120): HTMLElement {
  return h('div', { class: `dj-vu ${horizontal ? 'dj-vu-h' : ''}`, style: horizontal ? null : `height:${height}px`, 'data-segments': String(segments), 'data-jam-vu': key },
    Array.from({ length: segments }, (_, i) => h('i', { class: 'lit', 'data-zone': i < 3 ? 'red' : i < 6 ? 'amber' : 'green' })),
    h('div', { class: 'dj-vu-cover' }), h('div', { class: 'dj-vu-hold', style: `${horizontal ? 'width' : 'height'}:${100 / segments}%` }));
}
const led = (label: string | Node, on: boolean, color: 'green' | 'orange' | 'blue', onClick: (e: MouseEvent) => void, cls = '', title?: string): HTMLButtonElement =>
  h('button', { type: 'button', class: `dj-btn ${on ? `dj-on dj-on-${color}` : ''} ${cls}`, title, onClick }, label);

function dropTarget(el: HTMLElement, d: D): HTMLElement {
  el.addEventListener('dragover', (e) => { if (!e.dataTransfer) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; el.classList.add('dj-drop-hot'); });
  el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget as Node)) el.classList.remove('dj-drop-hot'); });
  el.addEventListener('drop', (e) => {
    e.preventDefault(); el.classList.remove('dj-drop-hot');
    const dt = e.dataTransfer; if (!dt) return;
    const id = dt.getData('application/x-jam-track');
    if (id && trackOf(id)) { void loadTrack(d, trackOf(id)!); return; }
    if (dt.files.length) { const t = addFiles(dt.files)[0]; if (t) void loadTrack(d, t); return; }
    const text = dt.getData('text/uri-list') || dt.getData('text/plain');
    if (text) sendToJam(text, undefined, d);
  });
  return el;
}

// ---------------------------------------------------------------- live updates (no full redraw)
function deckDb(d: D): number {
  const g = graphs[d];
  if (g && live[d].playing && deckTrack(d)?.kind === 'file') return rmsDb(g.meter);
  // YouTube keeps its audio inside its own player: the meter follows the fader there.
  if (live[d].playing) return 20 * Math.log10(Math.max(1e-4, (outputVolume(d) / 100) * (0.35 + Math.random() * 0.25)));
  return -96;
}
const fbuf = new Float32Array(1024);
function rmsDb(a: AnalyserNode): number { a.getFloatTimeDomainData(fbuf); let s = 0; for (let i = 0; i < a.fftSize; i++) s += fbuf[i] * fbuf[i]; return 10 * Math.log10(s / a.fftSize + 1e-10); }
function masterDb(i: 0 | 1): number {
  let db = actx && masterAnalyser[i] ? rmsDb(masterAnalyser[i]) : -96;
  for (const d of DECKS) if (live[d].playing && deckTrack(d)?.kind === 'yt') db = Math.max(db, deckDb(d));
  return db;
}
const peaks = new Map<string, { db: number; at: number }>();
function paintVu(el: HTMLElement, db: number): void {
  const segments = Number(el.dataset.segments) || 16, horizontal = el.classList.contains('dj-vu-h');
  const key = el.dataset.jamVu!, t = performance.now(), p = peaks.get(key) ?? { db: -96, at: 0 };
  if (db > p.db || t - p.at > 900) peaks.set(key, { db, at: t });
  const level = (x: number): number => clamp01((x + 42) / 42);
  const lit = Math.round(level(db) * segments), hold = Math.round(level(peaks.get(key)!.db) * segments);
  const cover = el.querySelector<HTMLElement>('.dj-vu-cover'), holdEl = el.querySelector<HTMLElement>('.dj-vu-hold');
  if (cover) cover.style.transform = horizontal ? `scaleX(${1 - lit / segments})` : `scaleY(${1 - lit / segments})`;
  if (holdEl) { holdEl.style.opacity = hold > lit ? '1' : '0'; holdEl.style.transform = horizontal ? `translateX(${Math.max(0, hold - 1) * 100}%)` : `translateY(${(segments - Math.max(1, hold)) * 100}%)`; }
}
let cpuLast = performance.now(), cpuLag = 0;
setInterval(() => { const t = performance.now(); cpuLag = cpuLag * 0.7 + clamp01((t - cpuLast - 100) / 100) * 0.3; cpuLast = t; }, 100);

setInterval(() => {
  const j = jam();
  for (const d of DECKS) {
    const t = deckTrack(d);
    if (!t) continue;
    const L = live[d];
    if (t.kind === 'file' && graphs[d]) L.playing = !graphs[d]!.audio.paused;
    L.time = now(d); L.duration = length(d);
    if (L.loop && L.loopIn != null && L.loopOut != null && L.time >= L.loopOut) seek(d, L.loopIn);
    if (t.kind === 'file' && j.decks[d].fxType === 'filter' && j.decks[d].fx.on && graphs[d]) {
      const sweep = 0.5 + Math.sin(performance.now() / 1000 * (0.2 + j.decks[d].fx.spd * 2)) * 0.45 * j.decks[d].fx.str;
      const g = graphs[d]!; g.filter.type = sweep < 0.5 ? 'lowpass' : 'highpass'; g.filter.frequency.value = sweep < 0.5 ? 20000 * Math.pow(2, (sweep * 2 - 1) * 10) : 20 * Math.pow(2, (sweep * 2 - 1) * 10);
    }
    // Automix: as the playing song nears its end, mix into the next song in the set.
    if (j.automix && L.playing && !fading && L.duration > 20 && L.duration - L.time < 12 && !live[other(d)].playing) {
      const next = trackOf(j.queue[0] ?? null);
      if (next) { j.queue.shift(); void loadTrack(other(d), next).then(() => fadeTo(other(d))); }
    }
  }
  paintLive();
}, 50);

const SPAN = 6; // seconds across a zoom waveform
function paintLive(): void {
  const root = document.querySelector<HTMLElement>('.jam-dj');
  if (!root) return;
  const j = jam();
  const clock = root.querySelector<HTMLElement>('[data-jam-clock]');
  if (clock) clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const rec = root.querySelector<HTMLElement>('[data-jam-rec]');
  if (rec) { const secs = recorder ? (performance.now() - recStarted) / 1000 : 0, kb = recBytes / 1024; rec.textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(Math.floor(secs % 60)).padStart(2, '0')} / ${kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`}`; }
  const lit = Math.round(cpuLag * 8);
  root.querySelectorAll('.dj-cpu-bar i').forEach((el, i) => { el.className = i < lit ? (i >= 6 ? 'hot' : i >= 4 ? 'warm' : 'on') : ''; });
  root.querySelectorAll<HTMLElement>('.dj-hit').forEach((el) => el.classList.toggle('dj-hit-lit', !!hitLit && el.dataset.hit === hitLit.id && performance.now() - hitLit.at < 160));
  for (const d of DECKS) {
    const L = live[d], ds = j.decks[d], t = deckTrack(d);
    root.querySelectorAll<HTMLElement>(`[data-jam-time="${d}"]`).forEach((el) => { el.textContent = (j.remain[d] && t ? '-' : '') + fmtTime(j.remain[d] ? Math.max(0, L.duration - L.time) : L.time); });
    root.querySelector(`.dj-time[data-deck="${d}"]`)?.classList.toggle('dj-warn', !!t && L.playing && L.duration - L.time < 30);
    root.querySelector(`.dj-deck-letter[data-deck="${d}"]`)?.classList.toggle('dj-live', L.playing);
    const platter = root.querySelector<HTMLElement>(`.dj-platter[data-deck="${d}"]`);
    if (platter) {
      platter.classList.toggle('jam-spinning', L.playing);
      const arm = platter.querySelector<HTMLElement>('.dj-tonearm');
      const angle = t ? 19 + clamp01(L.duration ? L.time / L.duration : 0) * 24 : 0;
      if (arm && Math.abs(Number(arm.dataset.angle ?? -1) - angle) > 0.05) { arm.dataset.angle = String(angle); arm.style.transform = `rotate(${angle.toFixed(2)}deg)`; }
      platter.querySelector('.dj-hw-target')?.classList.toggle('dj-on', !!t);
    }
    root.querySelector(`.dj-hw-lamp[data-deck="${d}"]`)?.classList.toggle('dj-on', L.playing);
    const pb = root.querySelector<HTMLElement>(`.dj-play[data-deck="${d}"]`);
    if (pb && pb.classList.contains('dj-playing') !== L.playing) { pb.classList.toggle('dj-playing', L.playing); pb.replaceChildren(ic(L.playing ? 'pause' : 'play', 22)); pb.title = L.playing ? 'Pause' : 'Play'; }
    const bpm = root.querySelector<HTMLElement>(`[data-jam-bpm="${d}"]`);
    if (bpm) bpm.textContent = t?.bpm ? (t.bpm * (1 + ds.pitch)).toFixed(2) : '00.00';
    paintZoom(root.querySelector<HTMLCanvasElement>(`canvas[data-jam-strip="${d}"]`), [d], true);
    paintOverview(root.querySelector<HTMLCanvasElement>(`canvas[data-jam-overview="${d}"]`), d);
  }
  paintZoom(root.querySelector<HTMLCanvasElement>('canvas.dj-zoomwave'), DECKS, false);
  root.querySelectorAll<HTMLElement>('[data-jam-vu]').forEach((el) => {
    const k = el.dataset.jamVu!;
    paintVu(el, k === 'A' || k === 'B' ? deckDb(k) : masterDb(k.endsWith('R') ? 1 : 0));
  });
  // Now playing.
  const np = root.querySelector<HTMLElement>('.dj-nowplaying');
  if (np) {
    const air = DECKS.filter((d) => live[d].playing).sort((a, b) => outputVolume(b) - outputVolume(a))[0];
    const shown = air ?? DECKS.find((d) => deckTrack(d));
    const t = shown ? deckTrack(shown) : null;
    np.classList.toggle('dj-np-live', !!air);
    const lamp = np.querySelector('.dj-np-lamp'); if (lamp) lamp.firstChild!.textContent = air ? 'ON AIR' : shown ? 'READY' : 'IDLE';
    const tt = np.querySelector('.dj-np-text b'); if (tt) tt.textContent = t ? t.title : 'Load a song to begin';
    const ts = np.querySelector('.dj-np-text small'); if (ts) ts.textContent = t ? [t.artist, `Deck ${shown}`].filter(Boolean).join(' · ') : 'Search YouTube below, or add songs from your computer';
    const time = np.querySelector('.dj-np-time span'), bar = np.querySelector<HTMLElement>('.dj-np-bar div');
    if (shown && live[shown].duration) { if (time) time.textContent = `-${fmtTime(Math.max(0, live[shown].duration - live[shown].time), false)}`; if (bar) bar.style.transform = `scaleX(${Math.min(1, live[shown].time / live[shown].duration)})`; }
    else { if (time) time.textContent = '--:--'; if (bar) bar.style.transform = 'scaleX(0)'; }
    const nb = np.querySelector('.dj-np-stat b'); if (nb) nb.textContent = t?.bpm ? (t.bpm * (1 + j.decks[shown!].pitch)).toFixed(1) : '--';
    const nxt = shown ? deckTrack(other(shown)) : null; const nn = np.querySelector('.dj-np-next b'); if (nn) nn.textContent = nxt && !live[other(shown!)].playing ? nxt.title : '—';
  }
  // Scope.
  const scope = root.querySelector<HTMLCanvasElement>('.dj-scope-menu canvas');
  if (scope && actx && masterAnalyser[0]) {
    const g = scope.getContext('2d'), bins = new Uint8Array(masterAnalyser[0].frequencyBinCount);
    masterAnalyser[0].getByteFrequencyData(bins);
    if (g) {
      const w = scope.width, hh = scope.height, n = 48, nyq = actx.sampleRate / 2;
      g.fillStyle = '#07090b'; g.fillRect(0, 0, w, hh);
      for (let i = 0; i < n; i++) {
        const f0 = 40 * Math.pow(400, i / n), f1 = 40 * Math.pow(400, (i + 1) / n), b0 = Math.floor((f0 / nyq) * bins.length), b1 = Math.max(b0 + 1, Math.floor((f1 / nyq) * bins.length));
        let m = 0; for (let b = b0; b < b1 && b < bins.length; b++) m = Math.max(m, bins[b]);
        const bh = (m / 255) * (hh - 4), gr = g.createLinearGradient(0, hh, 0, 0);
        gr.addColorStop(0, '#22c55e'); gr.addColorStop(0.65, '#facc15'); gr.addColorStop(1, '#ef4444');
        g.fillStyle = gr; g.fillRect(i * (w / n) + 1, hh - bh, w / n - 2, bh);
      }
    }
  }
}
/** AIHub DJ's deck colours: a bright band with the bass band inside it. */
const DECK_COLORS: Record<D, { hi: string; lo: string }> = { A: { hi: '#4cc3ff', lo: '#1d5fff' }, B: { hi: '#ff8a3d', lo: '#ff2d55' } };
const COLORS: Record<D, string> = { A: '#4cc3ff', B: '#ff2d55' };
const ZOOM_SECONDS = 12, STRIP_SECONDS = 6;
/** #rrggbb + alpha as one little-endian RGBA pixel. */
function pixel(hex: string, alpha = 255): number { const n = parseInt(hex.slice(1), 16); return ((alpha << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0; }
const rasters = new WeakMap<HTMLCanvasElement, { img: ImageData; px: Uint32Array }>();
function sizeCanvas(cv: HTMLCanvasElement): { g: CanvasRenderingContext2D; w: number; h: number; k: number } | null {
  const w = cv.clientWidth, hh = cv.clientHeight;
  if (!w || !hh) return null;
  const k = Math.min(1.5, devicePixelRatio || 1);
  if (cv.width !== Math.round(w * k) || cv.height !== Math.round(hh * k)) { cv.width = Math.round(w * k); cv.height = Math.round(hh * k); }
  const g = cv.getContext('2d');
  if (!g) return null;
  g.setTransform(k, 0, 0, k, 0, 0);
  return { g, w, h: hh, k };
}
/**
 * Both decks scrolling right to left past a centre needle with their beat
 * grids (AIHub's ZoomWave): the waveform is written into a pixel buffer, the
 * part already played dimmed, then the grid, cue, loop and needle on top.
 */
function paintZoom(cv: HTMLCanvasElement | null, decks: D[], compact: boolean): void {
  if (!cv) return;
  const f = sizeCanvas(cv); if (!f) return;
  const { g, w, h, k } = f, W = cv.width, H = cv.height, lane = h / decks.length, center = w / 2, seconds = compact ? STRIP_SECONDS : ZOOM_SECONDS;
  let r = rasters.get(cv);
  if (!r || r.img.width !== W || r.img.height !== H) { const img = g.createImageData(W, H); r = { img, px: new Uint32Array(img.data.buffer) }; rasters.set(cv, r); } else r.px.fill(0);
  const { img, px } = r;
  decks.forEach((d, i) => {
    const t = deckTrack(d), L = live[d];
    if (!t) return;
    const env = envFor(t, L.duration);
    if (!env) return;
    const col = DECK_COLORS[d], hi = pixel(col.hi), lo = pixel(col.lo), hiPast = pixel(col.hi, 140), loPast = pixel(col.lo, 140);
    const laneD = H / decks.length, midD = i * laneD + laneD / 2, half = (lane / 2 - 2) * k;
    const rate = 1 + jam().decks[d].pitch, sppD = (seconds * rate) / w / k, t0 = L.time - (W / 2) * sppD;
    for (let x = 0; x < W; x++) {
      const ta = t0 + x * sppD;
      const f0 = Math.max(0, Math.floor(ta * ENV_RATE)), f1 = Math.min(env.amp.length, Math.max(f0 + 1, Math.floor((ta + sppD) * ENV_RATE)));
      let a = 0, l = 0;
      for (let q = f0; q < f1; q++) { if (env.amp[q]! > a) a = env.amp[q]!; if (env.low[q]! > l) l = env.low[q]!; }
      if (!a) continue;
      const past = x < W / 2, ah = Math.max(0.5, a * half), lh = l * a * half;
      const bar = (y0: number, y1: number, c: number): void => { const a0 = Math.max(0, Math.floor(y0)), b0 = Math.min(H, Math.ceil(y1)); for (let y = a0; y < b0; y++) px[y * W + x] = c; };
      bar(midD - ah, midD + ah, past ? hiPast : hi);
      if (lh >= 0.5) bar(midD - lh, midD + lh, past ? loPast : lo);
    }
  });
  g.putImageData(img, 0, 0);
  decks.forEach((d, i) => {
    const t = deckTrack(d), L = live[d], top = i * lane, mid = top + lane / 2;
    const spp = (seconds * (1 + jam().decks[d].pitch)) / w, t0 = L.time - center * spp, xOf = (s: number): number => (s - t0) / spp;
    if (t) {
      // Beat grid: bars long and bright, beats short and dim, at the top and bottom of the lane.
      const bl = beatLen(d), bars = new Path2D(), beats = new Path2D();
      for (let n = Math.ceil(t0 / bl); n * bl < t0 + w * spp; n++) {
        const x = xOf(n * bl), isBar = ((n % 4) + 4) % 4 === 0, p = isBar ? bars : beats;
        p.rect(x, top + 1, isBar ? 1.5 : 1, isBar ? 6 : 4); p.rect(x, top + lane - (isBar ? 7 : 5), isBar ? 1.5 : 1, isBar ? 6 : 4);
      }
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.fill(bars);
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fill(beats);
      if (L.loopIn != null && L.loopOut != null) { g.fillStyle = L.loop ? 'rgba(74,222,128,0.22)' : 'rgba(255,255,255,0.08)'; g.fillRect(xOf(L.loopIn), top, xOf(L.loopOut) - xOf(L.loopIn), lane); }
      g.fillStyle = '#ffd60a'; g.fillRect(xOf(jam().decks[d].cues[0] ?? 0), top, 1.5, lane);
    }
    if (i > 0) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, top, w, 1); }
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.font = 'bold 11px Inter, Arial';
    if (!compact) g.fillText(d, 4, top + 11);
    else if (t?.kind === 'yt' && !L.duration) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillText('Loading from YouTube…', 6, mid + 4); }
  });
  g.fillStyle = '#ffffff'; g.fillRect(center - 1, 0, 2, h);
  g.beginPath(); g.moveTo(center - 5, 0); g.lineTo(center + 5, 0); g.lineTo(center, 6); g.moveTo(center - 5, h); g.lineTo(center + 5, h); g.lineTo(center, h - 6); g.fill();
}
/** The whole song, for seeking (AIHub's OverviewWave): played part bright, the rest dim. */
function paintOverview(cv: HTMLCanvasElement | null, d: D): void {
  if (!cv) return;
  const f = sizeCanvas(cv); if (!f) return;
  const { g, w, h } = f, t = deckTrack(d), L = live[d];
  g.clearRect(0, 0, w, h);
  if (!t) return;
  const dur = L.duration || t.duration, env = envFor(t, dur);
  if (!env || !dur) return;
  const head = Math.min(1, L.time / dur) * w, col = DECK_COLORS[d];
  for (let x = 0; x < w; x++) {
    const f0 = Math.floor((x / w) * env.amp.length), f1 = Math.max(f0 + 1, Math.floor(((x + 1) / w) * env.amp.length));
    let a = 0, l = 0;
    for (let q = f0; q < f1 && q < env.amp.length; q++) { if (env.amp[q]! > a) a = env.amp[q]!; if (env.low[q]! > l) l = env.low[q]!; }
    const ah = Math.max(0.5, (a * h) / 2);
    g.globalAlpha = x < head ? 1 : 0.45;
    g.fillStyle = col.hi; g.fillRect(x, h / 2 - ah, 1, ah * 2);
    if (l * a > 0.05) { g.fillStyle = col.lo; g.fillRect(x, h / 2 - (l * a * h) / 2, 1, l * a * h); }
  }
  g.globalAlpha = 1;
  for (const c of jam().decks[d].cues) if (c != null) { g.fillStyle = '#ffd60a'; g.fillRect((c / dur) * w, 0, 1.5, h); }
  if (L.loopIn != null && L.loopOut != null) { g.fillStyle = 'rgba(74,222,128,0.35)'; g.fillRect((L.loopIn / dur) * w, 0, ((L.loopOut - L.loopIn) / dur) * w, h); }
  g.fillStyle = '#fff'; g.fillRect(head - 1, 0, 2, h);
}

// ---------------------------------------------------------------- top bar (TopBar, CpuMeter, SandboxBar, SamplerBank, NowPlaying)
let scopeOpen = false;
let uiZoom = (() => { try { const v = parseFloat(localStorage.getItem('jam-zoom') ?? ''); return v >= 0.55 && v <= 1 ? v : 1; } catch { return 1; } })();
function topBar(): HTMLElement {
  const j = jam();
  return h('div', { class: 'dj-top' },
    h('div', { class: 'dj-brand' }, h('span', null, 'Jam'), h('b', null, 'DJ')),
    h('div', { class: 'dj-lcd dj-top-clock' }, h('span', { 'data-jam-clock': '' })),
    h('div', { class: 'dj-cpu', title: 'Load' }, h('span', null, 'CPU'), h('div', { class: 'dj-cpu-bar' }, Array.from({ length: 8 }, () => h('i')))),
    h('div', { class: 'dj-top-meter', title: 'Master level' }, h('span', null, 'MASTER'), h('div', { class: 'dj-hmeter' }, vu('ML', 24, true), vu('MR', 24, true))),
    h('button', { type: 'button', class: `dj-top-automix ${j.automix ? 'dj-on dj-on-green' : ''}`, title: 'Automix — mix through the set list (A)', onClick: () => { j.automix = !j.automix; save(); } }, `AUTOMIX ${j.automix ? 'ON' : 'OFF'}`),
    h('div', { class: 'dj-sandbox' },
      h('button', { type: 'button', class: `dj-top-btn dj-icon-btn ${j.sandbox ? 'dj-on dj-on-orange' : ''}`, title: 'Sandbox — silence the speakers while you set up the next song', onClick: () => { j.sandbox = !j.sandbox; applyMix(); save(); } }, ic('box', 14)),
      h('div', { class: `dj-lcd dj-sandbox-bar ${j.sandbox ? 'dj-sandbox-on' : ''}` }, j.sandbox ? 'SANDBOX · speakers muted' : 'SANDBOX')),
    h('div', { class: 'dj-bank', role: 'group', 'aria-label': 'Sampler' },
      knob({ value: j.samplerLevel, onChange: (v) => { j.samplerLevel = v; }, size: 22, center: 0, def: 0.8, color: '#22c55e', title: 'Sampler volume' }),
      h('div', { class: 'dj-bank-pads' }, HITS.map((x, i) => { const b = h('button', { type: 'button', class: `dj-hit ${i < 4 ? 'dj-hit-a' : 'dj-hit-b'}`, title: x.title, 'data-hit': x.id }, x.label); b.addEventListener('pointerdown', () => fire(x.id)); return b; })),
      knob({ value: j.samplerPitch, onChange: (v) => { j.samplerPitch = v; }, size: 22, center: 0.5, def: 0.5, color: '#38bdf8', title: 'Sampler pitch (±1 octave, double-click to reset)' })),
    h('div', { class: 'dj-lcd dj-nowplaying', title: 'Now playing' },
      h('span', { class: 'dj-np-lamp' }, 'IDLE', h('i')),
      h('div', { class: 'dj-np-cover' }),
      h('div', { class: 'dj-np-text' }, h('b', null, 'Load a song to begin'), h('small', null, '')),
      h('div', { class: 'dj-np-stat' }, h('small', null, 'BPM'), h('b', null, '--')),
      h('div', { class: 'dj-np-time' }, h('span', null, '--:--'), h('div', { class: 'dj-np-bar' }, h('div'))),
      h('div', { class: 'dj-np-next' }, h('small', null, 'NEXT'), h('b', null, '—'))),
    h('div', { class: 'dj-zoomctl', title: 'Console size' },
      h('button', { type: 'button', 'aria-label': 'Smaller', disabled: uiZoom <= 0.55, onClick: () => setZoom(uiZoom - 0.05) }, ic('minus', 11)),
      h('span', null, `${Math.round(uiZoom * 100)}%`),
      h('button', { type: 'button', 'aria-label': 'Bigger', disabled: uiZoom >= 1, onClick: () => setZoom(uiZoom + 0.05) }, ic('plus', 11))),
    h('div', { class: 'dj-rec' },
      h('button', { type: 'button', class: `dj-rec-btn ${recorder ? 'dj-recording' : ''}`, title: recorder ? 'Stop and save the recording' : 'Record your mix', onClick: toggleRec }, ic(recorder ? 'square' : 'circle', 9), ' REC'),
      h('span', { class: 'dj-lcd dj-rec-info', 'data-jam-rec': '' }, '00:00 / 0 KB')),
    h('div', { class: 'dj-out' },
      h('button', { type: 'button', class: `dj-top-btn dj-icon-btn ${scopeOpen ? 'dj-on dj-on-blue' : ''}`, title: 'Master spectrum', onClick: () => { scopeOpen = !scopeOpen; G.save(); } }, ic('wave', 14)),
      scopeOpen ? h('div', { class: 'dj-out-menu dj-scope-menu' }, h('div', { class: 'dj-out-title' }, 'Master spectrum'), h('canvas', { width: '300', height: '110' }), h('p', null, 'Songs from your computer and the sampler. YouTube audio stays inside its player.')) : null),
    h('div', { class: 'dj-out' },
      h('button', { type: 'button', class: 'dj-top-btn dj-icon-btn', title: 'Find songs on YouTube in the lab\'s Chrome', onClick: () => G.CorpDesk?.newBrowserTab?.('https://www.youtube.com') }, ic('youtube', 14))));
}
function setZoom(z: number): void { uiZoom = clamp(Math.round(z * 100) / 100, 0.55, 1); try { localStorage.setItem('jam-zoom', String(uiZoom)); } catch { /* per session */ } G.save(); }

// ---------------------------------------------------------------- deck rows (DeckClock, DeckInfo, DeckPads, Turntable)
function deckClock(d: D): HTMLElement {
  const j = jam();
  const letter = h('div', { class: `dj-deck-letter ${live[d].playing ? 'dj-live' : ''}`, 'data-deck': d }, d);
  return dropTarget(h('div', { class: `dj-clock dj-panel ${d === 'B' ? 'dj-mirror' : ''}` },
    d === 'A' ? letter : null,
    h('button', { type: 'button', class: 'dj-lcd dj-time', 'data-deck': d, title: 'Toggle elapsed / remaining', onClick: () => { j.remain[d] = !j.remain[d]; save(); } },
      h('span', { class: 'dj-lcd-labels' }, h('b', { class: j.remain[d] ? '' : 'on' }, 'ELAPSED'), ' ', h('b', { class: j.remain[d] ? 'on' : '' }, 'REMAIN')),
      h('span', { class: 'dj-lcd-big', 'data-jam-time': d }, '0:00.0')),
    d === 'B' ? letter : null), d);
}
function deckInfo(d: D): HTMLElement {
  const t = deckTrack(d), ds = jam().decks[d], L = live[d];
  const cover = h('div', { class: 'dj-cover' }, t?.kind === 'yt' ? h('img', { src: thumb(t.id), alt: '' }) : h('div', { class: 'dj-cover-empty' }));
  const pct = ds.pitch * 100;
  const readout = h('div', { class: 'dj-lcd dj-readout' },
    h('div', { class: 'dj-ro-row' }, h('span', null, 'BPM'), h('b', { class: 'dj-lcd-mid', 'data-jam-bpm': d }, '00.00')),
    h('div', { class: 'dj-ro-row' }, h('span', null, 'PITCH'), h('b', null, `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}`)),
    h('div', { class: 'dj-ro-row' }, h('span', null, 'KEY'), h('b', { class: 'dj-key' }, ''), ds.keylock && t ? ic('lock', 9) : null));
  const overview = h('canvas', { class: 'dj-overview', 'data-jam-overview': d }) as HTMLCanvasElement;
  overview.addEventListener('click', (e) => { const r = overview.getBoundingClientRect(); if (L.duration) seek(d, ((e.clientX - r.left) / r.width) * L.duration); });
  const title = h('div', { class: 'dj-lcd dj-title-box' },
    h('div', { class: 'dj-title-line' },
      t?.kind === 'yt' ? h('span', { class: 'dj-src-badge dj-src-direct', title: 'YouTube — direct playback: volume, crossfader, pitch, loops and cues' }, ic('youtube', 9)) : null,
      h('span', { class: 'dj-title-text' }, t ? [h('b', null, t.artist ? `${t.artist} - ` : ''), t.title] : h('span', { class: 'dj-dim' }, '- Drag a song on this deck to load it'))),
    L.error ? h('div', { class: 'dj-err' }, L.error) : null,
    h('div', { class: 'dj-stripwave-wrap' }, h('canvas', { class: 'dj-stripwave', 'data-jam-strip': d })),
    h('div', { class: 'dj-overview-wrap', style: 'height:10px' }, overview));
  return dropTarget(h('div', { class: `dj-info dj-panel ${d === 'B' ? 'dj-mirror' : ''}` }, ...(d === 'A' ? [cover, title, readout] : [readout, title, cover])), d);
}
const STEMS: { k: Stem; label: string; color: string }[] = [
  { k: 'vocal', label: 'Vocal', color: '#22c55e' }, { k: 'instru', label: 'Instru', color: '#f97316' }, { k: 'bass', label: 'Bass', color: '#ef4444' },
  { k: 'kick', label: 'Kick', color: '#3b82f6' }, { k: 'hihat', label: 'HiHat', color: '#38bdf8' },
];
function deckPads(d: D): HTMLElement {
  const ds = jam().decks[d], t = deckTrack(d), L = live[d];
  const full = !t || t.kind === 'file';
  const s = ds.stems;
  const fx = (): void => { applyFx(d); save(); };
  const stemBtn = (x: typeof STEMS[number]): HTMLElement => h('button', { type: 'button', class: `dj-stem ${s[x.k] ? 'dj-stem-on' : ''}`, style: `--stem:${x.color}`, title: s[x.k] ? `Mute ${x.label}` : `Bring back ${x.label}`, onClick: () => { s[x.k] = !s[x.k]; fx(); } }, x.label, h('i'));
  const acapella = s.vocal && !s.instru, instrumental = !s.vocal && s.instru;
  const loopLabel = ds.loopBeats >= 1 ? String(ds.loopBeats) : `1/${Math.round(1 / ds.loopBeats)}`;
  const relen = (): void => { if (L.loop && L.loopIn != null) L.loopOut = L.loopIn + ds.loopBeats * beatLen(d); };
  const select = h('select', { class: 'dj-lcd dj-fx-select', 'aria-label': 'Effect' }, (Object.keys(FX_LABELS) as Fx[]).map((k) => h('option', { value: k, selected: ds.fxType === k }, FX_LABELS[k]))) as HTMLSelectElement;
  select.addEventListener('change', () => { ds.fxType = select.value as Fx; fx(); });
  return dropTarget(h('div', { class: `dj-pads dj-panel ${d === 'B' ? 'dj-mirror' : ''} ${full ? '' : 'dj-limited'}`, title: full ? null : 'This YouTube video plays directly from YouTube, so stems and effects cannot reach it' },
    h('div', { class: 'dj-section dj-stems' },
      h('div', { class: 'dj-section-title' }, 'STEMS'),
      h('div', { class: 'dj-stem-grid' },
        STEMS.slice(0, 3).map(stemBtn),
        led('Acapella', acapella, 'green', () => { for (const x of STEMS) s[x.k] = false; s.vocal = true; fx(); }, 'dj-small', 'Acapella — vocals only'),
        STEMS.slice(3).map(stemBtn),
        led('Reset', false, 'green', () => { for (const x of STEMS) s[x.k] = true; fx(); }, 'dj-small', 'Bring every stem back'),
        led('Instrum.', instrumental, 'orange', () => { for (const x of STEMS) s[x.k] = true; s.vocal = false; fx(); }, 'dj-small', 'Instrumental — remove vocals'))),
    h('div', { class: 'dj-pads-body' },
      h('div', { class: 'dj-col dj-hotcues' },
        ds.cues.map((c, i) => { const b = h('button', { type: 'button', class: `dj-pad ${c != null ? `dj-pad-set dj-pad-${i}` : ''}`, title: c != null ? `Hot cue ${i + 1} at ${fmtTime(c)} — right-click to clear` : `Set hot cue ${i + 1}`, onClick: () => hotCue(d, i) }, c != null ? String(i + 1) : ''); b.addEventListener('contextmenu', (e) => { e.preventDefault(); ds.cues[i] = null; save(); }); return b; }),
        knob({ value: ds.filter, onChange: (v) => { ds.filter = v; applyFx(d); }, label: 'FILTER', size: 36, color: '#a855f7', title: 'Filter — left low-pass, right high-pass' })),
      h('div', { class: 'dj-col dj-grow' },
        h('div', { class: 'dj-section' },
          h('div', { class: 'dj-fx-row' }, select),
          h('div', { class: 'dj-fx-row' },
            led('ON', ds.fx.on, 'orange', () => { ds.fx.on = !ds.fx.on; fx(); }, 'dj-big'),
            knob({ value: ds.fx.str, onChange: (v) => { ds.fx.str = v; applyFx(d); }, label: 'STR', center: 0, def: 0.6, color: '#f97316', title: 'Effect strength' }),
            knob({ value: ds.fx.spd, onChange: (v) => { ds.fx.spd = v; applyFx(d); }, label: 'SPD', center: 0, def: 0.4, color: '#f97316', title: ds.fxType === 'echo' ? 'Echo length (beats)' : 'Speed' }))),
        h('div', { class: 'dj-section dj-loop' },
          h('div', { class: 'dj-section-title' }, 'LOOP'),
          h('div', { class: 'dj-loop-grid' },
            led('/2', false, 'green', () => { ds.loopBeats = Math.max(0.25, ds.loopBeats / 2); relen(); save(); }, '', 'Halve loop'),
            led('X2', false, 'green', () => { ds.loopBeats = Math.min(32, ds.loopBeats * 2); relen(); save(); }, '', 'Double loop'),
            h('button', { type: 'button', class: `dj-lcd dj-loop-len ${L.loop ? 'dj-loop-on' : ''}`, title: 'Loop on / off', onClick: () => { if (L.loopIn != null && L.loopOut != null) { L.loop = !L.loop; G.save(); } } }, loopLabel),
            led('IN', L.loopIn != null && !L.loop, 'green', () => { if (!deckTrack(d)) return; L.loopIn = now(d); L.loopOut = null; L.loop = false; G.save(); }, '', 'Loop in'),
            led('OUT', L.loop, 'green', () => { if (L.loop) L.loop = false; else if (L.loopIn != null && now(d) > L.loopIn) { L.loopOut = now(d); L.loop = true; seek(d, L.loopIn); } else toast('Press IN first, then OUT later in the song.'); G.save(); }, '', 'Loop out'),
            led('AUTO', L.loop, 'green', () => { if (!deckTrack(d)) return; if (L.loop) L.loop = false; else { L.loopIn = now(d); L.loopOut = L.loopIn + ds.loopBeats * beatLen(d); L.loop = true; } G.save(); }, 'dj-small', 'Beat-sized loop from here')))))), d);
}

// The record artwork is drawn in a 300-unit box and scaled to the platter, as AIHub sizes it to the column.
const P = 300;
let glossUrl = '';
function glossImage(): string {
  if (glossUrl) return glossUrl;
  const d = Math.round(P * 0.92), cv = document.createElement('canvas');
  cv.width = cv.height = d * 2;
  const g = cv.getContext('2d');
  if (!g || typeof (g as any).createConicGradient !== 'function') return '';
  g.scale(2, 2);
  const c = d / 2, conic = (g as any).createConicGradient(-Math.PI / 2, c, c) as CanvasGradient;
  for (const [a, o] of [[0, 0], [16, 0.08], [34, 0.42], [40, 0.62], [46, 0.40], [64, 0.08], [84, 0], [180, 0], [196, 0.06], [214, 0.34], [220, 0.48], [226, 0.30], [244, 0.06], [262, 0], [360, 0]] as const) conic.addColorStop(a / 360, `rgba(255,255,255,${o})`);
  g.fillStyle = conic; g.fillRect(0, 0, d, d);
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
  for (let r = 1.5; r < c; r += 3) { g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); }
  const glare = g.createRadialGradient(d * 0.3, d * 0.24, 0, d * 0.3, d * 0.24, d * 0.41);
  glare.addColorStop(0, 'rgba(255,255,255,0.28)'); glare.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glare; g.fillRect(0, 0, d, d);
  const ring = g.createRadialGradient(c, c, 0, c, c, c * Math.SQRT2);
  ring.addColorStop(0, 'rgba(0,0,0,0)'); ring.addColorStop(0.385, 'rgba(0,0,0,0)'); ring.addColorStop(0.4, 'rgba(0,0,0,1)'); ring.addColorStop(0.99, 'rgba(0,0,0,1)'); ring.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = ring; g.fillRect(0, 0, d, d);
  g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
  glossUrl = cv.toDataURL('image/png');
  return glossUrl;
}
/** AIHub's Platter: rim, spinning record (strobe dots, vinyl, grooves, label or artwork), sheen, arm rest, Technics tonearm, 45 adapter and target light. */
function platter(d: D): HTMLElement {
  const t = deckTrack(d), cover = t?.kind === 'yt' ? thumb(t.id) : '';
  const s = P, c = s / 2;
  const dots = Array.from({ length: 72 }, (_, i) => { const a = (i / 72) * Math.PI * 2; return `<circle cx="${(c + Math.cos(a) * c * 0.955).toFixed(2)}" cy="${(c + Math.sin(a) * c * 0.955).toFixed(2)}" r="1.3" fill="#9aa0a8"/>`; }).join('');
  let grooves = '';
  for (let r = c * 0.42; r < c * 0.9; r += 2.2) grooves += `<circle cx="${c}" cy="${c}" r="${r.toFixed(1)}" fill="none" stroke="rgba(255,255,255,0.045)" stroke-width="0.6"/>`;
  const label = cover
    ? `<image class="dj-record-artwork" href="${cover}" x="${c - c * 0.9}" y="${c - c * 0.9}" width="${c * 1.8}" height="${c * 1.8}" preserveAspectRatio="xMidYMid slice" clip-path="url(#jdc${d})"/><circle cx="${c}" cy="${c}" r="${c * 0.9}" fill="none" stroke="rgba(0,0,0,0.55)" stroke-width="2"/><circle cx="${c}" cy="${c}" r="${c * 0.12}" fill="rgba(0,0,0,0.25)"/><rect x="${c - 2.5}" y="${c - c * 0.42}" width="5" height="${c * 0.24}" rx="2" fill="#fff" stroke="rgba(0,0,0,0.4)" stroke-width="0.6"/>`
    : `<circle class="dj-record-label" cx="${c}" cy="${c}" r="${c * 0.36}" fill="var(--dj-record-label, #d71920)"/><circle cx="${c}" cy="${c}" r="${c * 0.36}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/><rect x="${c - 2.5}" y="${c - c * 0.35}" width="5" height="${c * 0.27}" rx="2" fill="#fff"/><text class="dj-label-text" x="${c}" y="${c + c * 0.1}" text-anchor="middle" font-size="${c * 0.12}" font-weight="800" fill="#fff" font-family="Inter, Arial, sans-serif" letter-spacing="0.5">Jam</text><text class="dj-label-text dj-label-sub" x="${c}" y="${c + c * 0.24}" text-anchor="middle" font-size="${c * 0.1}" font-weight="800" fill="#ffd2d2" font-family="Inter, Arial, sans-serif" letter-spacing="2">DJ</text>`;
  const px = s * 0.98, py = s * 0.12, tube = `M${px} ${py} L${s * 1.03} ${s * 0.7} Q${s * 1.035} ${s * 0.76}, ${s * 1.005} ${s * 0.8}`;
  const el = h('div', { class: 'dj-platter', 'data-deck': d });
  // Constant artwork; the only data in it is YouTube's thumbnail URL for a validated 11-character id.
  el.innerHTML = `<svg viewBox="0 0 ${s} ${s}" class="jam-layer"><defs><radialGradient id="jpl${d}" cx="45%" cy="40%" r="65%"><stop offset="0%" stop-color="#e8eaed"/><stop offset="100%" stop-color="#8d939b"/></radialGradient></defs><circle cx="${c}" cy="${c}" r="${c - 1}" fill="url(#jpl${d})" stroke="#6b7078"/></svg>`
    + `<div class="dj-disc jam-layer"><svg viewBox="0 0 ${s} ${s}" style="display:block;width:100%;height:100%"><defs><radialGradient id="jvy${d}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#2a2a2e"/><stop offset="60%" stop-color="#111114"/><stop offset="100%" stop-color="#050506"/></radialGradient><clipPath id="jdc${d}"><circle cx="${c}" cy="${c}" r="${c * 0.9}"/></clipPath></defs>${dots}<circle cx="${c}" cy="${c}" r="${c * 0.92}" fill="var(--dj-record-fill, url(#jvy${d}))"/>${grooves}${label}</svg></div>`
    + `<svg viewBox="0 0 ${s} ${s}" class="jam-layer"><defs><linearGradient id="jsh${d}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,0.18)"/><stop offset="45%" stop-color="rgba(255,255,255,0)"/><stop offset="55%" stop-color="rgba(255,255,255,0)"/><stop offset="100%" stop-color="rgba(255,255,255,0.10)"/></linearGradient><radialGradient id="jlg${d}" cx="35%" cy="25%" r="75%"><stop offset="0%" stop-color="rgba(255,255,255,0.55)"/><stop offset="35%" stop-color="rgba(255,255,255,0.12)"/><stop offset="60%" stop-color="rgba(255,255,255,0)"/></radialGradient></defs><circle cx="${c}" cy="${c}" r="${c * 0.92}" fill="url(#jsh${d})"/>${cover ? '' : `<circle cx="${c}" cy="${c}" r="${c * 0.36}" fill="url(#jlg${d})"/>`}<circle cx="${c}" cy="${c}" r="${c * 0.035}" fill="#d9dce0" stroke="#555" stroke-width="0.5"/></svg>`
    + `<svg viewBox="0 0 ${s} ${s}" class="dj-arm-rest jam-layer" style="overflow:visible" aria-hidden="true"><rect x="${s * 1.012}" y="${s * 0.6}" width="${s * 0.036}" height="${s * 0.05}" rx="${s * 0.006}" fill="#1c1d20" stroke="#7a8087" stroke-width="0.8"/><path d="M${s * 1.014} ${s * 0.6} Q${s * 1.03} ${s * 0.585}, ${s * 1.046} ${s * 0.6}" stroke="#b8bdc3" stroke-width="1.2" fill="none"/></svg>`
    + `<div class="dj-tonearm jam-layer" style="transform-origin:98% 12%;transform:rotate(0deg);will-change:transform;transition:transform 0.7s cubic-bezier(.2,.7,.2,1)"><svg viewBox="0 0 ${s} ${s}" class="dj-arm" style="display:block;overflow:visible;width:100%;height:100%"><defs><linearGradient id="jac${d}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#8e949b"/><stop offset="45%" stop-color="#ffffff"/><stop offset="100%" stop-color="#7c828a"/></linearGradient><linearGradient id="jaw${d}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#1b1c1f"/><stop offset="50%" stop-color="#4a4d53"/><stop offset="100%" stop-color="#151618"/></linearGradient></defs><circle class="dj-arm-board" cx="${px}" cy="${py}" r="${s * 0.085}" fill="#141517" stroke="#5a5f66" stroke-width="1.5"/><circle cx="${px}" cy="${py}" r="${s * 0.065}" fill="#202225" stroke="rgba(255,255,255,0.14)" stroke-width="1"/><line x1="${px}" y1="${py}" x2="${px - s * 0.004}" y2="${py - s * 0.085}" stroke="url(#jac${d})" stroke-width="${s * 0.016}"/><rect class="dj-arm-weight" x="${px - s * 0.032}" y="${py - s * 0.12}" width="${s * 0.06}" height="${s * 0.06}" rx="${s * 0.008}" fill="url(#jaw${d})" stroke="#6f747b" stroke-width="0.8"/><line x1="${px - s * 0.03}" y1="${py - s * 0.075}" x2="${px + s * 0.026}" y2="${py - s * 0.075}" stroke="#9aa0a8" stroke-width="0.8"/><circle cx="${px}" cy="${py}" r="${s * 0.03}" fill="#c9cdd2" stroke="#4d5157" stroke-width="1"/><path d="${tube}" stroke="#3a3d42" stroke-width="${s * 0.022}" fill="none" stroke-linecap="round"/><path class="dj-arm-tube" d="${tube}" stroke="url(#jac${d})" stroke-width="${s * 0.015}" fill="none" stroke-linecap="round"/><g transform="rotate(-14 ${s * 1.005} ${s * 0.8})"><rect class="dj-arm-head" x="${s * 0.983}" y="${s * 0.79}" width="${s * 0.044}" height="${s * 0.085}" rx="${s * 0.006}" fill="#2a2c30" stroke="#8a9097" stroke-width="0.8"/><line x1="${s * 1.027}" y1="${s * 0.805}" x2="${s * 1.06}" y2="${s * 0.795}" stroke="#d4d8dd" stroke-width="${s * 0.007}" stroke-linecap="round"/></g></svg></div>`
    + `<svg class="dj-hw-adapter" viewBox="0 0 40 40" aria-hidden="true" style="position:absolute;left:-2%;top:-2%;width:15%;height:15%;pointer-events:none"><defs><radialGradient id="jad${d}" cx="35%" cy="30%" r="80%"><stop offset="0%" stop-color="#ffffff"/><stop offset="60%" stop-color="#c9cdd2"/><stop offset="100%" stop-color="#8d939b"/></radialGradient></defs><circle cx="20" cy="20" r="19" fill="#2a2c30"/><circle cx="20" cy="20" r="17" fill="url(#jad${d})" stroke="#7d838b" stroke-width="0.8"/><circle cx="20" cy="20" r="11" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="0.6"/><circle cx="20" cy="20" r="3.4" fill="#1b1c1f" stroke="#9aa0a8" stroke-width="0.8"/></svg>`
    + `<span class="dj-hw-target ${t ? 'dj-on' : ''}" aria-hidden="true" style="left:0.5%;bottom:0.5%;width:8.5%;height:8.5%"></span>`
    + (glossImage() ? `<img class="dj-vinyl-gloss-img" src="${glossImage()}" alt="" draggable="false" style="position:absolute;left:4%;top:4%;width:92%;height:92%;pointer-events:none">` : '');
  // Touch the record and move it to scrub, as AIHub's platter does.
  let scrub: { a: number; t: number } | null = null;
  const angle = (e: PointerEvent): number => { const r = el.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2); };
  el.addEventListener('pointerdown', (e) => { if (!deckTrack(d) || e.button !== 0) return; el.setPointerCapture(e.pointerId); scrub = { a: angle(e), t: now(d) }; el.style.cursor = 'grabbing'; });
  el.addEventListener('pointermove', (e) => { if (!scrub) return; let da = angle(e) - scrub.a; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; if (Math.abs(da) > 0.03) { scrub.a = angle(e); scrub.t += (da / (2 * Math.PI)) * 1.8; seek(d, scrub.t); } });
  const end = (): void => { scrub = null; el.style.cursor = deckTrack(d) ? 'grab' : 'default'; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.style.cursor = t ? 'grab' : 'default';
  return el;
}
function pitchText(p: number): string { const pct = Math.round(p * 1000) / 10; return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`; }
function turntable(d: D): HTMLElement {
  const ds = jam().decks[d], t = deckTrack(d), L = live[d];
  const rangeBtn = h('button', { type: 'button', class: `dj-lcd dj-range ${Math.abs(ds.pitch) > 0.0005 ? 'dj-range-moved' : ''}`, title: `Pitch ${pitchText(ds.pitch)} (±8%)` }, h('b', null, pitchText(ds.pitch)), h('small', null, '±8'));
  const main = h('div', { class: 'dj-tt-main' },
    platter(d),
    h('div', { class: 'dj-tt-side' },
      h('span', { class: `dj-hw-lamp ${L.playing ? 'dj-on' : ''}`, 'data-deck': d, title: L.playing ? 'Playing' : 'Stopped' }),
      h('button', { type: 'button', class: 'dj-mini', title: 'Eject', disabled: !t || L.playing, onClick: () => eject(d) }, ic('eject', 11)),
      rangeBtn,
      vfader({ value: 0.5 + ds.pitch / PITCH_RANGE / 2, onChange: (v) => { ds.pitch = (v - 0.5) * 2 * PITCH_RANGE; applyRate(d); rangeBtn.querySelector('b')!.textContent = pitchText(ds.pitch); }, height: 150, def: 0.5, invert: true, cls: 'dj-pitch', title: 'Pitch ±8% (double-click to reset)', ticks: 9 })));
  // Size the record to the space next to the pitch fader, as AIHub's Turntable does.
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(([e]) => {
    const { width, height } = e.contentRect;
    const size = Math.round(Math.max(130, Math.min(320, height - 4, (width - 52) / 1.09)));
    const p = main.querySelector<HTMLElement>('.dj-platter');
    if (p) { p.style.width = p.style.height = `${size}px`; p.style.marginRight = `${size * 0.09}px`; }
  }).observe(main);
  return dropTarget(h('div', { class: `dj-tt dj-panel dj-deck-turntable dj-tt-furnished ${d === 'B' ? 'dj-mirror' : ''}`, title: t ? null : 'Drop a song here, then press play' },
    h('div', { class: 'dj-reference-deck-header', 'aria-hidden': 'true' }, h('span', null, 'Jam ', h('b', null, 'DIRECT DRIVE')), h('span', { class: 'dj-reference-speed' }, '33 ', h('i'), ' 45 ', h('i'))),
    main,
    h('div', { class: 'dj-transport' },
      h('button', { type: 'button', class: 'dj-tbtn dj-cue', disabled: !t, title: 'CUE', onClick: () => cue(d) }, 'CUE'),
      h('button', { type: 'button', class: 'dj-tbtn', disabled: !t, title: 'Stop', onClick: () => stop(d) }, ic('square', 16)),
      h('button', { type: 'button', class: `dj-tbtn dj-play ${L.playing ? 'dj-playing' : ''}`, 'data-deck': d, disabled: !t, title: L.playing ? 'Pause' : 'Play', 'aria-label': 'Play / pause', onClick: () => toggle(d) }, ic(L.playing ? 'pause' : 'play', 22)),
      h('button', { type: 'button', class: `dj-mini dj-keylock ${ds.keylock ? 'dj-on dj-on-blue' : ''}`, title: 'Key lock — keep pitch when changing tempo', onClick: () => { ds.keylock = !ds.keylock; applyRate(d); save(); } }, ic('lock', 10)),
      h('button', { type: 'button', class: 'dj-tbtn dj-sync', disabled: !t, title: `Match tempo to deck ${other(d)}`, onClick: (e: MouseEvent) => { const ok = sync(d); (e.currentTarget as HTMLElement).classList.toggle('dj-on', ok); (e.currentTarget as HTMLElement).classList.toggle('dj-on-blue', ok); } }, 'SYNC'))), d);
}

// ---------------------------------------------------------------- mixer
function channel(d: D): HTMLElement {
  const ds = jam().decks[d], full = deckTrack(d)?.kind !== 'yt';
  const set = (): void => applyFx(d);
  return h('div', { class: `dj-ch ${full ? '' : 'dj-limited'}`, title: full ? null : 'This YouTube video plays directly — only volume and the crossfader reach it' },
    knob({ value: ds.gain, onChange: (v) => { ds.gain = v; set(); }, label: 'GAIN', size: 24, color: '#e5e7eb', title: 'Trim ±12 dB' }),
    (['high', 'mid', 'low'] as Band[]).map((b) => knob({ value: ds.eq[b], onChange: (v) => { ds.eq[b] = v; set(); }, label: b.toUpperCase(), size: 26, color: ds.eq[b] < 0.5 ? '#ef4444' : '#22c55e', title: `${b.toUpperCase()} EQ — full left kills the band` })));
}
function strip(d: D): HTMLElement {
  const j = jam();
  return h('div', { class: 'dj-strip' },
    h('button', { type: 'button', class: 'dj-mini dj-pfl', title: 'Pre-listen needs a second audio output (headphones) — in AIHub DJ desktop', disabled: true }, ic('headphones', 10)),
    vfader({ value: j.decks[d].vol, onChange: (v) => { j.decks[d].vol = v; applyMix(); }, height: 84, def: 0.8, title: `Deck ${d} volume` }));
}
function mixer(): HTMLElement {
  const j = jam(), video = j.view === 'video';
  const monitor = h('div', { class: 'dj-video', 'data-jam-video': 'main' },
    DECKS.some((d) => deckTrack(d)?.kind === 'yt') ? null : h('span', { class: 'jam-video-idle' }, 'Load a song — YouTube videos and music videos play here'),
    h('button', { type: 'button', class: 'dj-video-size', title: 'Big screen', onClick: () => { const d = DECKS.filter(ytOn).sort((a, b) => outputVolume(b) - outputVolume(a))[0]; if (d) void slots[d].requestFullscreen?.(); else toast('Load a YouTube video first.'); } }, ic('maximize', 12)));
  return h('div', { class: `dj-mixer dj-panel ${video ? 'dj-video-up' : ''}` },
    h('div', { class: 'dj-mixer-tabs' },
      h('span', null, 'CH A'),
      h('div', { class: 'dj-mixer-switch', role: 'tablist' },
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(!video), class: video ? '' : 'on', onClick: () => { j.view = 'mixer'; save(); } }, 'MIXER'),
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(video), class: video ? 'on' : '', onClick: () => { j.view = 'video'; save(); } }, 'VIDEO')),
      h('span', null, 'CH B')),
    video ? h('div', { class: 'dj-mixer-video' }, monitor) : h('div', { class: 'dj-mixer-body' },
      channel('A'),
      h('div', { class: 'dj-mixer-center' },
        h('div', { class: 'dj-meters' }, vu('A', 16, false, 96), h('div', { class: 'dj-master-meters' }, vu('L', 16, false, 96), vu('R', 16, false, 96)), vu('B', 16, false, 96)),
        knob({ value: j.master, onChange: (v) => { j.master = v; applyMix(); }, label: 'MASTER', size: 30, center: 0, def: 0.85, color: '#22c55e' }),
        h('div', { class: 'dj-section-title dj-tight' }, 'HEADPHONES'),
        h('div', { class: 'dj-row dj-limited', title: 'Headphone cueing needs a second audio output — in AIHub DJ desktop' },
          knob({ value: 0.8, onChange: () => undefined, label: 'VOL', size: 26, center: 0, def: 0.8, disabled: true }),
          knob({ value: 0, onChange: () => undefined, label: 'CUE MIX', size: 26, center: 0, def: 0, disabled: true }))),
      channel('B')),
    h('div', { class: 'dj-mixer-faders' },
      strip('A'),
      h('div', { class: 'dj-mixer-logo' }, h('span', { class: 'dj-logo-ai' }, 'Jam'), h('span', { class: 'dj-logo-dj' }, 'DJ'), h('small', null, '2-DECK MIX ENGINE')),
      strip('B')),
    h('div', { class: 'dj-xfader' },
      h('span', null, '◂ A'),
      hfader({ value: j.xfade, onChange: (v) => { j.xfade = v; applyMix(); }, width: 130, title: 'Crossfader (double-click to centre)' }),
      h('span', null, 'B ▸'),
      h('button', { type: 'button', class: `dj-mini dj-fade-btn ${fading ? 'dj-on dj-on-blue' : ''}`, title: fading ? 'Stop the fade here' : 'Fade across to the other deck over 8 s', onClick: () => fadeTo(j.xfade < 0.5 ? 'B' : 'A') }, ic('swap', 10))));
}

// ---------------------------------------------------------------- library (Library, CoverFlow, set list)
function rowsNow(): Track[] {
  const j = jam();
  const all = j.source === 'music' ? [...files.values()].map((f) => f.track) : j.source === 'youtube' ? (searchResults ?? j.library) : j.library;
  const q = filterText.toLowerCase();
  return q && !(j.source === 'youtube') ? all.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(q)) : all;
}
function coverflow(rows: Track[]): HTMLElement {
  const size = 96, k = size / 96, span = 4;
  const index = Math.max(0, rows.findIndex((t) => t.id === selected));
  const box = h('div', { class: 'dj-coverflow', style: `--cf:${size}px`, title: 'Scroll to flip through songs' });
  for (let o = -span; o <= span; o++) {
    const t = rows[index + o];
    if (!t) continue;
    const abs = Math.abs(o), x = o === 0 ? 0 : Math.sign(o) * (0.82 + 0.6 * (abs - 1)) * size;
    const tile = (mirror: boolean): HTMLElement => t.kind === 'yt'
      ? h('img', { class: 'dj-cf-img', src: thumb(t.id), alt: '', draggable: 'false' })
      : h('div', { class: 'dj-cf-ph', style: `background:hsl(${[...t.title].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360} 45% 32%)` }, mirror ? null : [h('b', null, t.title), h('small', null, t.artist)]);
    const item = h('div', { class: `dj-cf-item ${o === 0 ? 'dj-cf-center' : ''}`, style: `transform:translateX(calc(-50% + ${x}px)) translateZ(${o === 0 ? 40 * k : 0}px) rotateY(${o === 0 ? 0 : o < 0 ? 52 : -52}deg) scale(${1 - abs * 0.03});z-index:${10 - abs};opacity:${abs === span ? 0.5 : 1}`, draggable: 'true', onClick: () => { selected = t.id; G.save(); }, onDblclick: () => void loadTrack(!live.A.playing ? 'A' : 'B', t) },
      tile(false), h('div', { class: 'dj-cf-mirror', 'aria-hidden': 'true' }, tile(true)));
    item.addEventListener('dragstart', (e) => e.dataTransfer?.setData('application/x-jam-track', t.id));
    box.append(item);
  }
  let acc = 0;
  box.addEventListener('wheel', (e) => { e.preventDefault(); acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; const n = Math.trunc(acc / 100); if (n) { acc -= n * 100; const next = rows[clamp(index + n, 0, rows.length - 1)]; if (next) { selected = next.id; G.save(); } } }, { passive: false });
  return box;
}
function library(): HTMLElement {
  const j = jam();
  const node = (label: string, icon: SVGSVGElement, on: boolean, act: () => void, opts: { caret?: boolean; count?: number; title?: string } = {}): HTMLElement =>
    h('div', { class: `dj-node ${on ? 'dj-node-on' : ''}`, style: 'padding-left:6px', title: opts.title, onClick: act },
      opts.caret ? h('button', { type: 'button', class: 'dj-caret', 'aria-label': 'Expand', onClick: (e: MouseEvent) => { e.stopPropagation(); act(); } }, ic('chevron', 10)) : null,
      icon, h('span', { class: 'dj-node-name' }, label), opts.count ? h('span', { class: 'dj-side-n' }, String(opts.count)) : null);
  const pick = (): void => pickFiles(false);
  const tree = h('div', { class: 'dj-tree' }, h('div', { class: 'dj-tree-scroll' },
    h('div', { class: 'dj-tree-group' }, h('div', { class: 'dj-tree-title' }, 'Computer'),
      node('Music', ic('music', 13, 'dj-ic-music'), j.source === 'music', () => { j.source = 'music'; save(); if (!files.size) pick(); }, { caret: true, count: files.size, title: 'Songs from your computer (this session)' }),
      node('Desktop', ic('monitor', 13), false, pick, { caret: true, title: 'Pick songs from your Desktop' }),
      node('Downloads', ic('download', 13), false, pick, { caret: true, title: 'Pick songs from Downloads' }),
      node('Documents', ic('file', 13), false, pick, { caret: true, title: 'Pick songs from Documents' }),
      node('Videos', ic('video', 13, 'dj-ic-video'), false, pick, { caret: true, title: 'Pick music videos' }),
      node('Home', ic('home', 13), false, pick, { caret: true, title: 'Pick songs from your user folder' })),
    h('div', { class: 'dj-tree-group' }, h('div', { class: 'dj-tree-title' }, 'Drives'),
      node('C:', ic('drive', 13), false, () => pickFiles(true), { caret: true, title: 'Pick a folder with music in it' })),
    h('div', { class: 'dj-tree-group' }, h('div', { class: 'dj-tree-title' }, 'Online'),
      node('YouTube', ic('youtube', 13, 'dj-ic-yt'), j.source === 'youtube', () => { j.source = 'youtube'; save(); setTimeout(() => document.querySelector<HTMLInputElement>('.jam-dj .dj-search input')?.focus(), 30); }, { title: 'Search YouTube for anything' }),
      node('My YouTube songs', ic('list', 13, 'dj-ic-fav'), j.source === 'saved', () => { j.source = 'saved'; save(); }, { count: j.library.length, title: 'Songs you loaded or sent from YouTube' })),
    h('div', { class: 'dj-tree-group' }, h('div', { class: 'dj-tree-title' }, 'My Folders', h('button', { type: 'button', class: 'dj-icon-btn', title: 'Add a music folder', onClick: () => pickFiles(true) }, ic('folderPlus', 13))),
      h('div', { class: 'dj-tree-hint' }, 'Add any folder with music in it'))));
  const rows = rowsNow();
  const yt = j.source === 'youtube';
  const input = h('input', { placeholder: yt ? 'Search YouTube — type anything, press Enter' : j.source === 'music' ? 'Filter Music — Enter searches all sub-folders' : 'Filter your YouTube songs, or paste a link', value: yt ? (searchQuery || '') : filterText, 'data-key': `jam-search-${j.source}`, 'aria-label': yt ? 'Search YouTube' : 'Filter songs' }) as HTMLInputElement;
  input.addEventListener('input', () => { if (!yt) { filterText = input.value; G.save(); } });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const v = input.value.trim();
    if (yt) { void searchYouTube(v); return; }
    if (youtubeId(v)) { addToLibrary(youtubeId(v)!); filterText = ''; G.save(); return; }
    if (j.source === 'saved' && v) { j.source = 'youtube'; void searchYouTube(v); }
  });
  const count = h('span', { class: 'dj-count' }, searching && yt ? ic('loader', 12, 'dj-spin') : null, yt ? (searching ? `Searching “${searchQuery}”…` : searchResults ? `${rows.length} results` : `${rows.length} saved`) : `${rows.length} ${j.source === 'music' ? 'files' : 'songs'}`);
  const search = h('div', { class: 'dj-search' }, ic('search', 13), input,
    (yt ? searchQuery : filterText) ? h('button', { type: 'button', class: 'dj-icon-btn', title: 'Clear', onClick: () => { if (yt) { searchQuery = ''; searchResults = null; } else filterText = ''; G.save(); } }, ic('x', 12)) : null,
    h('button', { type: 'button', class: `dj-icon-btn dj-covers-btn ${j.covers ? 'on' : ''}`, title: 'Cover flow', onClick: () => { j.covers = !j.covers; save(); } }, ic('images', 13)),
    yt && searchResults?.length ? h('button', { type: 'button', class: 'dj-icon-btn dj-queue-all', title: 'Add every result to the set list', onClick: () => { for (const t of searchResults!) { addToLibrary(t.id, t.title, t.artist, t.duration); j.queue.push(t.id); } save(); toast(`${searchResults!.length} songs added to the set.`); } }, ic('listPlus', 13)) : null,
    count);
  const empty = yt
    ? (searchError ? searchError : searching ? '' : 'Type anything — a song, an artist, a style ("afrobeats 2026", "90s r&b", "gospel choir") — and press Enter. Results play right here on the decks.')
    : j.source === 'music' ? 'Add songs from your computer (Music, Desktop, Downloads… on the left), or drop audio files here.'
      : 'Songs you load or send from YouTube are kept here. Search YouTube on the left, or paste a link above.';
  const tbody = h('div', { class: 'dj-tbody', 'data-scroll': 'jam-tbody' },
    rows.length ? rows.slice(0, 300).map((t) => {
      const tr = h('div', { class: `dj-tr ${t.id === selected ? 'dj-sel' : ''}`, draggable: 'true', onClick: () => { selected = t.id; G.save(); }, onDblclick: () => void loadTrack(!live.A.playing ? 'A' : 'B', t), title: 'Drag onto a deck, or double-click to load' },
        h('span', { class: 'dj-td dj-c-title' }, ic(t.kind === 'yt' ? 'youtube' : 'music', 11, t.kind === 'yt' ? 'dj-note dj-ic-yt' : 'dj-note'), t.title),
        h('span', { class: 'dj-td dj-c-artist' }, t.artist),
        h('span', { class: 'dj-td dj-c-album' }, t.album ?? ''),
        h('span', { class: 'dj-td dj-c-length' }, t.duration ? fmtTime(t.duration, false) : ''),
        h('span', { class: 'dj-td dj-c-bpm' }, t.bpm ? t.bpm.toFixed(1) : ''),
        h('span', { class: 'dj-td dj-c-key' }, ''),
        h('span', { class: 'dj-td dj-c-act' },
          h('button', { type: 'button', title: 'Load on deck A', onClick: (e: MouseEvent) => { e.stopPropagation(); void loadTrack('A', t); } }, 'A'),
          h('button', { type: 'button', title: 'Load on deck B', onClick: (e: MouseEvent) => { e.stopPropagation(); void loadTrack('B', t); } }, 'B'),
          h('button', { type: 'button', title: 'Add to the set list', onClick: (e: MouseEvent) => { e.stopPropagation(); if (t.kind === 'yt') addToLibrary(t.id, t.title, t.artist, t.duration); j.queue.push(t.id); save(); } }, ic('plus', 11)),
          j.source !== 'youtube' ? h('button', { type: 'button', title: 'Remove', onClick: (e: MouseEvent) => { e.stopPropagation(); if (t.kind === 'yt') j.library = j.library.filter((x) => x.id !== t.id); else { URL.revokeObjectURL(files.get(t.id)!.url); files.delete(t.id); } j.queue = j.queue.filter((x) => x !== t.id); save(); } }, ic('x', 11)) : null));
      tr.addEventListener('dragstart', (e) => e.dataTransfer?.setData('application/x-jam-track', t.id));
      return tr;
    }) : h('div', { class: 'dj-empty' }, empty));
  const browser = h('div', { class: 'dj-browser', tabIndex: 0 },
    search,
    j.covers ? coverflow(rows) : null,
    h('div', { class: 'dj-table' },
      h('div', { class: 'dj-thead' }, ['Title', 'Artist', 'Album', 'Length', 'Bpm', 'Key'].map((x) => h('button', { type: 'button', class: `dj-th dj-c-${x.toLowerCase()}` }, x)), h('span', { class: 'dj-th dj-c-act' })),
      tbody));
  browser.addEventListener('dragover', (e) => e.preventDefault());
  browser.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files); else { const id = youtubeId(e.dataTransfer?.getData('text/plain') ?? ''); if (id) addToLibrary(id); } });
  const side = h('div', { class: 'dj-side' },
    h('div', { class: 'dj-side-head' },
      h('button', { type: 'button', class: 'dj-side-tab on', title: 'Set list — the songs Automix plays next' }, ic('list', 12), ' SET ', h('span', { class: 'dj-side-n' }, String(j.queue.length))),
      h('button', { type: 'button', class: 'dj-icon-btn', title: 'Clear the set', onClick: () => { j.queue = []; save(); } }, ic('trash', 12))),
    h('div', { class: 'dj-side-body', style: 'display:flex' },
      h('button', { type: 'button', class: `dj-automix ${j.automix ? 'dj-on dj-on-green' : ''}`, title: 'Automix — crossfade through the set as each song ends', onClick: () => { j.automix = !j.automix; save(); } }, ic('shuffle', 13), ' AUTOMIX'),
      h('div', { class: 'dj-side-list', 'data-scroll': 'jam-set' },
        j.queue.length ? j.queue.map((id, i) => { const t = trackOf(id); const item = h('div', { class: 'dj-side-item', draggable: 'true' }, h('span', { class: 'dj-side-i' }, String(i + 1)), h('div', { class: 'dj-side-t' }, h('b', null, t?.title ?? 'Song from an earlier session'), h('small', null, t?.artist ?? '')), h('button', { type: 'button', class: 'dj-icon-btn', title: 'Remove', onClick: () => { j.queue.splice(i, 1); save(); } }, ic('x', 11))); item.addEventListener('dragstart', (e) => e.dataTransfer?.setData('application/x-jam-track', id)); return item; })
          : h('div', { class: 'dj-side-empty' }, ic('list', 22), h('p', null, 'Drag songs here or press + on a row to build a set. Turn on Automix and Jam crossfades through it as each song ends.')))));
  side.addEventListener('dragover', (e) => e.preventDefault());
  side.addEventListener('drop', (e) => { e.preventDefault(); const id = e.dataTransfer?.getData('application/x-jam-track'); if (id && trackOf(id)) { const t = trackOf(id)!; if (t.kind === 'yt') addToLibrary(t.id, t.title, t.artist, t.duration); j.queue.push(id); save(); } });
  return h('div', { class: 'dj-library dj-panel' }, tree, browser, side);
}

// ---------------------------------------------------------------- the tool
const DESIGN_W = 1300, DESIGN_H = 892;
const sized = new WeakSet<HTMLElement>();
function fit(host: HTMLElement): void {
  const root = host.querySelector<HTMLElement>('.jam-dj');
  const w = host.clientWidth, hh = host.clientHeight;
  if (!root || !w || !hh) return;
  root.style.zoom = String(Math.max(0.4, Math.min(1, w / DESIGN_W, hh / DESIGN_H) * uiZoom));
}
registerTool({
  id: 'jam', name: 'Jam', short: 'Jam', width: 1320, height: 940,
  icon: '<rect x="2" y="5" width="30" height="24" rx="4" fill="#d4d7db"/><circle cx="13" cy="17" r="9" fill="#141518"/><circle cx="13" cy="17" r="3.4" fill="#d71920"/><path d="M27 8v13" stroke="#3b3f46" stroke-width="2.2" stroke-linecap="round"/><path d="M25 21l-5 4" stroke="#3b3f46" stroke-width="2.2" stroke-linecap="round"/>',
  draw(host) {
    jam();
    host.append(h('div', { class: 'jam-dj' },
      topBar(),
      h('div', { class: 'dj-row-clocks' }, deckClock('A'), h('div', { class: 'dj-panel dj-zoom' }, h('canvas', { class: 'dj-zoomwave' })), deckClock('B')),
      h('div', { class: 'dj-row-info' }, deckInfo('A'), h('div', { class: 'dj-info-gap' }), deckInfo('B')),
      h('div', { class: 'dj-row-decks' }, deckPads('A'), turntable('A'), mixer(), turntable('B'), deckPads('B')),
      library()));
    fit(host);
    if (!sized.has(host) && typeof ResizeObserver !== 'undefined') { sized.add(host); new ResizeObserver(() => fit(host)).observe(host); }
    paintLive();
  },
});

// AIHub's keyboard shortcuts, while Jam is the window in front and no text box has focus.
addEventListener('keydown', (e) => {
  const root = document.querySelector<HTMLElement>('.jam-dj');
  if (!root || !root.offsetParent || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const win = root.closest('.app-window');
  if (win && [...document.querySelectorAll<HTMLElement>('#desktop .app-window:not(.hidden)')].some((w) => w !== win && Number(getComputedStyle(w).zIndex) > Number(getComputedStyle(win).zIndex))) return;
  const tgt = e.target as HTMLElement | null;
  if (tgt && (tgt.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName))) return;
  const j = jam(), k = e.key.toLowerCase();
  const keys: Record<string, () => void> = {
    q: () => toggle('A'), w: () => cue('A'), p: () => toggle('B'), o: () => cue('B'), s: () => { if (!sync('B')) sync('A'); },
    1: () => hotCue('A', 0), 2: () => hotCue('A', 1), 3: () => hotCue('A', 2), 8: () => hotCue('B', 0), 9: () => hotCue('B', 1), 0: () => hotCue('B', 2),
    arrowleft: () => { if (e.shiftKey) fadeTo('A'); else { j.xfade = clamp01(j.xfade - 0.05); applyMix(); save(); } },
    arrowright: () => { if (e.shiftKey) fadeTo('B'); else { j.xfade = clamp01(j.xfade + 0.05); applyMix(); save(); } },
    arrowdown: () => { j.xfade = 0.5; applyMix(); save(); }, m: () => fadeTo(j.xfade < 0.5 ? 'B' : 'A'), a: () => { j.automix = !j.automix; save(); },
    z: () => fire('horn'), x: () => fire('siren'), c: () => fire('laser'), v: () => fire('riser'), b: () => fire('impact'), n: () => fire('clap'), g: () => fire('rewind'), h: () => fire('tom'),
  };
  const fn = keys[k];
  if (fn) { e.preventDefault(); fn(); }
});

// ---------------------------------------------------------------- "Jam A / Jam B" in the lab's Chrome
// (YouTube links in the lab's Chrome play through the embeddable player: see frameUrl in desktop.js.)
function decorateChrome(): void {
  const bar = document.querySelector<HTMLElement>('.browser-app .browser-toolbar');
  if (!bar) return;
  const b = G.CorpDesk?.browserState?.();
  const address: string = b?.tabs?.[b.active]?.url ?? (bar.querySelector('#browserAddress') as HTMLInputElement | null)?.value ?? '';
  const id = youtubeId(address);
  let box = bar.querySelector<HTMLElement>('.jam-send');
  if (!id) { box?.remove(); return; }
  if (box?.dataset.id === id) return;
  box?.remove();
  box = h('span', { class: 'jam-send' },
    h('button', { type: 'button', title: 'Send this video to Jam, deck A', onClick: () => sendToJam(address, undefined, 'A') }, '🎧 Jam A'),
    h('button', { type: 'button', title: 'Send this video to Jam, deck B', onClick: () => sendToJam(address, undefined, 'B') }, 'Jam B'));
  box.dataset.id = id;
  bar.append(box);
}
new MutationObserver(decorateChrome).observe(document.documentElement, { childList: true, subtree: true });
setInterval(decorateChrome, 1000);
Object.assign((G.CorpDesk ||= {}), { sendToJam, searchYouTube });
