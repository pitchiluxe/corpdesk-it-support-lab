/**
 * Lock screen backgrounds for CORP Desk, the same set as the Meridian IAM Range
 * (src/ui/wallpapers.ts): solid gradients, a quiet wordmark (CORP instead of
 * MERIDIAN), bundled artwork, an uploaded picture, and an unbounded generated
 * queue (wallpaperGenerator.ts, copied unchanged).
 *
 * Each entry is a complete CSS `background` value, so the lock screen and the
 * Settings thumbnails paint the same thing.
 */
import { generateWallpaper, idToSeed } from './wallpaperGenerator.ts';

export interface Wallpaper {
  id: string;
  label: string;
  gradient: string;
}

function wordmark(bg: string, word: string, ink: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080'>
    <rect width='100%' height='100%' fill='${bg}'/>
    <text x='50%' y='50%' font-family='Segoe UI, -apple-system, sans-serif' font-size='200'
      font-weight='800' fill='${ink}' fill-opacity='0.32' text-anchor='middle'
      dominant-baseline='middle' letter-spacing='6'>${word}</text>
  </svg>`;
  return `${bg} url("data:image/svg+xml,${encodeURIComponent(svg)}") center/cover no-repeat`;
}

const COLOURS: Wallpaper[] = [
  { id: 'deep-blue', label: 'Deep Blue', gradient: 'linear-gradient(150deg,#0b3a5e 0%,#123f63 40%,#0e2438 100%)' },
  { id: 'slate', label: 'Slate', gradient: 'linear-gradient(150deg,#141a21 0%,#1e262f 45%,#0d1117 100%)' },
  { id: 'dusk', label: 'Dusk', gradient: 'linear-gradient(160deg,#2a1b3d 0%,#44318d 45%,#1b1032 100%)' },
  { id: 'forest', label: 'Forest', gradient: 'linear-gradient(150deg,#0d2818 0%,#14432a 45%,#08170f 100%)' },
  { id: 'magenta', label: 'Magenta', gradient: 'linear-gradient(160deg,#2a0d1e 0%,#5a1e42 45%,#2a0d1e 100%)' },
  { id: 'obsidian', label: 'Obsidian', gradient: 'linear-gradient(150deg,#0c0c0c 0%,#1f1f1f 45%,#0c0c0c 100%)' },
  { id: 'copper', label: 'Copper', gradient: 'linear-gradient(160deg,#2a1b0e 0%,#5a3a1e 45%,#2a1b0e 100%)' },
  { id: 'midnight-blue', label: 'Midnight Blue', gradient: 'linear-gradient(145deg,#0a1128 0%,#1a2456 60%,#0a1128 100%)' },
  { id: 'warm-amber', label: 'Warm Amber', gradient: 'linear-gradient(145deg,#241a0d 0%,#3d2e10 60%,#1a1000 100%)' },
  { id: 'purple-haze', label: 'Purple Haze', gradient: 'linear-gradient(160deg,#1a1029 0%,#3a2468 50%,#1a1029 100%)' },
  { id: 'rose-gold', label: 'Rose Gold', gradient: 'linear-gradient(150deg,#2b181c 0%,#5a333e 50%,#2b181c 100%)' },
  { id: 'windows-blue', label: 'Windows Blue', gradient: 'linear-gradient(135deg,#0b3d91 0%,#1e5fbf 35%,#5b8def 70%,#a7c7f2 100%)' },
];

const MARKS: Wallpaper[] = [
  { id: 'corp-dark', label: 'CORP Dark', gradient: wordmark('#0a0c10', 'CORP', '#5a6570') },
  { id: 'corp-navy', label: 'CORP Navy', gradient: wordmark('#08101a', 'CORP', '#3a5a7a') },
  { id: 'corp-teal', label: 'CORP Teal', gradient: wordmark('#07151a', 'CORP', '#3a8a8a') },
  { id: 'corp-forest', label: 'CORP Forest', gradient: wordmark('#09180f', 'CORP', '#3a7a4a') },
  { id: 'corp-purple', label: 'CORP Purple', gradient: wordmark('#120a1c', 'CORP', '#6a4a8a') },
  { id: 'corp-crimson', label: 'CORP Crimson', gradient: wordmark('#1a0a0e', 'CORP', '#8a3a45') },
  { id: 'corp-gold', label: 'CORP Gold', gradient: wordmark('#141008', 'CORP', '#8a6a2a') },
  { id: 'it-slate', label: 'IT Slate', gradient: wordmark('#10151c', 'IT', '#4a5a6a') },
];

const ART: Wallpaper[] = [
  { id: 'blue-shield', label: 'Blue Glass Shield', gradient: '#07121f url("wallpapers/blue-shield.webp") center/cover no-repeat' },
  { id: 'network-constellation', label: 'Network Constellation', gradient: '#06121a url("wallpapers/network-constellation.webp") center/cover no-repeat' },
  { id: 'emerald-core', label: 'Emerald Secure Core', gradient: '#061411 url("wallpapers/emerald-core.webp") center/cover no-repeat' },
];

export const LOCK_SCREENS: Wallpaper[] = [...COLOURS, ...MARKS, ...ART];
export const DEFAULT_LOCK_SCREEN_ID = 'deep-blue';
export const CUSTOM_LOCK_KEY = 'corpdesk-custom-lock-screen';

function custom(): string | null {
  try {
    const data = localStorage.getItem(CUSTOM_LOCK_KEY);
    return data ? `#0b1a2c url("${data}") center/cover no-repeat` : null;
  } catch {
    return null;
  }
}

/** Resolve an id (built-in, generated or 'custom') to a CSS background. Unknown ids fall back. */
export function backgroundFor(id: string | undefined): string {
  if (id === 'custom') return custom() ?? backgroundFor(DEFAULT_LOCK_SCREEN_ID);
  const hit = LOCK_SCREENS.find((w) => w.id === id);
  if (hit) return hit.gradient;
  const seed = id ? idToSeed(id) : null;
  if (seed) return generateWallpaper(seed.seed, seed.kind).gradient;
  return LOCK_SCREENS.find((w) => w.id === DEFAULT_LOCK_SCREEN_ID)!.gradient;
}

/** Built-in plus the learner's generated backgrounds (and an uploaded picture), as the picker shows them. */
export function allLockScreens(generated: readonly string[]): Wallpaper[] {
  const gen = generated.map((id) => idToSeed(id)).filter((x): x is { seed: number; kind: 'wall' | 'lock' } => !!x).map((x) => generateWallpaper(x.seed, x.kind));
  const own = custom();
  return [...LOCK_SCREENS, ...gen, ...(own ? [{ id: 'custom', label: 'Your picture', gradient: own }] : [])];
}
